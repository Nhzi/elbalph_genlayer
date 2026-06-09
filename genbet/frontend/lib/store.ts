'use client';

import { create } from 'zustand';
import type { CasinoRound, SportsMarket } from './contracts';

type State = {
  address: `0x${string}` | null;
  balanceWei: bigint;
  recent: CasinoRound[];
  markets: SportsMarket[];
  setAddress: (a: `0x${string}` | null) => void;
  setBalance: (b: bigint) => void;
  setRecent: (r: CasinoRound[]) => void;
  setMarkets: (m: SportsMarket[]) => void;
};

export const useStore = create<State>((set) => ({
  address: null,
  balanceWei: 0n,
  recent: [],
  markets: [],
  setAddress: (address) => set({ address }),
  setBalance: (balanceWei) => set({ balanceWei }),
  setRecent: (recent) => set({ recent }),
  setMarkets: (markets) => set({ markets }),
}));
