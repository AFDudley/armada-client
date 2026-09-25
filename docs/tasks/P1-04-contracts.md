# P1-04 `contracts` package

Depends on: P1-01. Read `docs/SPEC.md` D10.

## Goal
Typed access to the armada-nitro contracts and the encoders the wallet and relayer need.

## Read first
- kelce `~/src/armada-nitro/src/ArmadaNitroAdjudicator.sol` (`depositBinding`, `depositFromNote`, `SHIELD`).
- kelce `~/src/armada-nitro/out/ArmadaNitroAdjudicator.sol/ArmadaNitroAdjudicator.json` and
  `out/HubCustodian.sol/HubCustodian.json` (field `abi`).
- `vendor/armada-sdk/src/tx/decode.ts` (`TRANSACTION_STRUCT`, `TRANSACT_ABI`).

## Deliver
- `scripts/sync-abis.mjs <armada-nitro-root>`: copies the `abi` arrays into `packages/contracts/abi/ArmadaNitroAdjudicator.json`
  and `HubCustodian.json`, and writes `packages/contracts/abi/SOURCE.json` = `{ "repo": "AFDudley/armada-nitro", "commit": "<git rev-parse HEAD of that root>" }`.
  Run it against kelce `~/src/armada-nitro` at `f1a1de4` and commit the outputs.
- `packages/contracts/` (`@armada-client/contracts`) exporting:

```ts
export const adjudicatorAbi: readonly object[];
export const custodianAbi: readonly object[];
export const SHIELD_ALLOCATION_TYPE = 3;
/** keccak256(abi.encode(bytes32 channelId, uint256 expectedHeld)) — ArmadaNitroAdjudicator.depositBinding */
export function depositBinding(channelId: `0x${string}`, expectedHeld: bigint): `0x${string}`;
/** calldata for depositFromNote(channelId, expectedHeld, [transaction]) */
export function encodeDepositFromNote(channelId: `0x${string}`, expectedHeld: bigint, transaction: unknown): `0x${string}`;
/** Re-encodes the Transaction embedded in depositFromNote calldata as pool transact([tx]) calldata. */
export function depositFromNoteToTransact(calldata: `0x${string}`): `0x${string}`;
export const DEPOSIT_FROM_NOTE_SELECTOR: `0x${string}`;
```
`transaction` is the tuple produced by armada-sdk `transactionToTuple` (see `vendor/armada-sdk/src/tx/serialize.ts`).
Use ethers 6 `Interface`/`AbiCoder`.

## Acceptance
Tests in `packages/contracts/test/`, each seen failing first. Expected values come from `cast` (Foundry is on kelce at
`~/.foundry/bin`), computed in your shell and pasted into the test with the command in a comment:
- `depositBinding` for three (channelId, expectedHeld) pairs equals
  `cast keccak $(cast abi-encode "f(bytes32,uint256)" <id> <held>)`;
- `DEPOSIT_FROM_NOTE_SELECTOR` equals `cast sig "depositFromNote(bytes32,uint256,<Transaction tuple>[])"` — copy the
  tuple type from the ABI;
- `depositFromNoteToTransact(encodeDepositFromNote(id, held, tx))` decodes with armada-sdk `decodeTransact` to the
  same nullifiers/commitments as `tx` (build `tx` by hand with small values; this checks round-trip wiring).
```sh
npm run check
```

## Out of scope
Deploying contracts. TypeChain.
