export interface ChainConfig {
  chainId: number;
  rpcs: string[];
  usdc: string;
  explorer: string;
  gatewayDomain?: number;
  aaSupported?: boolean;
  finalitySeconds: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/** Helper to construct ChainConfig objects. */
function chain(c: ChainConfig): ChainConfig {
  return c;
}

/**
 * Chains supporting BOTH Circle AA and Gateway (full cross-chain flow)
 * Polygon = hub chain (primary liquidity hub)
 */
export const AA_GATEWAY_CHAINS: Record<string, ChainConfig> = {
  polygon: chain({
    chainId: 137,
    rpcs: [
      'https://polygon.drpc.org',
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-public.nodies.app',
      'https://polygon-mainnet.rpcfast.com?api_key=xbhWBI1Wkguk8SNMu1bvvLurPGLXmgwYeC4S6g2H7WdwFigZSmPWVZRxrskEQwIf',
      'https://gateway.tenderly.co/public/polygon',
      'https://polygon-mainnet.gateway.tatum.io',
      'https://polygon.gateway.tenderly.co',
      'https://go.getblock.io/02667b699f05444ab2c64f9bff28f027',
      'https://rpc-mainnet.matic.quiknode.pro',
      'https://rpc.sentio.xyz/matic',
      'https://api.zan.top/polygon-mainnet',
      'https://polygon.rpc.subquery.network/public'

    ],
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    explorer: 'https://polygonscan.com',
    gatewayDomain: 7,
    aaSupported: true,
    finalitySeconds: 180,
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  }),
  avalanche: chain({
    chainId: 43114,
    rpcs: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.drpc.org',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://avalanche-public.nodies.app/ext/bc/C/rpc',
      'https://1rpc.io/avax/c',
      'https://avax.meowrpc.com',
      'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc',
      'https://endpoints.omniatech.io/v1/avax/mainnet/public',
      'https://avalanche.api.onfinality.io/public/ext/bc/C/rpc',
      'https://avalanche-mainnet.gateway.tenderly.co',
      'https://avalanche.rpc.subquery.network/public',
    ],
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    explorer: 'https://snowtrace.io',
    gatewayDomain: 1,
    aaSupported: true,
    finalitySeconds: 30,
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  }),
  base: chain({
    chainId: 8453,
    rpcs: [
      'https://mainnet.base.org',
      'https://base.drpc.org',
      'https://base-rpc.publicnode.com',
      'https://base-public.nodies.app',
      'https://1rpc.io/base',
      'https://base.meowrpc.com',
      'https://base-mainnet.public.blastapi.io',
      'https://base.llamarpc.com',
      'https://base.api.onfinality.io/public',
      'https://endpoints.omniatech.io/v1/base/mainnet/public',
      'https://base.rpc.subquery.network/public',
    ],
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorer: 'https://basescan.org',
    gatewayDomain: 6,
    aaSupported: true,
    finalitySeconds: 1200,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  }),
  optimism: chain({
    chainId: 10,
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism.drpc.org',
      'https://optimism-rpc.publicnode.com',
      'https://optimism-public.nodies.app',
      'https://1rpc.io/op',
      'https://optimism.meowrpc.com',
      'https://optimism-mainnet.public.blastapi.io',
      'https://optimism.api.onfinality.io/public',
      'https://endpoints.omniatech.io/v1/op/mainnet/public',
      'https://optimism.rpc.subquery.network/public',
    ],
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    explorer: 'https://optimistic.etherscan.io',
    gatewayDomain: 2,
    aaSupported: true,
    finalitySeconds: 1200,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  }),
  arbitrum: chain({
    chainId: 42161,
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.drpc.org',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arbitrum-one-public.nodies.app',
      'https://1rpc.io/arb',
      'https://arbitrum.meowrpc.com',
      'https://arbitrum-one.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/arbitrum/one/public',
      'https://arbitrum.rpc.subquery.network/public',
    ],
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    explorer: 'https://arbiscan.io',
    gatewayDomain: 3,
    aaSupported: true,
    finalitySeconds: 1200,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  }),
};

/**
 * Chains supporting Circle AA only (no Gateway)
 */
export const AA_ONLY_CHAINS: Record<string, ChainConfig> = {};

/**
 * Chains supporting Gateway only (no AA)
 */
export const GATEWAY_ONLY_CHAINS: Record<string, ChainConfig> = {};

/**
 * Hub chain key.
 *
 * OmniFlow will run on Arc as the production hub. Arc advantages over any
 * alternative hub chain:
 *
 *  - 1-second finality → deposits and payouts settle instantly on the hub,
 *    no waiting for block confirmations.
 *  - Native USDC as base asset → the hub holds only issuer-native USDC,
 *    eliminating bridged/wrapped token risk entirely.
 *  - Circle Gas Station → all hub transactions are gas-sponsored, users
 *    never need native tokens on the hub chain.
 *  - Deep Circle stack integration → Modular Wallets, Gateway (CCTP V2),
 *    Bundler, and Gas Station are all first-class citizens on Arc.
 *  - USDC issuer's own L1 → maximum trust for the chain where all
 *    protocol liquidity rests.
 *
 * The full flow is validated end-to-end on Arc testnet. For the mainnet demo
 * (with real liquidity) we stage on Polygon while Arc mainnet is not yet
 * available. The architecture is chain-agnostic: switching the hub requires
 * changing only this constant — zero other code changes.
 */
export const HUB_CHAIN = 'polygon';

export const GATEWAY_CHAINS: Record<string, ChainConfig> = {
  ...AA_GATEWAY_CHAINS,
  ...GATEWAY_ONLY_CHAINS,
};

export const AA_CHAINS: Record<string, ChainConfig> = {
  ...AA_GATEWAY_CHAINS,
  ...AA_ONLY_CHAINS,
};

export const ALL_CHAINS: Record<string, ChainConfig> = {
  ...AA_GATEWAY_CHAINS,
  ...AA_ONLY_CHAINS,
  ...GATEWAY_ONLY_CHAINS,
};

// Apply env var overrides: RPC_POLYGON=url1,url2 overrides default rpcs
for (const [key, config] of Object.entries(ALL_CHAINS)) {
  const envVal = process.env[`RPC_${key.toUpperCase()}`];
  if (envVal) {
    config.rpcs = envVal.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

export type SupportedChain = keyof typeof ALL_CHAINS;
export type GatewayChain = keyof typeof GATEWAY_CHAINS;

export function getChainByDomain(
  domain: number,
): ChainConfig | undefined {
  return Object.values(GATEWAY_CHAINS).find(
    (c) => c.gatewayDomain === domain,
  );
}

export function getChainKeyByDomain(domain: number): string | undefined {
  return Object.entries(GATEWAY_CHAINS).find(
    ([, c]) => c.gatewayDomain === domain,
  )?.[0];
}

export function supportsFullFlow(chainKey: string): boolean {
  return chainKey in AA_GATEWAY_CHAINS;
}

export function getUsdcAddress(chainKey: string): string {
  const chain = ALL_CHAINS[chainKey];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }
  return chain.usdc;
}

// ── Multi-token registry ──────────────────────────────────────────────

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  /** Token address per chain (only chains where token exists) */
  addresses: Partial<Record<string, string>>;
  /** CoinGecko ID for price feeds (future use) */
  coingeckoId?: string;
}

/**
 * Supported tokens across all chains.
 * USDC is the settlement token — all other tokens are swapped to/from USDC
 * during payment processing via LiFi.
 */
export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
    coingeckoId: 'usd-coin',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
    coingeckoId: 'tether',
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    addresses: {
      polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      avalanche: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
      base: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      optimism: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    },
    coingeckoId: 'dai',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    addresses: {
      polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      avalanche: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      base: '0x4200000000000000000000000000000000000006',
      optimism: '0x4200000000000000000000000000000000000006',
      arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
    coingeckoId: 'weth',
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    addresses: {
      polygon: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      avalanche: '0x50b7545627a5162F82A992c33b87aDc75187B218',
      base: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      optimism: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      arbitrum: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    },
    coingeckoId: 'wrapped-bitcoin',
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    addresses: {
      polygon: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
      avalanche: '0x5947BB275c521040051D82396f893270992a78ab',
      base: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
      optimism: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
      arbitrum: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    },
    coingeckoId: 'chainlink',
  },
  UNI: {
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    addresses: {
      polygon: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
      base: '0xc3De830EA07524a0761646a6a4e4be0e114a3C83',
      optimism: '0x6fd9d7AD17242c41f7131d257212c54A0e816691',
      arbitrum: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    },
    coingeckoId: 'uniswap',
  },
  AAVE: {
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    addresses: {
      polygon: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
      avalanche: '0x63a72806098Bd3D9520cC43356dD78afe5D386D9',
      base: '0x64c79fcE50E25Ea56FDaAE00E3e277fD09CF7865',
      optimism: '0x76FB31fb4af56892A25e32cFC43De717950c9278',
      arbitrum: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196',
    },
    coingeckoId: 'aave',
  },
};

/**
 * Get token info by symbol.
 */
export function getTokenInfo(symbol: string): TokenInfo | undefined {
  return TOKEN_REGISTRY[symbol.toUpperCase()];
}

/**
 * Get token address on a specific chain.
 */
export function getTokenAddress(symbol: string, chainKey: string): string | undefined {
  const token = TOKEN_REGISTRY[symbol.toUpperCase()];
  return token?.addresses[chainKey];
}

/**
 * Resolve token info from an on-chain address on a given chain.
 */
export function getTokenByAddress(address: string, chainKey: string): TokenInfo | undefined {
  const lower = address.toLowerCase();
  return Object.values(TOKEN_REGISTRY).find(
    (t) => t.addresses[chainKey]?.toLowerCase() === lower,
  );
}

/**
 * Get all tokens available on a specific chain.
 */
export function getTokensForChain(chainKey: string): TokenInfo[] {
  return Object.values(TOKEN_REGISTRY).filter(
    (t) => chainKey in t.addresses,
  );
}
