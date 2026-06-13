/**
 * Deploys Sportsbook + Casino against the active GenLayer network, then funds
 * the casino bankroll and seeds a couple of demo sports markets so the frontend
 * has something to render the moment you `npm run dev`.
 *
 * Run from the project root with:
 *   genlayer deploy
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from 'genlayer-js/types';
import { testnetBradbury } from 'genlayer-js/chains';

const GEN = (n: number | bigint) =>
  typeof n === 'bigint' ? n * 10n ** 18n : BigInt(n) * 10n ** 18n;

export default async function main(client: GenLayerClient<any>) {
  console.log('🎲  Deploying GenBet…');

  await client.initializeConsensusSmartContract();

  const sportsbook = await deployContract(client, 'contracts/sportsbook.py', []);
  const casino = await deployContract(client, 'contracts/casino.py', []);
  const elfToken = await deployContract(client, 'contracts/elf_token.py', []);

  // Add casino (bankroll) + sportsbook as ELF minters so they can settle bets.
  console.log('🪙  Authorizing casino + sportsbook as ELF minters…');
  for (const addr of [casino, sportsbook]) {
    const tx = await client.writeContract({
      address: elfToken as `0x${string}`,
      functionName: 'add_minter',
      args: [addr],
    });
    await client.waitForTransactionReceipt({ hash: tx, retries: 200 });
  }

  // Tell the casino where the ELF token lives so it can settle gasless bets.
  console.log('🔗  Wiring casino → ELF token…');
  const wireTx = await client.writeContract({
    address: casino as `0x${string}`,
    functionName: 'set_elf_token',
    args: [elfToken],
  });
  await client.waitForTransactionReceipt({ hash: wireTx, retries: 200 });

  // Seed the house bankroll so the very first bet doesn't trip the
  // "house bankroll too small" guard.
  console.log('💰  Funding casino bankroll with 50 GEN…');
  const fundTx = await client.writeContract({
    address: casino as `0x${string}`,
    functionName: 'fund_house',
    args: [],
    value: GEN(50),
  });
  await client.waitForTransactionReceipt({ hash: fundTx, retries: 200 });

  // Two demo sports markets so the UI isn't empty.
  console.log('⚽  Seeding demo sports markets…');
  const inOneHour = Math.floor(Date.now() / 1000) + 3600;
  const inOneDay = Math.floor(Date.now() / 1000) + 86400;
  const today = new Date().toISOString().slice(0, 10);

  for (const m of [
    {
      home: 'Real Madrid',
      away: 'Barcelona',
      league: 'La Liga',
      url: `https://www.bbc.com/sport/football/scores-fixtures/${today}`,
      kickoff: inOneHour,
    },
    {
      home: 'Brazil',
      away: 'Argentina',
      league: 'Friendly',
      url: `https://www.bbc.com/sport/football/scores-fixtures/${today}`,
      kickoff: inOneDay,
    },
  ]) {
    const hash = await client.writeContract({
      address: sportsbook as `0x${string}`,
      functionName: 'create_market',
      args: [m.home, m.away, m.league, m.url, m.kickoff],
    });
    await client.waitForTransactionReceipt({ hash, retries: 200 });
  }

  // Persist addresses where the frontend (and humans) can find them.
  const outDir = path.resolve(process.cwd(), 'frontend');
  mkdirSync(outDir, { recursive: true });
  const envPath = path.join(outDir, '.env.local');
  writeFileSync(
    envPath,
    [
      `NEXT_PUBLIC_GENLAYER_RPC=${process.env.NEXT_PUBLIC_GENLAYER_RPC ?? 'http://localhost:4000/api'}`,
      `NEXT_PUBLIC_SPORTSBOOK_ADDRESS=${sportsbook}`,
      `NEXT_PUBLIC_CASINO_ADDRESS=${casino}`,
      `NEXT_PUBLIC_ELF_TOKEN_ADDRESS=${elfToken}`,
      '',
    ].join('\n'),
  );

  console.log('✅  Done.');
  console.log({ sportsbook, casino, elfToken, envFile: envPath });
}

async function deployContract(
  client: GenLayerClient<any>,
  contractPath: string,
  args: any[] = [],
): Promise<string> {
  const filePath = path.resolve(process.cwd(), contractPath);
  const code = new Uint8Array(readFileSync(filePath));

  const tx = await client.deployContract({ code, args });
  const receipt = await client.waitForTransactionReceipt({
    hash: tx as TransactionHash,
    retries: 200,
  });

  const statusName = (receipt as any).statusName ?? (receipt as any).status_name;
  if (
    statusName !== TransactionStatus.ACCEPTED &&
    statusName !== TransactionStatus.FINALIZED
  ) {
    throw new Error(`Deployment failed for ${contractPath}: ${JSON.stringify(receipt)}`);
  }

  const r = receipt as any;
  const safe = (v: any) =>
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val), 2);
  console.log('DEBUG full receipt:', safe(r).slice(0, 2000));
  const address =
    r?.data?.contract_address ??
    r?.data?.contractAddress ??
    r?.txDataDecoded?.contractAddress ??
    r?.toAddress ??
    r?.to_address;
  if (!address || /^0x0+$/i.test(address)) {
    throw new Error(`bad address for ${contractPath}: ${address}`);
  }

  console.log(`📦  ${contractPath} → ${address}`);
  return address as string;
}
