import { Injectable, Logger } from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  http,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { ALL_CHAINS, type ChainConfig } from './config/chains';

@Injectable()
export class RpcService {
  private readonly logger = new Logger(RpcService.name);
  private readonly clientCache = new Map<string, PublicClient>();

  /** Build a viem fallback transport from the chain's rpcs list. */
  getTransport(chainKey: string): Transport {
    const config = this.getConfig(chainKey);
    const transports = config.rpcs.map((url) =>
      http(url, { timeout: 10_000, retryCount: 1, retryDelay: 500 }),
    );
    return fallback(transports, { rank: true });
  }

  /** Cached PublicClient with fallback transport. */
  getPublicClient(chainKey: string): PublicClient {
    let client = this.clientCache.get(chainKey);
    if (!client) {
      client = createPublicClient({ transport: this.getTransport(chainKey) });
      this.clientCache.set(chainKey, client);
      this.logger.log(
        `Created PublicClient for ${chainKey} with ${this.getConfig(chainKey).rpcs.length} RPCs`,
      );
    }
    return client;
  }

  /** WalletClient with fallback transport (not cached — account varies). */
  getWalletClient(chainKey: string, account: any): WalletClient {
    const config = this.getConfig(chainKey);
    const viemChain = defineChain({
      id: config.chainId,
      name: chainKey,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: {
        default: { http: config.rpcs },
      },
    });
    return createWalletClient({
      account,
      chain: viemChain,
      transport: this.getTransport(chainKey),
    });
  }

  /**
   * Raw JSON-RPC fetch with sequential fallback across rpcs.
   * Retries on 429 (rate limit), network errors, and non-OK responses.
   */
  async rpcFetch(chainKey: string, body: object): Promise<any> {
    const config = this.getConfig(chainKey);
    let lastError: Error | undefined;

    for (const url of config.rpcs) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.status === 429) {
          this.logger.warn(`RPC rate limited: ${url}`);
          lastError = new Error(`429 from ${url}`);
          continue;
        }

        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status} from ${url}`);
          this.logger.warn(`RPC error ${res.status}: ${url}`);
          continue;
        }

        return await res.json();
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`RPC fetch failed for ${url}: ${err.message}`);
        continue;
      }
    }

    throw lastError || new Error(`All RPCs failed for ${chainKey}`);
  }

  private getConfig(chainKey: string): ChainConfig {
    const config = ALL_CHAINS[chainKey];
    if (!config) throw new Error(`Unknown chain: ${chainKey}`);
    return config;
  }
}
