'use client';

import { create } from 'zustand';
import type { CasinoRound, SportsMarket } from './contracts';
import type { WalletMode } from './genlayer';

type State = {
  address: `0x${string}` | null;
  balanceWei: bigint;
  elfBalanceWei: bigint;
  hasClaimedFaucet: boolean;
  mode: WalletMode;
  recent: CasinoRound[];
  markets: SportsMarket[];
  setAddress: (a: `0x${string}` | null) => void;
  setBalance: (b: bigint) => void;
  setElfBalance: (b: bigint) => void;
  setHasClaimedFaucet: (v: boolean) => void;
  setMode: (m: WalletMode) => void;
  setRecent: (r: CasinoRound[]) => void;
  setMarkets: (m: SportsMarket[]) => void;
};

export const useStore = create<State>((set) => ({
  address: null,
  balanceWei: 0n,
  elfBalanceWei: 0n,
  hasClaimedFaucet: false,
  mode: 'ANON',
  recent: [],
  markets: [],
  setAddress: (address) => set({ address }),
  setBalance: (balanceWei) => set({ balanceWei }),
  setElfBalance: (elfBalanceWei) => set({ elfBalanceWei }),
  setHasClaimedFaucet: (hasClaimedFaucet) => set({ hasClaimedFaucet }),
  setMode: (mode) => set({ mode }),
  setRecent: (recent) => set({ recent }),
  setMarkets: (markets) => set({ markets }),
}));
