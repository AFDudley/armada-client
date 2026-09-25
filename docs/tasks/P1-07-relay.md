# P1-07 `relay` package

Depends on: P1-03, P1-04, P1-06. Read `docs/SPEC.md` D3, D4, D5.

## Goal
relayer-v2's validation pipeline, ported without Express/Postgres/Railgun-engine, verifying fees with armada-sdk and
accepting exactly two call shapes: `pool.transact` and `adjudicator.depositFromNote`.

## Read first (kelce `~/code/git_puller/repos/armada-relayer/relayer-v2/actor/src/`)
- `relay/privacy-relay.ts` — the pipeline; keep its step order (lines 82–190).
- `relay/broadcaster-fee-verifier.ts`, `relay/selectors.ts`, `relay/fee-calculator.ts` (only `FeeSchedule`,
  `resolve`, `advertisedFee`), `relay/dedup-cache.ts`, `http/errors.ts` (codes + HTTP statuses).
- `vendor/armada-sdk/src/tx/decode.ts` (`decodeTransact`, `extractFeeOutput`), and how a verifier obtains its
  `ReceiverNoteKeys` from a root secret (`src/wallet/`, `BroadcasterIdentity` in `src/tx/index.ts`).

## Deliver
`packages/relay/` (`@armada-client/relay`):
- `errors.ts`: `RelayError` with codes and statuses copied from `http/errors.ts` (drop none).
- `fee-schedule.ts`: `StaticFeeSchedule` issuing `{cacheId, expiresAt, chainId, broadcasterRailgunAddress, fees}`
  from config fees (`transfer`, `unshield`; other relayer-v2 fee keys emitted as `"0"`), `cacheId` format
  `fee-<chainId>-<ms>-<counter>`, one-deep previous retention and `resolve(chainId, cacheId)` with the relayer-v2 grace
  rule (`expiresAt + feeTtlSeconds × feeBufferBps / 10000` ms).
- `verify-fee.ts`: `verifyFee(ctx, to, data, advertised)`: for `transact` decode `data` directly; for `depositFromNote`
  first convert with `depositFromNoteToTransact` (P1-04); then `extractFeeOutput(decoded[0], relayerKeys, tokenDataGetter, chain, { tokenAddress: usdc, minValue: advertised })`;
  `undefined` → `RelayError('FEE_INSUFFICIENT')`; any decode error → `FEE_INSUFFICIENT` (fail closed, as relayer-v2).
- `pipeline.ts`: `Relay.relay(req)` with relayer-v2's `RelayRequest`/`RelayResult` shapes and steps: chain → target
  allowlist (`{pool, adjudicator}`) → fee cache → selector allowlist (`transact`, `depositFromNote`) → fee verify
  (advertised = `min(transfer, unshield)` for both selectors) → lock → gas estimate → dedup → submit (gas × 1.2).
- `submitter.ts`: `EthersSubmitter` (ethers `Wallet` + `JsonRpcProvider`) implementing relayer-v2's `RelaySubmitter`
  (per-chain lock, `estimateGas`, `submit`).

## Acceptance
Unit tests in `packages/relay/test/`, each seen failing first:
- step order: an unlisted target is rejected `INVALID_TARGET` before any fee check; an unknown selector `INVALID_DATA`;
  an unknown `feesCacheId` `FEE_EXPIRED`;
- fee verification uses **real calldata** captured from the P1-06 fork run: rerun the fork check with a quote whose
  broadcaster is a fixed relayer identity and fee = 5000 (0.005 USDC); save the resulting calldata to
  `packages/relay/test/fixtures/deposit-fee-5000.json` with a provenance note (fork block, commit, command). Tests:
  advertised 5000 passes; advertised 5001 → `FEE_INSUFFICIENT`; verifying with a different relayer identity →
  `FEE_INSUFFICIENT`.
```sh
npm run check
```

## Out of scope
HTTP server (P1-08). Waku (phase 2). Dynamic fee pricing. Gasless/yield/cross-chain selectors.
