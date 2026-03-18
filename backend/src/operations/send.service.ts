import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseUnits, formatUnits, encodeFunctionData, erc20Abi } from 'viem';
import { PrismaService } from '../common/prisma/prisma.service';
import { CircleService } from '../circle/circle.service';
import { GatewayService } from '../circle/gateway/gateway.service';
import { LifiService } from '../lifi/lifi.service';
import { AuthService } from '../auth/auth.service';
import {
  AA_GATEWAY_CHAINS,
  ALL_CHAINS,
  GATEWAY_CHAINS,
  HUB_CHAIN,
  getUsdcAddress,
  getTokenAddress,
  getTokenInfo,
  getTokenByAddress,
} from '../circle/config/chains';
import { USDC_DECIMALS } from '../circle/gateway/gateway.types';
import { PrepareSendDto } from './dto/prepare-send.dto';
import {
  CROSS_CHAIN_FEE_PERCENT,
  BATCH_FEE_PERCENT,
  netBurnAmount,
  grossDepositAmount,
  effectiveSwapSlippage,
} from './helpers/fee.util';
import { getChainsNeedingDelegate } from './helpers/delegate.util';
import { getUser, validateGatewayChain } from './helpers/operations.helper';

@Injectable()
export class SendService {
  private readonly logger = new Logger(SendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circleService: CircleService,
    private readonly gatewayService: GatewayService,
    private readonly lifiService: LifiService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async prepareSend(userId: string, dto: PrepareSendDto) {
    const user = await getUser(this.prisma, userId);
    const sourceChain = dto.sourceChain || HUB_CHAIN;

    validateGatewayChain(sourceChain);

    // Resolve source token from address (defaults to USDC)
    const usdcAddress = getUsdcAddress(sourceChain);
    const sourceTokenAddress = dto.sourceToken || usdcAddress;
    const sourceTokenInfo = getTokenByAddress(sourceTokenAddress, sourceChain);
    if (!sourceTokenInfo) {
      throw new BadRequestException(`Unknown token ${sourceTokenAddress} on ${sourceChain}`);
    }
    const sourceTokenSymbol = sourceTokenInfo.symbol;
    const sourceDecimals = sourceTokenInfo.decimals;
    const isSourceUsdc = sourceTokenAddress.toLowerCase() === usdcAddress.toLowerCase();

    // Normalize recipients: if address is omitted, use walletAddress (bridge to self)
    const recipients = dto.recipients.map((r) => {
      validateGatewayChain(r.chain);
      return {
        ...r,
        address: r.address || user.walletAddress,
        amountRaw: parseUnits(r.amount, sourceDecimals),
        amountUsdcRaw: parseUnits(r.amount, USDC_DECIMALS), // for Gateway (always 6 dec)
      };
    });

    // Determine operation type
    const isSingle = recipients.length === 1;
    const isBridge = isSingle && recipients[0].address === user.walletAddress;
    const opType = isBridge ? 'BRIDGE' : isSingle ? 'SEND' : 'BATCH_SEND';

    // Calculate totals and fee (in source token decimals)
    let totalRaw = 0n;
    for (const r of recipients) totalRaw += r.amountRaw;

    const feePercent = isBridge || !isSingle ? BATCH_FEE_PERCENT : CROSS_CHAIN_FEE_PERCENT;

    // Check if all sends are same-chain
    const allSameChain = recipients.every((r) => sourceChain === r.chain);
    const allInternal = allSameChain && sourceChain === HUB_CHAIN;
    const actualFeePercent = allSameChain ? '0' : feePercent;
    const feeRaw = allSameChain
      ? 0n
      : (totalRaw * BigInt(Math.round(parseFloat(actualFeePercent) * 100))) / 10000n;

    // Check source token balance
    const onChainSourceBalance = await this.gatewayService.getTokenBalance(
      sourceChain, sourceTokenAddress, user.walletAddress,
    );
    if (onChainSourceBalance < totalRaw + feeRaw) {
      throw new BadRequestException(
        `Insufficient ${sourceTokenSymbol} on ${sourceChain}: have ${formatUnits(onChainSourceBalance, sourceDecimals)}, need ${formatUnits(totalRaw + feeRaw, sourceDecimals)}`,
      );
    }

    // Cross-chain: needs Gateway (USDC only). If source is not USDC, swap first.
    const crossChainRecipients = recipients.filter((r) => sourceChain !== r.chain);
    const crossChainTotal = crossChainRecipients.reduce((sum, r) => sum + r.amountUsdcRaw, 0n);

    let needsDeposit = false;
    let depositAmount = 0n;
    let needsSwapToUsdc = !isSourceUsdc && crossChainTotal > 0n;

    if (crossChainTotal > 0n) {
      const requiredBalance = grossDepositAmount(crossChainTotal, sourceChain);
      const gatewayBalances = await this.gatewayService.getBalance(user.walletAddress);
      const gatewayBalance =
        gatewayBalances.find((b) => b.chain === sourceChain)?.balance ?? 0n;

      if (gatewayBalance < requiredBalance) {
        const shortfall = requiredBalance - gatewayBalance;

        if (isSourceUsdc) {
          // Check on-chain USDC balance for deposit
          const onChainUsdc = await this.gatewayService.getOnChainBalance(
            sourceChain, user.walletAddress,
          );
          if (onChainUsdc + gatewayBalance < requiredBalance) {
            throw new BadRequestException(
              `Insufficient USDC on ${sourceChain} for cross-chain: on-chain ${formatUnits(onChainUsdc, USDC_DECIMALS)} + Gateway ${formatUnits(gatewayBalance, USDC_DECIMALS)} = ${formatUnits(onChainUsdc + gatewayBalance, USDC_DECIMALS)} USDC, need ~${formatUnits(requiredBalance, USDC_DECIMALS)} USDC`,
            );
          }
          depositAmount = onChainUsdc < shortfall ? onChainUsdc : shortfall;
        } else {
          // Will swap sourceToken → USDC, then deposit
          depositAmount = shortfall;
        }
        needsDeposit = true;
      }
    }

    // Build summary
    const summary: any = {
      action: opType.toLowerCase(),
      recipients: recipients.map((r) => ({
        address: r.address,
        chain: r.chain,
        amount: r.amount,
      })),
      totalAmount: formatUnits(totalRaw, sourceDecimals),
      sourceToken: sourceTokenSymbol,
      fee: formatUnits(feeRaw, sourceDecimals),
      feePercent: actualFeePercent,
      totalDeducted: formatUnits(totalRaw + feeRaw, sourceDecimals),
      sourceChain,
      needsDeposit,
      needsSwapToUsdc,
      depositAmount: needsDeposit ? formatUnits(depositAmount, USDC_DECIMALS) : undefined,
      estimatedTime: allSameChain
        ? (needsSwapToUsdc ? '1-2 minutes' : 'instant')
        : needsDeposit ? '15-25 minutes' : '3-5 minutes',
    };

    const operation = await this.prisma.operation.create({
      data: {
        userId,
        type: opType,
        status: 'AWAITING_SIGNATURE',
        params: {
          recipients: recipients.map((r) => ({
            address: r.address,
            chain: r.chain,
            amount: r.amount,
          })),
          sourceChain,
          sourceToken: sourceTokenSymbol,
        },
        summary,
        feeAmount: formatUnits(feeRaw, sourceDecimals),
        feePercent: actualFeePercent,
      },
    });

    const signRequests: any[] = [];
    let stepIndex = 0;

    // ── Step: Swap sourceToken → USDC (if cross-chain and source is not USDC) ──
    if (needsSwapToUsdc) {
      const chainConfig = ALL_CHAINS[sourceChain];
      const usdcAddress = getUsdcAddress(sourceChain);
      const swapAmount = crossChainTotal; // amount needed in USDC for cross-chain
      // Convert to source token decimals
      const swapAmountSource = sourceDecimals > USDC_DECIMALS
        ? swapAmount * (10n ** BigInt(sourceDecimals - USDC_DECIMALS))
        : swapAmount / (10n ** BigInt(USDC_DECIMALS - sourceDecimals));
      const swapSlippage = effectiveSwapSlippage(swapAmountSource, undefined);

      const swapQuote = await this.lifiService.getQuote({
        fromChain: chainConfig.chainId,
        toChain: chainConfig.chainId,
        fromToken: sourceTokenAddress,
        toToken: usdcAddress,
        fromAmount: swapAmountSource.toString(),
        fromAddress: user.walletAddress,
        toAddress: user.walletAddress,
        slippage: swapSlippage,
      });

      const swapCalls = this.lifiService.buildSwapCalls(
        swapQuote, sourceTokenAddress, swapAmountSource,
      );
      const swapStep = await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: sourceChain,
          type: 'SWAP_TO_USDC',
          status: 'AWAITING_SIGNATURE',
          callData: swapCalls.map((c) => ({ to: c.to, data: c.data, value: c.value?.toString() })),
        },
      });

      signRequests.push({
        stepId: swapStep.id,
        chain: sourceChain,
        type: 'SWAP_TO_USDC',
        calls: swapCalls.map((c) => ({ to: c.to, data: c.data })),
        description: `Swap ${formatUnits(swapAmountSource, sourceDecimals)} ${sourceTokenSymbol} → USDC on ${sourceChain}`,
      });
    }

    // ── Step: Delegate + deposit (shared for all cross-chain recipients) ──
    const delegateNeeded =
      crossChainTotal > 0n &&
      (await getChainsNeedingDelegate(this.gatewayService,
        [sourceChain], user.walletAddress, user.delegateAddress,
      )).length > 0;

    if (needsDeposit) {
      const depositCalls = this.circleService.buildDepositCallData(sourceChain, depositAmount);
      const allCalls = delegateNeeded
        ? [...this.circleService.buildDelegateCallData(sourceChain, user.delegateAddress), ...depositCalls]
        : depositCalls;

      const depositStep = await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: sourceChain,
          type: 'APPROVE_AND_DEPOSIT',
          status: needsSwapToUsdc ? 'PENDING' : 'AWAITING_SIGNATURE',
          callData: allCalls.map((c) => ({ to: c.to, data: c.data, value: c.value?.toString() })),
        },
      });

      const desc = delegateNeeded
        ? `Add delegate + deposit ${formatUnits(depositAmount, USDC_DECIMALS)} USDC on ${sourceChain}`
        : `Approve and deposit ${formatUnits(depositAmount, USDC_DECIMALS)} USDC on ${sourceChain}`;

      if (!needsSwapToUsdc) {
        signRequests.push({
          stepId: depositStep.id,
          chain: sourceChain,
          type: 'APPROVE_AND_DEPOSIT',
          calls: allCalls.map((c) => ({ to: c.to, data: c.data })),
          description: desc,
        });
      } else {
        signRequests.push({
          stepId: depositStep.id,
          chain: sourceChain,
          type: 'APPROVE_AND_DEPOSIT',
          description: desc,
          serverSide: true,
        });
      }
    } else if (delegateNeeded) {
      const delegateCalls = this.circleService.buildDelegateCallData(sourceChain, user.delegateAddress);
      const delegateStep = await this.prisma.operationStep.create({
        data: {
          operationId: operation.id,
          stepIndex: stepIndex++,
          chain: sourceChain,
          type: 'ADD_DELEGATE',
          status: 'AWAITING_SIGNATURE',
          callData: delegateCalls.map((c) => ({ to: c.to, data: c.data })),
        },
      });

      signRequests.push({
        stepId: delegateStep.id,
        chain: sourceChain,
        type: 'ADD_DELEGATE',
        calls: delegateCalls.map((c) => ({ to: c.to, data: c.data })),
        description: `Add delegate on ${sourceChain}`,
      });
    }

    // Track swap estimates for summary
    const swapEstimates: Array<{
      recipientIndex: number;
      outputToken: string;
      estimatedOutput: string;
      minimumOutput: string;
      lifiRoute: string;
    }> = [];

    // Per-recipient steps
    for (let ri = 0; ri < recipients.length; ri++) {
      const r = recipients[ri];
      const isSameChain = sourceChain === r.chain;

      if (isSameChain) {
        // Same chain: direct transfer of sourceToken (no Gateway needed)
        // If recipient wants a different token (outputToken), swap via LiFi
        // Check if outputToken is actually a different token by looking up both in TOKEN_REGISTRY
        const destTokenEntry = r.outputToken ? getTokenByAddress(r.outputToken, r.chain) : null;
        const isSameToken = !r.outputToken
          || r.outputToken.toLowerCase() === sourceTokenAddress.toLowerCase()
          || (destTokenEntry && destTokenEntry === sourceTokenInfo);

        if (!isSameToken) {
          // Same chain, different output token → LiFi swap
          const chainConfig = ALL_CHAINS[r.chain];
          const swapSlippage = effectiveSwapSlippage(r.amountRaw, r.slippage);
          const swapQuote = await this.lifiService.getQuote({
            fromChain: chainConfig.chainId,
            toChain: chainConfig.chainId,
            fromToken: sourceTokenAddress,
            toToken: r.outputToken!,
            fromAmount: r.amountRaw.toString(),
            fromAddress: user.walletAddress,
            toAddress: r.address,
            slippage: swapSlippage,
          });

          const swapCalls = this.lifiService.buildSwapCalls(
            swapQuote, sourceTokenAddress, r.amountRaw,
          );
          const swapStep = await this.prisma.operationStep.create({
            data: {
              operationId: operation.id,
              stepIndex: stepIndex++,
              chain: r.chain,
              type: 'LIFI_SWAP',
              status: 'AWAITING_SIGNATURE',
              callData: swapCalls.map((c) => ({ to: c.to, data: c.data, value: c.value?.toString() })),
            },
          });

          signRequests.push({
            stepId: swapStep.id,
            chain: r.chain,
            type: 'LIFI_SWAP',
            calls: swapCalls.map((c) => ({ to: c.to, data: c.data })),
            description: `Swap ${r.amount} ${sourceTokenSymbol} → ${swapQuote.action.toToken.symbol} → ${r.address} on ${r.chain}`,
          });

          swapEstimates.push({
            recipientIndex: ri,
            outputToken: swapQuote.action.toToken.symbol,
            estimatedOutput: formatUnits(BigInt(swapQuote.estimate.toAmount), r.outputTokenDecimals ?? 18),
            minimumOutput: formatUnits(BigInt(swapQuote.estimate.toAmountMin), r.outputTokenDecimals ?? 18),
            lifiRoute: swapQuote.tool,
          });
        } else {
          // Same chain, same token → direct ERC20 transfer
          const step = await this.prisma.operationStep.create({
            data: {
              operationId: operation.id,
              stepIndex: stepIndex++,
              chain: sourceChain,
              type: 'TRANSFER',
              status: 'AWAITING_SIGNATURE',
              callData: { type: 'erc20_transfer', token: sourceTokenSymbol, to: r.address, amount: r.amountRaw.toString() },
            },
          });

          const transferCalls = [{
            to: sourceTokenAddress,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [r.address as `0x${string}`, r.amountRaw],
            }),
          }];

          signRequests.push({
            stepId: step.id,
            chain: sourceChain,
            type: 'TRANSFER',
            calls: transferCalls,
            description: `Transfer ${r.amount} ${sourceTokenSymbol} to ${r.address}`,
          });
        }
      } else {
        // Cross-chain: burn on source → mint on destination
        // Check if outputToken on dest chain is actually a different token
        const crossDestEntry = r.outputToken ? getTokenByAddress(r.outputToken, r.chain) : null;
        const crossNeedsSwap = r.outputToken
          && !(crossDestEntry && crossDestEntry === sourceTokenInfo)
          && r.outputToken.toLowerCase() !== getUsdcAddress(r.chain).toLowerCase();
        const mintRecipient = crossNeedsSwap ? user.walletAddress : r.address;

        const burnStep = await this.prisma.operationStep.create({
          data: {
            operationId: operation.id,
            stepIndex: stepIndex++,
            chain: sourceChain,
            type: 'BURN_INTENT',
            status: 'PENDING',
            burnIntentData: {
              sourceChain,
              destinationChain: r.chain,
              amount: r.amountRaw.toString(),
              depositor: user.walletAddress,
              recipient: mintRecipient,
            },
          },
        });

        await this.prisma.operationStep.create({
          data: {
            operationId: operation.id,
            stepIndex: stepIndex++,
            chain: r.chain,
            type: 'MINT',
            status: 'PENDING',
          },
        });

        signRequests.push({
          stepId: burnStep.id,
          chain: sourceChain,
          type: 'BURN_INTENT',
          description: `Burn ${r.amount} USDC → ${crossNeedsSwap ? 'swap on' : r.address + ' on'} ${r.chain}`,
          serverSide: true,
        });

        // Add LIFI_SWAP step if dest token is different
        if (crossNeedsSwap) {
          const destChain = ALL_CHAINS[r.chain];
          const destUsdcAddress = getUsdcAddress(r.chain);
          const swapSlippage = effectiveSwapSlippage(r.amountRaw, r.slippage);

          try {
            const estimateQuote = await this.lifiService.getQuote({
              fromChain: destChain.chainId,
              toChain: destChain.chainId,
              fromToken: destUsdcAddress,
              toToken: r.outputToken!,
              fromAmount: r.amountRaw.toString(),
              fromAddress: user.walletAddress,
              toAddress: r.address,
              slippage: swapSlippage,
            });

            // Same-chain optimization: skip burn/mint if user has enough on-chain USDC
            const isSameChain = sourceChain === r.chain;
            let directSwap = false;
            if (isSameChain && isSingle) {
              const onChainUsdc = await this.gatewayService.getOnChainBalance(r.chain, user.walletAddress);
              if (onChainUsdc >= r.amountRaw) directSwap = true;
            }

            if (directSwap) {
              const swapCalls = this.lifiService.buildSwapCalls(estimateQuote, destUsdcAddress, r.amountRaw);
              const swapStep = await this.prisma.operationStep.create({
                data: {
                  operationId: operation.id,
                  stepIndex: stepIndex++,
                  chain: r.chain,
                  type: 'LIFI_SWAP',
                  status: 'AWAITING_SIGNATURE',
                  callData: swapCalls.map((c) => ({ to: c.to, data: c.data, value: c.value?.toString() })),
                },
              });

              signRequests.push({
                stepId: swapStep.id,
                chain: r.chain,
                type: 'LIFI_SWAP',
                calls: swapCalls.map((c) => ({ to: c.to, data: c.data })),
                description: `Swap ${r.amount} USDC → ${estimateQuote.action.toToken.symbol} on ${r.chain}`,
              });

              // Mark burn/mint steps as SKIPPED
              await this.prisma.operationStep.updateMany({
                where: { operationId: operation.id, type: { in: ['BURN_INTENT', 'MINT'] } },
                data: { status: 'SKIPPED' },
              });
              const burnIdx = signRequests.findIndex((sr) => sr.type === 'BURN_INTENT');
              if (burnIdx !== -1) signRequests.splice(burnIdx, 1);
            } else {
              const swapStep = await this.prisma.operationStep.create({
                data: {
                  operationId: operation.id,
                  stepIndex: stepIndex++,
                  chain: r.chain,
                  type: 'LIFI_SWAP',
                  status: 'PENDING',
                  burnIntentData: {
                    outputToken: r.outputToken,
                    outputTokenDecimals: r.outputTokenDecimals ?? 18,
                    slippage: swapSlippage,
                    recipientAddress: r.address,
                    usdcAmount: r.amountRaw.toString(),
                  },
                },
              });

              signRequests.push({
                stepId: swapStep.id,
                chain: r.chain,
                type: 'LIFI_SWAP',
                description: `Swap USDC → ${estimateQuote.action.toToken.symbol} → ${r.address} on ${r.chain} (after mint)`,
                serverSide: false,
                pendingMint: true,
              });
            }

            swapEstimates.push({
              recipientIndex: ri,
              outputToken: estimateQuote.action.toToken.symbol,
              estimatedOutput: formatUnits(BigInt(estimateQuote.estimate.toAmount), r.outputTokenDecimals ?? 18),
              minimumOutput: formatUnits(BigInt(estimateQuote.estimate.toAmountMin), r.outputTokenDecimals ?? 18),
              lifiRoute: estimateQuote.tool,
            });
          } catch (lifiError) {
            this.logger.warn(`LiFi quote failed for recipient ${ri}: ${lifiError.message}`);
            throw new BadRequestException(
              `LiFi swap not available for ${r.outputToken} on ${r.chain}: ${lifiError.message}`,
            );
          }
        }
      }
    }

    // Enrich summary with swap estimates
    if (swapEstimates.length > 0) {
      summary.swapEstimates = swapEstimates;
      summary.estimatedTime = '20-30 minutes';
      await this.prisma.operation.update({
        where: { id: operation.id },
        data: { summary },
      });
    }

    await this.prisma.operation.update({
      where: { id: operation.id },
      data: { signRequests },
    });

    const freshOp = await this.prisma.operation.findUnique({ where: { id: operation.id } });

    return {
      id: operation.id,
      type: opType,
      status: 'AWAITING_SIGNATURE',
      summary: freshOp?.summary ?? summary,
      signRequests,
    };
  }

  async refreshSwapQuote(userId: string, operationId: string) {
    const operation = await this.prisma.operation.findFirst({
      where: { id: operationId, userId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        user: true,
      },
    });

    if (!operation) throw new NotFoundException('Operation not found');

    if (operation.status !== 'AWAITING_SIGNATURE') {
      throw new BadRequestException(
        `Operation is in ${operation.status} state, cannot refresh swap`,
      );
    }

    const swapStep = operation.steps.find(
      (s) => s.type === 'LIFI_SWAP' && s.status === 'AWAITING_SIGNATURE',
    );

    if (!swapStep) {
      throw new BadRequestException('No LIFI_SWAP step awaiting signature');
    }

    const params = swapStep.burnIntentData as any;
    if (!params?.outputToken) {
      throw new BadRequestException('LIFI_SWAP step missing outputToken params');
    }

    const chain = swapStep.chain;
    const chainConfig = ALL_CHAINS[chain];
    if (!chainConfig) {
      throw new BadRequestException(`Unknown chain ${chain}`);
    }

    const usdcAddress = getUsdcAddress(chain);

    // Get fresh LiFi quote
    const quote = await this.lifiService.getQuote({
      fromChain: chainConfig.chainId,
      toChain: chainConfig.chainId,
      fromToken: usdcAddress,
      toToken: params.outputToken,
      fromAmount: params.usdcAmount,
      fromAddress: operation.user.walletAddress,
      toAddress: params.recipientAddress,
      slippage: effectiveSwapSlippage(BigInt(params.usdcAmount), params.slippage),
    });

    const swapCalls = this.lifiService.buildSwapCalls(
      quote,
      usdcAddress,
      BigInt(params.usdcAmount),
    );

    // Update step with fresh calldata
    await this.prisma.operationStep.update({
      where: { id: swapStep.id },
      data: {
        callData: swapCalls.map((c) => ({
          to: c.to,
          data: c.data,
          value: c.value?.toString(),
        })),
      },
    });

    // Update operation signRequests with fresh calls
    const signRequests = [
      {
        stepId: swapStep.id,
        chain,
        type: 'LIFI_SWAP',
        calls: swapCalls.map((c) => ({
          to: c.to,
          data: c.data,
          ...(c.value ? { value: c.value.toString() } : {}),
        })),
        description: `Swap USDC → ${quote.action.toToken.symbol} on ${chain}`,
      },
    ];

    await this.prisma.operation.update({
      where: { id: operationId },
      data: { signRequests },
    });

    this.logger.log(
      `Refreshed LiFi quote for operation ${operationId}, step ${swapStep.id} — ${quote.tool} route`,
    );

    return {
      id: operationId,
      status: 'AWAITING_SIGNATURE',
      signRequests,
      quote: {
        tool: quote.tool,
        estimatedOutput: quote.estimate.toAmount,
        minimumOutput: quote.estimate.toAmountMin,
        outputToken: quote.action.toToken.symbol,
      },
    };
  }
}
