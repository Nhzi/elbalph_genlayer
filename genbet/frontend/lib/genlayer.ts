'use client';

import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { localnet, testnetAsimov } from 'genlayer-js/chains';
import type { GenLayerClient, GenLayerChain } from 'genlayer-js/types';

const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC ?? 'http://localhost:4000/api';

// Pick the chain that matches the configured RPC so chain.id / consensus
// contract address line up. Falls back to localnet for local dev.
const isLocal = /localhost|127\.0\.0\.1/.test(RPC);
const baseChain: GenLayerChain = (isLocal ? localnet : testnetAsimov) as GenLayerChain;
const chain: GenLayerChain = {
  ...baseChain,
  rpcUrls: { default: { http: [RPC] } },
} as GenLayerChain;

export const CHAIN_ID = chain.id;
export const CHAIN_ID_HEX = `0x${chain.id.toString(16)}`;

export type WalletMode = 'ANON' | 'MKMC';

type AnonAccount = ReturnType<typeof createAccount>;

const PK_KEY = 'elbalph:pk';
const MODE_KEY = 'elbalph:mode';

let _client: GenLayerClient<any> | null = null;
let _anonAccount: AnonAccount | null = null;
let _activeMode: WalletMode | null = null;
let _injectedAddress: `0x${string}` | null = null;

export function getMode(): WalletMode {
  if (typeof window === 'undefined') return 'ANON';
  const stored = window.localStorage.getItem(MODE_KEY);
  return stored === 'MKMC' ? 'MKMC' : 'ANON';
}

export function setMode(mode: WalletMode) {
  if (typeof window !== 'undefined') window.localStorage.setItem(MODE_KEY, mode);
  _activeMode = null;
  _client = null;
}

function loadAnonAccount(): AnonAccount {
  if (_anonAccount) return _anonAccount;
  let pk = window.localStorage.getItem(PK_KEY);
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    window.localStorage.setItem(PK_KEY, pk);
  }
  _anonAccount = createAccount(pk as `0x${string}`);
  return _anonAccount;
}

export function getAnonAddress(): `0x${string}` | null {
  if (typeof window === 'undefined') return null;
  return loadAnonAccount().address as `0x${string}`;
}

export function getInjectedAddress(): `0x${string}` | null {
  return _injectedAddress;
}

function setInjectedAddress(addr: `0x${string}` | null) {
  if (_injectedAddress?.toLowerCase() !== addr?.toLowerCase()) {
    _injectedAddress = addr;
    _client = null;
  }
}

export function hasInjectedProvider(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ethereum;
}

export async function connectInjected(): Promise<`0x${string}`> {
  if (!hasInjectedProvider()) {
    throw new Error('No injected wallet detected. Install MetaMask (or another wallet) and reload.');
  }
  const eth = (window as any).ethereum;
  const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No accounts returned from the wallet.');
  const addr = accounts[0] as `0x${string}`;

  const current: string = await eth.request({ method: 'eth_chainId' });
  if (current !== CHAIN_ID_HEX) {
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err: any) {
      // 4902 = chain not added to the wallet yet; add then switch.
      if (err?.code === 4902 || /not been added|Unrecognized chain/i.test(err?.message ?? '')) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: chain.name,
              rpcUrls: [RPC],
              nativeCurrency: (chain as any).nativeCurrency ?? {
                name: 'GEN', symbol: 'GEN', decimals: 18,
              },
              blockExplorerUrls: (chain as any).blockExplorers?.default?.url
                ? [(chain as any).blockExplorers.default.url]
                : [],
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }

  setInjectedAddress(addr);
  return addr;
}

export function disconnectInjected() {
  setInjectedAddress(null);
}

export function subscribeInjected(onChange: (addr: `0x${string}` | null) => void): () => void {
  if (!hasInjectedProvider()) return () => {};
  const eth = (window as any).ethereum;
  const handleAccounts = (accs: string[]) => {
    const next = (accs?.[0] ?? null) as `0x${string}` | null;
    setInjectedAddress(next);
    onChange(next);
  };
  const handleChain = () => {
    _client = null;
    onChange(_injectedAddress);
  };
  eth.on?.('accountsChanged', handleAccounts);
  eth.on?.('chainChanged', handleChain);
  return () => {
    eth.removeListener?.('accountsChanged', handleAccounts);
    eth.removeListener?.('chainChanged', handleChain);
  };
}

export function getActiveAddress(): `0x${string}` | null {
  const mode = getMode();
  if (mode === 'MKMC') return _injectedAddress;
  return getAnonAddress();
}

export function getClient(): GenLayerClient<any> {
  const mode = getMode();
  if (_client && _activeMode === mode) return _client;
  _activeMode = mode;

  if (mode === 'MKMC') {
    _client = createClient({
      chain,
      endpoint: RPC,
      ...(typeof window !== 'undefined' ? { provider: (window as any).ethereum } : {}),
      ...(_injectedAddress ? { account: _injectedAddress } : {}),
    });
  } else {
    const account = typeof window !== 'undefined' ? loadAnonAccount() : null;
    _client = createClient({
      chain,
      endpoint: RPC,
      ...(account ? { account } : {}),
    });
  }
  return _client;
}

export const SPORTSBOOK_ADDRESS = (process.env.NEXT_PUBLIC_SPORTSBOOK_ADDRESS ?? '') as `0x${string}`;
export const CASINO_ADDRESS = (process.env.NEXT_PUBLIC_CASINO_ADDRESS ?? '') as `0x${string}`;
export const ELF_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_ELF_TOKEN_ADDRESS ?? '') as `0x${string}`;

export function gen(n: number | bigint): bigint {
  if (typeof n === 'bigint') return n * 10n ** 18n;
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

// ELF and GEN both use 18 decimals — alias for readability at call sites.
export const elf = gen;
export const fmtElf = fmtGen;
