'use client';

import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { simulator, localnet } from 'genlayer-js/chains';
import type { GenLayerClient, GenLayerChain } from 'genlayer-js/types';

const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC ?? 'http://localhost:4000/api';

// Pick a chain preset; GLSim and the local Studio both expose the same JSON-RPC
// surface, so either preset works against http://localhost:4000/api.
const chain: GenLayerChain = (() => {
  try {
    return { ...simulator, rpcUrls: { default: { http: [RPC] } } } as GenLayerChain;
  } catch {
    return { ...localnet, rpcUrls: { default: { http: [RPC] } } } as GenLayerChain;
  }
})();

// Lazy singleton so React Fast Refresh doesn't spawn extra clients.
let _client: GenLayerClient | null = null;
let _account: ReturnType<typeof createAccount> | null = null;

export function getAccount() {
  if (typeof window === 'undefined') return null;
  if (_account) return _account;

  const KEY = 'genbet:pk';
  let pk = window.localStorage.getItem(KEY);
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    // generatePrivateKey returns the raw 0x-prefixed 32-byte hex we need to
    // persist; createAccount's returned viem account doesn't expose it.
    pk = generatePrivateKey();
    window.localStorage.setItem(KEY, pk);
  }
  _account = createAccount(pk as `0x${string}`);
  return _account;
}

export function getClient(): GenLayerClient {
  if (_client) return _client;
  const account = getAccount();
  _client = createClient({
    chain,
    endpoint: RPC,
    ...(account ? { account } : {}),
  });
  return _client;
}

export const SPORTSBOOK_ADDRESS = (process.env.NEXT_PUBLIC_SPORTSBOOK_ADDRESS ?? '') as `0x${string}`;
export const CASINO_ADDRESS = (process.env.NEXT_PUBLIC_CASINO_ADDRESS ?? '') as `0x${string}`;

export function gen(n: number | bigint): bigint {
  // 1 GEN = 10^18 wei
  if (typeof n === 'bigint') return n * 10n ** 18n;
  // Avoid float precision issues: multiply via string.
  const [whole, frac = ''] = String(n).split('.');
  const padded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded || '0');
}

export function fmtGen(wei: string | bigint, places = 2): string {
  const v = typeof wei === 'bigint' ? wei : BigInt(wei || '0');
  const whole = v / 10n ** 18n;
  const frac = v % 10n ** 18n;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(18, '0').slice(0, places).replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
