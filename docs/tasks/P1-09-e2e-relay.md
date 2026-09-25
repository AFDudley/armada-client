# P1-09 E2E relay gate

Depends on: P1-05, P1-08. Read `docs/SPEC.md` §5 (this task is the phase-1 acceptance gate).

## Goal
A stack job that drives the built daemon and CLI against the fork: a user funds a channel through the relayer with a
real proof, and the relayer is paid in a shielded note. Same job, pointed at Sepolia, differs only in config.

## Deliver
- `stack/container-build/cerc-armada-client/` (`Dockerfile`, `build.sh`): image with Node 18.20.4 and the built repo.
- Pod `armada-relayer`: runs `armada-client daemon` with a config generated from `/deployments/fork.json`.
- Job `armada-e2e-relay` (a TypeScript script in `apps/daemon/e2e/relay.ts` run in that image) that:
  1. user wallet (fixed root secret) shields 100 USDC from anvil account 1 via the CLI;
  2. fetches `GET /fees` from the relayer pod;
  3. builds a channel deposit (random channelId, expectedHeld 0, 10 USDC) paying the advertised fee; `POST /relay`;
  4. waits for `GET /status/:txHash` = `confirmed`;
  5. checks on chain with `eth_call` (not through the wallet code): `adjudicator.holdings(usdc, channelId)` = 10 USDC;
  6. the relayer wallet syncs and its USDC spendable balance rose by exactly the advertised fee;
  7. negative branch: a deposit paying `advertised - 1` → HTTP 402 `FEE_INSUFFICIENT`, and holdings for that
     channelId stay 0;
  8. prints a JSON summary and exits non-zero on any mismatch.
- `TARGET` job env (`fork` default, `sepolia`) selecting the config; on `sepolia` the job skips account funding and
  reads keys from mounted files. Document in `stack/README.md`.

## Acceptance
Run on kelce: build, start, `run-job armada-fork-setup`, `run-job armada-e2e-relay`; paste the summary. Then disable
the fee check (make `verifyFee` return early) in a scratch copy, rebuild, rerun: step 7 must fail. Revert and report
both runs.

## Out of scope
Sepolia broadcast (needs funds). Waku.
