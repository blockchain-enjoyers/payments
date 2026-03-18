export type SettlementPhase =
  | 'SWAP_TO_USDC'            // Swap payer's non-USDC token → USDC on source chain
  | 'APPROVE_DEPOSIT'         // Approve + deposit USDC to Gateway on source chain
  | 'BURN_INTENT'             // Submit burn intent (delegate EIP-712 signature)
  | 'MINT'                    // Execute mint on destination chain
  | 'SWAP_TO_MERCHANT_TOKEN'  // Swap USDC → merchant's requested token on dest chain
  | 'COMPLETED'
  | 'FAILED';

export interface SettlementState {
  [key: string]: unknown;
  phase: SettlementPhase;
  sourceChain: string;
  destChain: string;
  amount: string;              // raw amount in payer's token
  usdcAmount?: string;         // raw USDC amount (after swap or = amount if USDC)
  payerToken: string;          // token the payer sent (e.g. 'WETH')
  merchantToken: string;       // token the merchant wants (e.g. 'USDC')
  depositTxHash?: string;
  swapToUsdcTxHash?: string;
  swapToMerchantTxHash?: string;
  mintedAmount?: string;       // raw USDC minted on dest chain (after gateway fee)
  attestation?: string;
  operatorSignature?: string;
  mintTxHash?: string;
  error?: string;
  retries: number;
}

export interface BurnIntentData {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  depositor: string;
  recipient: string;
}

export interface LifiSwapStepData {
  outputToken: string;
  usdcAmount: string;
  recipientAddress: string;
  slippage?: number;
}
