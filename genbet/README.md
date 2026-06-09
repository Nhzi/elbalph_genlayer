# GenBet

Sports + casino on **GenLayer** — bet at the speed of AI consensus.

- **Sports book.** Anyone lists a real-world match with a public results URL. Bettors back HOME / DRAW / AWAY into pari-mutuel pools. On `resolve`, the contract fetches the page with `gl.nondet.web`, asks an LLM to extract the winner, and validators independently reproduce the result — no oracle, no admin.
- **Casino.** Coinflip, dice, roulette, slots. Every round is seeded from on-chain entropy (transaction time + sender + monotonic nonce + GenVM stdin) so all validators agree on the outcome without trusting the leader. Bets settle in a single transaction.
- **Three.js hero animations.** Coin flip, dice roll, roulette wheel, slot reels — animated with React Three Fiber + drei, snapping to the result the contract returns.

The frontend is **Next.js (App Router) + Tailwind + `genlayer-js` + three.js**. We confirm transactions at `ACCEPTED` status (not `FINALIZED`) so the UI feels sub-second; finality lands in the background.

## Layout

```
genbet/
├── contracts/
│   ├── sportsbook.py        # AI-resolved pari-mutuel markets
│   └── casino.py            # Provably-fair coinflip/dice/roulette/slots
├── tests/direct/            # pytest direct-mode tests (no server needed)
├── deploy/001_deploy.ts     # Deploys both, seeds bankroll, lists demo markets
├── frontend/                # Next.js + genlayer-js + three.js
│   ├── app/                 # /, /sports, /casino, /casino/<game>
│   ├── components/three/    # CoinFlip3D, Dice3D, Roulette3D, SlotMachine3D
│   └── lib/                 # genlayer client, contract wrappers
├── gltest.config.yaml
└── requirements.txt
```

## Run it locally (GLSim, fastest path)

GLSim is a lightweight in-process simulator — no Docker, starts in ~1s. Best for iteration.

```bash
# 1. install Python tooling
pip install -r requirements.txt

# 2. (optional) lint contracts before testing
genvm-lint check contracts/sportsbook.py
genvm-lint check contracts/casino.py

# 3. run direct-mode tests (no server needed)
pytest tests/direct/ -v

# 4. start the simulator on :4000
glsim --port 4000 --validators 5

# 5. in another terminal: deploy + seed demo data
#    (uses the GenLayer CLI; install once with `npm install -g genlayer`)
genlayer deploy

# 6. start the frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The deploy script writes `frontend/.env.local` with both contract addresses, so the frontend picks them up automatically.

## Run against local Studio (Docker)

Want real GenVM + the Studio inspector?

```bash
npm install -g genlayer
genlayer init
genlayer up
# RPC at http://localhost:4000/api, Studio UI at http://localhost:8080
genlayer deploy
cd frontend && npm install && npm run dev
```

## Tests

```bash
pytest tests/direct/ -v
```

Tests use mocked `web` + `llm` responses (see `direct_vm.mock_web` / `direct_vm.mock_llm`) so the same `resolve()` path that hits BBC in production hits a fixture in tests.

## How the sports book settles

`Sportsbook.resolve(market_id)` runs an LLM extraction inside `gl.eq_principle.strict_eq`:

1. `gl.nondet.web.get(resolution_url)` — fetch the score page (BBC by default, but any public page works).
2. `gl.nondet.exec_prompt(...)` — extract `{winner, score}` as JSON.
3. Strict equality across validators on the sorted JSON string.
4. Pari-mutuel payout: `stake * total_pool / winning_pool`, claimed lazily by the bettor.

If `winner == -1` (game not finished), the call is a no-op — the market stays open and anyone can re-trigger `resolve` later.

## How the casino randomness works

`Casino._next_seed()` hashes:
- transaction `datetime` (deterministic across validators — see [Transaction Context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context))
- sender + contract address
- a per-call monotonic `nonce`

All four are identical for every validator re-executing the same transaction, so the SHA-256 digest — and the game result — match exactly. No oracle, no `run_nondet_unsafe`, no trust in the leader. (The docs' Random page also shows a stdin-based seed, but `os` is on the GenVM's forbidden-import list, so we stick to the always-available transaction context.)

The bankroll lives in `self.balance`. Every payable game method pre-checks that `self.balance - stake >= max_payout` before accepting the bet, so the house can never run dry.

## Pylance warnings on the contracts

Pylance can't resolve `from genlayer import *` because the runtime is provided by the GenVM at execution time, not pip. Once you `pip install -r requirements.txt` the SDK types resolve. The official `WizardOfCoin` example uses the exact same import pattern.

## Targeting testnet

Set the rpc and a funded private key in `gltest.config.yaml`, fund your account at the [testnet faucet](https://testnet-faucet.genlayer.foundation/), then:

```bash
NEXT_PUBLIC_GENLAYER_RPC=https://genlayer-testnet.rpc.caldera.xyz/http \
  genlayer deploy --network testnet_asimov
```
