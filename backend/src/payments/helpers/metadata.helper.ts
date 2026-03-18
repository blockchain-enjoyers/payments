import { SettlementState } from '../types/settlement.types';

export function getSettlement(payment: { metadata?: unknown }): SettlementState | null {
  if (!payment.metadata || typeof payment.metadata !== 'object') return null;
  const meta = payment.metadata as Record<string, unknown>;
  if (!meta.settlement || typeof meta.settlement !== 'object') return null;
  return meta.settlement as SettlementState;
}

export function updateSettlement(
  currentMetadata: unknown,
  changes: Partial<SettlementState>,
): Record<string, unknown> {
  const meta = (currentMetadata && typeof currentMetadata === 'object'
    ? { ...(currentMetadata as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  const settlement = (meta.settlement && typeof meta.settlement === 'object'
    ? { ...(meta.settlement as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  Object.assign(settlement, changes);
  meta.settlement = settlement;
  return meta;
}
