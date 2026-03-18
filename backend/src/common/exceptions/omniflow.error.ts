import { HttpException } from '@nestjs/common';

export class OmniFlowError extends HttpException {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(code: string, message: string, httpStatus: number, details: Record<string, unknown> = {}) {
    super({ error: code, message, details }, httpStatus);
    this.code = code;
    this.details = details;
  }
}

export class InsufficientBalanceError extends OmniFlowError {
  constructor(chain: string, token: string, have: string, need: string) {
    super('INSUFFICIENT_BALANCE', `Insufficient ${token} on ${chain}: have ${have}, need ${need}`, 400, { chain, token, have, need });
  }
}

export class BundlerRejectError extends OmniFlowError {
  constructor(reason: string, chain: string) {
    super('BUNDLER_REJECTED', `Bundler rejected UserOp on ${chain}: ${reason}`, 502, { reason, chain });
  }
}

export class GatewayTimeoutError extends OmniFlowError {
  constructor(operationId: string, timeout: number) {
    super('GATEWAY_TIMEOUT', `Gateway attestation timed out after ${timeout}s for operation ${operationId}`, 504, { operationId, timeout });
  }
}

export class SwapFailedError extends OmniFlowError {
  constructor(reason: string, token: string) {
    super('SWAP_FAILED', `Swap failed for ${token}: ${reason}`, 502, { reason, token });
  }
}

export class DelegateNotAuthorizedError extends OmniFlowError {
  constructor(chain: string) {
    super('DELEGATE_NOT_AUTHORIZED', `Delegate not authorized on ${chain}. Run delegate setup first.`, 400, { chain });
  }
}

export class SettlementPhaseError extends OmniFlowError {
  constructor(phase: string, paymentId: string, reason?: string) {
    super('SETTLEMENT_PHASE_ERROR', `Settlement phase ${phase} failed for payment ${paymentId}${reason ? ': ' + reason : ''}`, 500, { phase, paymentId, reason });
  }
}
