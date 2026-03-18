import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseUnits, formatUnits } from 'viem';
import { PrismaService } from '../common/prisma/prisma.service';
import { CircleService } from '../circle/circle.service';
import { GatewayService } from '../circle/gateway/gateway.service';
import { LifiService } from '../lifi/lifi.service';
import { AuthService } from '../auth/auth.service';
import { SendService } from './send.service';
import { CollectService } from './collect.service';
import {
  AA_GATEWAY_CHAINS,
  ALL_CHAINS,
  HUB_CHAIN,
  getUsdcAddress,
} from '../circle/config/chains';
import { USDC_DECIMALS } from '../circle/gateway/gateway.types';
import { PrepareCollectDto } from './dto/prepare-collect.dto';
import { PrepareSendDto } from './dto/prepare-send.dto';
import { PrepareSwapDepositDto } from './dto/prepare-swap-deposit.dto';
import { SubmitOperationDto } from './dto/submit-operation.dto';
import {
  netBurnAmount,
} from './helpers/fee.util';
import { getChainsNeedingDelegate } from './helpers/delegate.util';
import { getUser } from './helpers/operations.helper';
import {
  isAttestationConsumed,
  isAttestationExpired,
} from '../circle/gateway/gateway.errors';

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circleService: CircleService,
    private readonly gatewayService: GatewayService,
    private readonly lifiService: LifiService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly sendService: SendService,
    private readonly collectService: CollectService,
  ) {}

  async prepareCollect(userId: string, dto: PrepareCollectDto) {
    return this.collectService.prepareCollect(userId, dto);
  }

  async prepareSwapDeposit(userId: string, dto: PrepareSwapDepositDto) {
    const user = await getUser(this.prisma, userId);
    const chainKey = dto.sourceChain;

    if (!(chainKey in AA_GATEWAY_CHAINS)) {
      throw new BadRequestException(
        `Chain ${chainKey} does not support AA + Gateway. Supported: ${Object.keys(AA_GATEWAY_CHAINS).join(', ')}`,
      );
    }

    const chain = ALL_CHAINS[chainKey];
    const usdcAddress = getUsdcAddress(chainKey);
    const decimals = dto.tokenDecimals ?? 18;
    const slippage = dto.slippage ?? 0.005;

    // Parse amount in source token units
    const sourceAmount = parseUnits(dto.amount, decimals);

    // Get LiFi quote: sourceToken → USDC on same chain
    const quote = await this.lifiService.getQuote({
      fromChain: chain.chainId,
      toChain: chain.chainId,
      fromToken: dto.sourceToken,
      toToken: usdcAddress,
      fromAmount: sourceAmount.toString(),
      fromAddress: user.walletAddress,
      slippage,
    });

    // Use toAmountMin (accounts for slippage) as deposit amount
    const depositAmount = BigInt(quote.estimate.toAmountMin);

    // Build combined calls: [approve→LiFi, swap, approve→Gateway, deposit]
    const swapAndDepositCalls = this.lifiService.buildSwapAndDepositCalls(
      quote,
      dto.sourceToken,
      sourceAmount,
      chainKey,
      depositAmount,
    );

    // Check if delegate needs setup — prepend if so
    const chainsNeedingDelegate = await getChainsNeedingDelegate(this.gatewayService,
      [chainKey],
      user.walletAddress,
      user.delegateAddress,
    );
    const delegateNeeded = chainsNeedingDelegate.length > 0;

    const allCalls = delegateNeeded
      ? [
          ...this.circleService.buildDelegateCallData(chainKey, user.delegateAddress),
          ...swapAndDepositCalls,
        ]
      : swapAndDepositCalls;

    // If source chain is already the hub, no burn/mint needed
    const needsBurnMint = chainKey !== HUB_CHAIN;
    const burnAmount = needsBurnMint ? netBurnAmount(depositAmount, chainKey) : 0n;

    const operation = await this.prisma.operation.create({
      data: {
        userId,
        type: 'SWAP_DEPOSIT',
        status: 'AWAITING_SIGNATURE',
        params: {
          sourceChain: chainKey,
          sourceToken: dto.sourceToken,
          amount: dto.amount,
          tokenDecimals: decimals,
          slippage,
        },
        summary: {
          action: 'swap-deposit',
          inputToken: quote.action.fromToken.symbol,
          inputAmount: dto.amount,
          estimatedUsdc: formatUnits(BigInt(quote.estimate.toAmount), USDC_DECIMALS),
          minimumUsdc: formatUnits(depositAmount, USDC_DECIMALS),
          slippage: `${slippage * 100}%`,
          sourceChain: chainKey,
          destinationChain: HUB_CHAIN,
          lifiRoute: quote.tool,
          delegateIncluded: delegateNeeded,
          needsBurnMint,
          estimatedTime: needsBurnMint ? '15-25 minutes' : `~${quote.estimate.executionDuration}s`,
        },
        feeAmount: '0',
        feePercent: '0',
      },
    });

    let stepIndex = 0;

    const swapStep = await this.prisma.operationStep.create({
      data: {
        operationId: operation.id,
        stepIndex: stepIndex++,
        chain: chainKey,
        type: 'LIFI_SWAP',
        status: 'AWAITING_SIGNATURE',
        callData: allCalls.map((c) => ({
          to: c.to,
          data: c.data,
          value: c.value?.toString(),
        })),
      },
    });

    const desc = delegateNeeded
      ? `Add delegate + swap ${dto.amount} ${quote.action.fromToken.symbol} → USDC and deposit on ${chainKey}`
      : `Swap ${dto.amount} ${quote.action.fromToken.symbol} → USDC and deposit on ${chainKey}`;

    const signRequests: any[] = [
      {
        stepId: swapStep.id,
        chain: chainKey,
        type: 'LIFI_SWAP',
        calls: allCalls.map((c) => ({ to: c.to, data: c.data })),
        description: desc,
      },
    ];

    // If not on hub chain — add burn+mint steps to move USDC to hub
    if (needsBurnMint) {
      const burnStep = await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: chainKey,
          type: 'BURN_INTENT',
          status: 'PENDING',
          burnIntentData: {
            sourceChain: chainKey,
            destinationChain: HUB_CHAIN,
            amount: burnAmount.toString(),
            depositor: user.walletAddress,
            recipient: user.walletAddress,
          },
        },
      });

      await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: HUB_CHAIN,
          type: 'MINT',
          status: 'PENDING',
        },
      });

      signRequests.push({
        stepId: burnStep.id,
        chain: chainKey,
        type: 'BURN_INTENT',
        description: `Burn ${formatUnits(burnAmount, USDC_DECIMALS)} USDC on ${chainKey} → mint on ${HUB_CHAIN}`,
        serverSide: true,
      });
    }

    await this.prisma.operation.update({
      where: { id: operation.id },
      data: { signRequests },
    });

    return {
      id: operation.id,
      type: 'SWAP_DEPOSIT',
      status: 'AWAITING_SIGNATURE',
      summary: operation.summary,
      signRequests,
    };
  }

  async prepareSend(userId: string, dto: PrepareSendDto) {
    return this.sendService.prepareSend(userId, dto);
  }

  async submitOperation(userId: string, operationId: string, dto: SubmitOperationDto) {
    const operation = await this.prisma.operation.findFirst({
      where: { id: operationId, userId },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    });

    if (!operation) throw new NotFoundException('Operation not found');

    if (operation.status !== 'AWAITING_SIGNATURE') {
      throw new BadRequestException(
        `Operation is in ${operation.status} state, cannot submit signatures`,
      );
    }

    const user = await getUser(this.prisma, userId);

    // Mark submitted steps as CONFIRMED
    for (const sig of dto.signatures) {
      await this.prisma.operationStep.update({
        where: { id: sig.stepId },
        data: {
          status: 'CONFIRMED',
          txHash: sig.txHash,
          completedAt: new Date(),
        },
      });
    }

    // Eagerly try burn intents + server-side mint
    const burnSteps = operation.steps.filter(
      (s) => s.type === 'BURN_INTENT' && s.status === 'PENDING',
    );

    const delegateKey = this.authService.getDelegatePrivateKey(user);
    const relayerKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
    const mintSteps = operation.steps.filter(
      (s) => s.type === 'MINT' && s.status === 'PENDING',
    );

    let mintIndex = 0;

    for (const step of burnSteps) {
      const intentData = step.burnIntentData as any;

      try {
        const { transfer } = await this.circleService.submitBurnIntent(
          intentData.sourceChain,
          intentData.destinationChain,
          BigInt(intentData.amount),
          intentData.depositor,
          intentData.recipient,
          delegateKey,
        );

        await this.prisma.operationStep.update({
          where: { id: step.id },
          data: {
            status: 'CONFIRMED',
            attestation: transfer.attestation,
            operatorSignature: transfer.signature,
            completedAt: new Date(),
          },
        });

        // Eagerly try server-side mint
        if (relayerKey && mintIndex < mintSteps.length) {
          const mintStep = mintSteps[mintIndex];
          try {
            const txHash = await this.gatewayService.executeMint(
              intentData.destinationChain,
              transfer.attestation,
              transfer.signature,
              relayerKey,
            );

            await this.prisma.operationStep.update({
              where: { id: mintStep.id },
              data: {
                status: 'CONFIRMED',
                txHash,
                completedAt: new Date(),
              },
            });

            this.logger.log(`Eager mint succeeded on ${intentData.destinationChain}: ${txHash}`);
          } catch (mintError) {
            const msg = mintError.message || '';
            if (isAttestationConsumed(msg)) {
              this.logger.log(
                `Eager mint: attestation already consumed on ${intentData.destinationChain} — marking CONFIRMED`,
              );
              await this.prisma.operationStep.update({
                where: { id: mintStep.id },
                data: {
                  status: 'CONFIRMED',
                  completedAt: new Date(),
                  errorMessage: 'Attestation already consumed (duplicate mint detected)',
                },
              });
            } else if (isAttestationExpired(msg)) {
              this.logger.error(
                `Eager mint: attestation expired on ${intentData.destinationChain}`,
              );
              await this.prisma.operationStep.update({
                where: { id: mintStep.id },
                data: {
                  status: 'FAILED',
                  errorMessage: `Attestation expired on ${intentData.destinationChain}`,
                },
              });
            } else {
              this.logger.warn(
                `Eager mint failed on ${intentData.destinationChain}, worker will retry: ${msg}`,
              );
            }
          }
          mintIndex++;
        }
      } catch (error) {
        // Burn intent failed (deposit likely not finalized yet) — leave PENDING for worker
        this.logger.warn(
          `Burn intent failed for ${intentData.sourceChain}→${intentData.destinationChain}, worker will retry: ${error.message}`,
        );
      }
    }

    // Determine final status
    const freshSteps = await this.prisma.operationStep.findMany({
      where: { operationId },
    });

    const allDone = freshSteps.every(
      (s) => s.status === 'CONFIRMED' || s.status === 'SKIPPED',
    );

    if (allDone) {
      await this.prisma.operation.update({
        where: { id: operationId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } else {
      // Pending steps remain — background worker will continue
      await this.prisma.operation.update({
        where: { id: operationId },
        data: { status: 'PROCESSING' },
      });
    }

    return this.getOperation(userId, operationId);
  }

  async refreshSwapQuote(userId: string, operationId: string) {
    return this.sendService.refreshSwapQuote(userId, operationId);
  }

  async getOperation(userId: string, operationId: string) {
    const operation = await this.prisma.operation.findFirst({
      where: { id: operationId, userId },
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
          select: {
            id: true,
            stepIndex: true,
            chain: true,
            type: true,
            status: true,
            txHash: true,
            callData: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!operation) throw new NotFoundException('Operation not found');

    return {
      id: operation.id,
      type: operation.type,
      status: operation.status,
      summary: operation.summary,
      signRequests: operation.signRequests,
      feeAmount: operation.feeAmount,
      feePercent: operation.feePercent,
      steps: operation.steps,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt,
      errorMessage: operation.errorMessage,
    };
  }

  async getOperations(
    userId: string,
    type?: string,
    status?: string,
    limit = 20,
    offset = 0,
  ) {
    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [operations, total] = await Promise.all([
      this.prisma.operation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          summary: true,
          feeAmount: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.operation.count({ where }),
    ]);

    return { operations, total, limit, offset };
  }
}
