'use client';

import { TransactionStatus } from 'genlayer-js/types';
import type { TransactionHash } from 'genlayer-js/types';
import { getClient, SPORTSBOOK_ADDRESS, CASINO_ADDRESS, ELF_TOKEN_ADDRESS } from './genlayer';

/**
 * Thin wrappers around `client.readContract` / `client.writeContract`.
 *
 * Read methods return immediately (no fee). Write methods return a transaction
 * hash; we then wait for status === 'ACCEPTED' rather than 'FINALIZED' so the
 * UI feels instant — finality lands a few seconds later in the background.
 */

export type SportsMarket = {
  market_id: number;
  home: string;
  away: string;
  league: string;
  resolution_url: string;
  kickoff_unix: number;
  pool_home: string;
  pool_draw: string;
  pool_away: string;
  winner: number;
  score: string;
  resolved: boolean;
};

export type SportsBet = {
  bet_id: number;
  bettor: string;
  market_id: number;
  outcome: number;
  stake: string;
  claimed: boolean;
};

export type CasinoRound = {
  round_id: number;
  bettor: string;
  game: number;
  stake: string;
  payout: string;
  seed_hex: string;
  detail: any;
  ts_unix: number;
};

async function waitAccepted(hash: `0x${string}`) {
  const client = getClient();
  return client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status: TransactionStatus.ACCEPTED,
  });
}

// ────────────────────────────── Sportsbook ──────────────────────────────────

export async function listMarkets(): Promise<SportsMarket[]> {
  const client = getClient();
  return (await client.readContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'list_markets',
    args: [],
  })) as SportsMarket[];
}

export async function getMarket(marketId: number): Promise<SportsMarket | null> {
  const client = getClient();
  const r = (await client.readContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'get_market',
    args: [marketId],
  })) as SportsMarket;
  return r && (r as any).market_id ? r : null;
}

export async function placeSportsBet(marketId: number, outcome: 0 | 1 | 2, valueWei: bigint) {
  const client = getClient();
  const hash = await client.writeContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'place_bet',
    args: [marketId, outcome],
    value: valueWei,
  });
  const receipt = await waitAccepted(hash);
  return { hash, receipt };
}

export async function resolveMarket(marketId: number) {
  const client = getClient();
  const hash = await client.writeContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'resolve',
    args: [marketId],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return { hash, receipt };
}

export async function claimSportsBet(betId: number) {
  const client = getClient();
  const hash = await client.writeContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'claim',
    args: [betId],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return { hash, receipt };
}

export async function myBets(addr: `0x${string}`): Promise<SportsBet[]> {
  const client = getClient();
  return (await client.readContract({
    address: SPORTSBOOK_ADDRESS,
    functionName: 'my_bets',
    args: [addr],
  })) as SportsBet[];
}

// ──────────────────────────────── Casino ────────────────────────────────────

export async function playCoinflip(callHeads: boolean, valueWei: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_coinflip',
    args: [callHeads],
    value: valueWei,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playDice(targetUnder: number, valueWei: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_dice',
    args: [targetUnder],
    value: valueWei,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playRoulette(
  betType: 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high',
  betValue: number,
  valueWei: bigint,
): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_roulette',
    args: [betType, betValue],
    value: valueWei,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playSlots(valueWei: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_slots',
    args: [],
    value: valueWei,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

// ────────── Gasless ELF-denominated casino plays ──────────
// Mirror the GEN-payable play_* writes but pass stake as an ELF amount and
// send `value: 0n`. The casino burns the stake from the user's ELF balance
// and mints any payout back. No GEN ever leaves the player's wallet.

export async function playCoinflipElf(callHeads: boolean, stakeElf: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_coinflip_elf',
    args: [callHeads, stakeElf.toString()],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playDiceElf(targetUnder: number, stakeElf: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_dice_elf',
    args: [targetUnder, stakeElf.toString()],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playRouletteElf(
  betType: 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high',
  betValue: number,
  stakeElf: bigint,
): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_roulette_elf',
    args: [betType, betValue, stakeElf.toString()],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function playSlotsElf(stakeElf: bigint): Promise<CasinoRound> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CASINO_ADDRESS,
    functionName: 'play_slots_elf',
    args: [stakeElf.toString()],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return extractReturn(receipt);
}

export async function recentRounds(limit = 20): Promise<CasinoRound[]> {
  const client = getClient();
  return (await client.readContract({
    address: CASINO_ADDRESS,
    functionName: 'recent',
    args: [limit],
  })) as CasinoRound[];
}

export async function houseBalance(): Promise<string> {
  const client = getClient();
  return (await client.readContract({
    address: CASINO_ADDRESS,
    functionName: 'house_balance',
    args: [],
  })) as string;
}

export async function getBalance(addr: `0x${string}`): Promise<bigint> {
  const client = getClient();
  return client.getBalance({ address: addr });
}

// ─────────────────────────────── ELF token ─────────────────────────────────

export async function elfBalanceOf(addr: `0x${string}`): Promise<string> {
  if (!ELF_TOKEN_ADDRESS) return '0';
  const client = getClient();
  return (await client.readContract({
    address: ELF_TOKEN_ADDRESS,
    functionName: 'balance_of',
    args: [addr],
  })) as string;
}

export async function elfHasClaimed(addr: `0x${string}`): Promise<boolean> {
  if (!ELF_TOKEN_ADDRESS) return false;
  const client = getClient();
  return (await client.readContract({
    address: ELF_TOKEN_ADDRESS,
    functionName: 'has_claimed',
    args: [addr],
  })) as boolean;
}

export async function elfClaimFaucet() {
  const client = getClient();
  const hash = await client.writeContract({
    address: ELF_TOKEN_ADDRESS,
    functionName: 'claim_faucet',
    args: [],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return { hash, receipt };
}

export async function elfTransfer(to: `0x${string}`, amount: bigint) {
  const client = getClient();
  const hash = await client.writeContract({
    address: ELF_TOKEN_ADDRESS,
    functionName: 'transfer',
    args: [to, amount.toString()],
    value: 0n,
  });
  const receipt = await waitAccepted(hash);
  return { hash, receipt };
}

function extractReturn(receipt: any): any {
  // genlayer-js surfaces the contract's return value on the receipt under
  // `result` for accepted transactions; fall back to common alternates.
  return receipt?.result ?? receipt?.decodedReturn ?? receipt;
}
