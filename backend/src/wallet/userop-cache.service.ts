import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export interface PendingUserOp {
  userId: string;
  chain: string;
  unsignedUserOp: Record<string, any>;
  entryPointAddress: string;
  entryPointVersion: string;
  createdAt: number;
}

const CACHE_TTL_MS = 120_000;

@Injectable()
export class UserOpCacheService {
  private readonly logger = new Logger(UserOpCacheService.name);
  private readonly pending = new Map<string, PendingUserOp>();

  store(requestId: string, data: Omit<PendingUserOp, 'createdAt'>): void {
    this.pending.set(requestId, { ...data, createdAt: Date.now() });
  }

  get(requestId: string): PendingUserOp | undefined {
    return this.pending.get(requestId);
  }

  remove(requestId: string): boolean {
    return this.pending.delete(requestId);
  }

  @Interval(60_000)
  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, op] of this.pending) {
      if (now - op.createdAt > CACHE_TTL_MS) {
        this.pending.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired pending UserOps`);
    }
  }
}
