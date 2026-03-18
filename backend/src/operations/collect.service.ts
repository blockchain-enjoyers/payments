import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatUnits } from 'viem';
import { PrismaService } from '../common/prisma/prisma.service';
import { CircleService } from '../circle/circle.service';
import { GatewayService } from '../circle/gateway/gateway.service';
import { AuthService } from '../auth/auth.service';
import { HUB_CHAIN } from '../circle/config/chains';
import { USDC_DECIMALS } from '../circle/gateway/gateway.types';
import { PrepareCollectDto } from './dto/prepare-collect.dto';
import { BATCH_FEE_PERCENT, netBurnAmount } from './helpers/fee.util';
import { getChainsNeedingDelegate } from './helpers/delegate.util';
import { getUser, validateGatewayChain } from './helpers/operations.helper';

@Injectable()
export class CollectService {
  private readonly logger = new Logger(CollectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circleService: CircleService,
    private readonly gatewayService: GatewayService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async prepareCollect(userId: string, dto: PrepareCollectDto) {
    const user = await getUser(this.prisma, userId);
    const destination = dto.destination || HUB_CHAIN;

    validateGatewayChain(destination);
    for (const chain of dto.sourceChains) {
      validateGatewayChain(chain);
    }

    // Read on-chain balances (multi-token per chain)
    // Collect only cares about USDC for Gateway deposits
    const onChainBalances =
      await this.circleService.getMultiChainBalances(user.walletAddress);

    const sources: Array<{
      chain: string;
      depositAmount: bigint; // full on-chain balance to deposit to Gateway
      burnAmount: bigint;    // net amount to burn (after Gateway ~2% fee)
    }> = [];
    let totalBurnAmount = 0n;

    for (const chain of dto.sourceChains) {
      const chainTokens = onChainBalances[chain];
      const usdcInfo = chainTokens?.USDC;
      const onChainBalance = usdcInfo
        ? BigInt(Math.floor(parseFloat(usdcInfo.balance) * 1e6))
        : 0n;
      if (onChainBalance > 0n) {
        // Deposit full on-chain balance, burn net amount (leaves room for Gateway fee)
        const burnAmount = netBurnAmount(onChainBalance, chain);
        sources.push({ chain, depositAmount: onChainBalance, burnAmount });
        totalBurnAmount += burnAmount;
      }
    }

    if (sources.length === 0) {
      throw new BadRequestException(
        'No on-chain USDC balance found on specified chains',
      );
    }

    const feePercent = parseFloat(BATCH_FEE_PERCENT);
    const feeRaw = (totalBurnAmount * BigInt(Math.round(feePercent * 10000))) / 10000n;

    const operation = await this.prisma.operation.create({
      data: {
        userId,
        type: 'COLLECT',
        status: 'AWAITING_SIGNATURE',
        params: {
          sourceChains: dto.sourceChains,
          destination,
        },
        summary: {
          sources: sources.map((s) => ({
            chain: s.chain,
            deposit: formatUnits(s.depositAmount, USDC_DECIMALS),
            amount: formatUnits(s.burnAmount, USDC_DECIMALS),
          })),
          destination,
          totalAmount: formatUnits(totalBurnAmount, USDC_DECIMALS),
          fee: formatUnits(feeRaw, USDC_DECIMALS),
          feePercent: BATCH_FEE_PERCENT,
          estimatedTime: '15-20 minutes',
        },
        feeAmount: formatUnits(feeRaw, USDC_DECIMALS),
        feePercent: BATCH_FEE_PERCENT,
      },
    });

    const signRequests: any[] = [];
    let stepIndex = 0;

    // Check which source chains need delegate setup
    const chainsNeedingDelegate = new Set(
      await getChainsNeedingDelegate(this.gatewayService,
        sources.map((s) => s.chain),
        user.walletAddress,
        user.delegateAddress,
      ),
    );

    // Phase 1 steps: APPROVE_AND_DEPOSIT per source chain (+ addDelegate if needed, all in one UserOp)
    for (const source of sources) {
      const depositCalls = this.circleService.buildDepositCallData(
        source.chain,
        source.depositAmount,
      );

      // Prepend addDelegate calls if delegate not yet authorized on this chain
      const allCalls = chainsNeedingDelegate.has(source.chain)
        ? [
            ...this.circleService.buildDelegateCallData(source.chain, user.delegateAddress),
            ...depositCalls,
          ]
        : depositCalls;

      const step = await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: source.chain,
          type: 'APPROVE_AND_DEPOSIT',
          status: 'AWAITING_SIGNATURE',
          callData: allCalls.map((c) => ({
            to: c.to,
            data: c.data,
            value: c.value?.toString(),
          })),
        },
      });

      const desc = chainsNeedingDelegate.has(source.chain)
        ? `Add delegate + approve and deposit ${formatUnits(source.depositAmount, USDC_DECIMALS)} USDC on ${source.chain}`
        : `Approve and deposit ${formatUnits(source.depositAmount, USDC_DECIMALS)} USDC on ${source.chain}`;

      signRequests.push({
        stepId: step.id,
        chain: source.chain,
        type: 'APPROVE_AND_DEPOSIT',
        calls: allCalls.map((c) => ({
          to: c.to,
          data: c.data,
        })),
        description: desc,
      });
    }

    // Future steps (server-side, created as PENDING): burn net amount from Gateway
    for (const source of sources) {
      await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: source.chain,
          type: 'BURN_INTENT',
          status: 'PENDING',
          burnIntentData: {
            sourceChain: source.chain,
            destinationChain: destination,
            amount: source.burnAmount.toString(), // burn net amount (leaves room for ~2% fee)
            depositor: user.walletAddress,
            recipient: user.walletAddress,
          },
        },
      });
    }

    // Mint step on destination (Phase 2)
    await this.prisma.operationStep.create({
      data: {
        operationId: operation.id,
        stepIndex: stepIndex++,
        chain: destination,
        type: 'MINT',
        status: 'PENDING',
      },
    });

    await this.prisma.operation.update({
      where: { id: operation.id },
      data: { signRequests },
    });

    return {
      id: operation.id,
      type: 'COLLECT',
      status: 'AWAITING_SIGNATURE',
      summary: operation.summary,
      signRequests,
    };
  }
}
