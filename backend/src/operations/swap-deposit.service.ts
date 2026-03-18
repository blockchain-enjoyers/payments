import {
  Injectable,
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
import {
  AA_GATEWAY_CHAINS,
  ALL_CHAINS,
  HUB_CHAIN,
  getUsdcAddress,
} from '../circle/config/chains';
import { USDC_DECIMALS } from '../circle/gateway/gateway.types';
import { PrepareSwapDepositDto } from './dto/prepare-swap-deposit.dto';
import { netBurnAmount } from './helpers/fee.util';
import { getChainsNeedingDelegate } from './helpers/delegate.util';
import { getUser } from './helpers/operations.helper';

@Injectable()
export class SwapDepositService {
  private readonly logger = new Logger(SwapDepositService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circleService: CircleService,
    private readonly gatewayService: GatewayService,
    private readonly lifiService: LifiService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
}
