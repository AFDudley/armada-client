# P1-06 `wallet` package

Depends on: P1-02, P1-03, P1-04, P1-05. Read `docs/SPEC.md` D2, D8.

## Goal
A shielded wallet over armada-sdk that can shield USDC, sync, report balance, and build a relayer-ready
`depositFromNote` call whose unshield is bound to a channel — proven with a real proof on the fork.

## Read first
- `vendor/armada-sdk/src/index.ts` (`ArmadaSdkConfig`, `createArmadaSdk`), `src/sdk.ts` (instance `wallet`,
  `fromRootSecret`, `sync`, `balances`, `planTransfer`, `prove`), `src/tx/index.ts` (`FeeQuote`, `ProofHandle`),
  `src/tx/serialize.ts` (`transactionToTuple`), `src/tx/shield.ts` (`buildShieldRequest`, `generateShieldPrivateKey`),
  `src/storage/level.ts` (`LevelStorageAdapter`), `src/prover/artifact-source.ts` (`HttpArtifactSource` and its options).
- The working end-to-end reference: kelce `~/code/git_puller/repos/armada-poc/scripts/capture/e2e-facade-differential.ts`
  (sync → planTransfer → prove → submit).
- The adapter-bound unshield reference: `~/code/git_puller/repos/armada-interface/src/lib/shielded/yield-sdk.ts:97-169`
  (`planTransfer({ outputs: [], unshield: { recipient, amount, adaptContract, adaptParams }, tokenAddress, fee })`,
  `wallet.prove(plan)`, `transactionToTuple(handle.toTransactionData())`).

## Deliver
`packages/wallet/` (`@armada-client/wallet`):

```ts
import type { ClientConfig } from '@armada-client/config';
export interface RelayerFeeQuote {           // relayer-v2 GET /fees wire format
  cacheId: string; expiresAt: number; chainId: number;
  broadcasterRailgunAddress: string;
  fees: Record<string, string>;
}
export interface ChannelDepositCall { to: `0x${string}`; data: `0x${string}`; feesCacheId: string }
export interface ClientWallet {
  readonly shieldedAddress: string;                        // 0zk address
  sync(): Promise<void>;
  usdcBalance(): Promise<{ spendable: bigint; pending: bigint }>;
  shield(signer: import('ethers').Signer, amount: bigint): Promise<`0x${string}`>;   // approve + pool.shield; returns tx hash after 1 confirmation
  buildChannelDeposit(p: { channelId: `0x${string}`; expectedHeld: bigint; amount: bigint; quote: RelayerFeeQuote }): Promise<ChannelDepositCall>;
  close(): Promise<void>;
}
export function openWallet(config: ClientConfig, rootSecret: Uint8Array, name: string): Promise<ClientWallet>;
```
- Storage: `LevelStorageAdapter` over `classic-level` at `<dataDir>/wallets/<name>`.
- Prover: `createSnarkjsProver()`. Artifacts: `HttpArtifactSource(config.armada.artifactsBaseUrl, …)` with the manifest
  copied to `packages/wallet/circuits.manifest.json` from `armada-interface/src/config/circuits.manifest.json` at
  `158933c` (record the source in a `circuits.manifest.SOURCE` file), cached on disk under `<dataDir>/artifacts`.
- `buildChannelDeposit`: unshield `amount` to `recipient = adaptContract = config.nitroRailgun.adjudicator` with
  `adaptParams = depositBinding(channelId, expectedHeld)`; relayer fee paid to `quote.broadcasterRailgunAddress` in USDC
  at `min(fees.transfer, fees.unshield)` (relayer-v2 charges transact-shaped calls that way: `advertisedFeeKeys` in
  `armada-relayer/relayer-v2/actor/src/relay/selectors.ts:73-76`); `data = encodeDepositFromNote(channelId, expectedHeld, tuple)`.
  Read `src/sdk.ts` to find the instance `planTransfer` fee parameter shape and map the quote onto it; report the mapping.

## Acceptance (on the fork from P1-05, config `data/fork.config.json` written by `scripts/fork-config.mjs`; paste output)
`packages/wallet/scripts/fork-check.ts`, run with `npx tsx`, using anvil account 1 as the EOA and a fixed root secret:
1. shield 100 USDC; sync until spendable > 0; print spendable (it equals the amount net of the pool's shield fee —
   read that fee from the pool's `Shield` event in the receipt and assert equality);
2. build a channel deposit (random channelId, expectedHeld 0, amount 10 USDC, quote with zero fees and this
   wallet's own address as broadcaster) and send `data` to the adjudicator from anvil account 1;
3. assert `adjudicator.holdings(usdc, channelId)` = 10 USDC via `cast call` (independent of this code).
Step 2 must produce a real Groth16 proof accepted by the demo3 verifier. Report proof time.

## Out of scope
Relayer submission (P1-07/P1-09). Channels beyond the deposit call.
