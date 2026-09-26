# armada-client — specification

One TypeScript codebase for three roles — shielded **wallet**, channel **watchtower**, transaction **relayer** — shipped
as a Linux daemon and as iOS/Android apps. The phone apps run the same Node code inside nodejs-mobile, the way
Railway (Railgun's wallet) does. Tasks are executed by `localfirst` workers; each task brief in `docs/tasks/` is
self-contained.

## 1. Decisions

| # | Decision | Why (evidence) |
|---|---|---|
| D1 | **Runtime: Node 18.20.4 everywhere.** The daemon and the phone run the same code on the same Node. | Mobile embeds Node via `nodejs-mobile-react-native` 18.20.4, the latest release (npm, 2024-10-07); Railway ships it (`Railway-Wallet/mobile/package.json:61`, `nodejs-project/package.json` `engines: node 18`). Testing on 18.20.4 tests what the phone runs. |
| D2 | **Wallet core: `armada-sdk`, unmodified.** | Its crypto is byte-identical to `@railgun-community/engine@9.6.0` (`armada-sdk/NOTICE.md`; diff of `utils/encryption/*`, `ecies.ts`, `poseidon.ts`, `scalar-multiply.ts`, `keys-utils.ts`, `hash.ts`, `bytes.ts`, `note/memo.ts` = 0 lines). Ports: `StorageAdapter`, `ProverAdapter`, `ArtifactSource` (`src/index.ts:71`). No crypto is forked. |
| D3 | **Relayer: port relayer-v2's pipeline; verify fees with `armada-sdk`.** HTTP wire format stays compatible with relayer-v2. | Pipeline order in `armada-relayer/relayer-v2/actor/src/relay/privacy-relay.ts:82-190`. `armada-sdk` exports `decodeTransact` + `extractFeeOutput` for verifiers (`src/tx/decode.ts:134,155`), so no second Railgun engine is needed (relayer-v2 uses `@railgun-community/engine` 9.5.1). |
| D4 | **Relayer scope: `pool.transact` and `ArmadaNitroAdjudicator.depositFromNote` only.** Gasless shield, yield adapter, cross-chain unshield and CCTP jobs are out of scope. | Only paths this system uses. |
| D5 | **Relayer fees: static schedule from config** (USDC raw per operation). Dynamic pricing is out of scope. | Testnet targets; no price feeds needed. |
| D6 | **Channels: `ts-nitro` `nitro-node`, transport replaced by Waku.** | `MessageService` is a 3-method interface (`ts-nitro/packages/nitro-node/src/node/engine/messageservice/messageservice.ts`); the adjudicator address is configuration (`eth-chainservice.ts:67`). |
| D7 | **Peer-to-peer: Waku light node, `@waku/sdk` 0.0.36 + `@waku/discovery` 0.0.13.** | The versions `@railgun-community/waku-broadcaster-client-node` 9.1.1 uses; Railway runs it on Node 18 inside nodejs-mobile. |
| D8 | **Storage: LevelDB through `abstract-level`** (`classic-level` on Linux). | `armada-sdk` `LevelStorageAdapter` and ts-nitro `DurableStore` both use level; Railway uses LevelDB on mobile (`leveldown-nodejs-mobile`). |
| D9 | **Ethereum library: ethers 6.** | Used by `armada-sdk` (^6.14) and relayer-v2 (6.17). |
| D10 | **Contracts: `AFDudley/armada-nitro` at `f1a1de4`**; ABIs copied from its forge `out/`. | The adjudicator (`depositFromNote`, `SHIELD` = 3) and `HubCustodian`. |
| D11 | **Every build ships the relayer, disabled by default.** The daemon and every mobile app contain the relay package; it runs only when the config sets `relayer.enabled: true`. | One codebase for all roles (§ intro); a phone can act as a relayer by configuration, never by default. |

## 2. Layout

```
armada-client/
  package.json            npm workspaces: packages/*, apps/*, vendor/armada-sdk
  .nvmrc                  18.20.4
  tsconfig.base.json
  vendor/armada-sdk/      git submodule, ship-armada/armada-sdk @ a77ceeb
  packages/config/        @armada-client/config    — config file loading/validation
  packages/contracts/     @armada-client/contracts — armada-nitro ABIs + encoders
  packages/wallet/        @armada-client/wallet    — armada-sdk wrapper
  packages/relay/         @armada-client/relay     — relay pipeline + HTTP handlers
  apps/daemon/            @armada-client/daemon    — `armada-client` CLI and daemon
  stack/                  laconic stack-orchestrator external stack: the daemon pod and e2e jobs, run against the
                          armada-nitro environment
  data/                   git-ignored: configs generated from armada-nitro deployment manifests (P1-05), wallets
  docs/SPEC.md, docs/tasks/*.md
```

Conventions: ESM (`"type": "module"`), TypeScript 5 compiled by `tsc` (`module`/`moduleResolution` `NodeNext`,
`target` `ES2022`, `strict`). Tests use `node:test` run as `node --import tsx --test`. No other test framework. No
Express, no Postgres: HTTP uses `node:http`.

## 3. External pins

| Thing | Pin |
|---|---|
| Node | 18.20.4, installed on kelce at `~/.local/node-v18.20.4-linux-x64` |
| armada-sdk | `ship-armada/armada-sdk` `a77ceeb` (submodule) |
| armada-nitro | `AFDudley/armada-nitro` (contracts, ABIs, and the test environment); commit pinned when its environment lands |
| Armada deployment | Sepolia `demo3`: pool `0x5f3324b47b3CFf937BB67C30B362898E193e5216`, USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, deploy block `11588108`, chain id `11155111` |
| Circuit artifacts | base `https://circuits.knowable.run/v0.1.0-dev`, manifest `armada-interface/src/config/circuits.manifest.json` @ `158933c` (release `v0.1.0-dev`) |
| Test environment | The armada-nitro environment: a laconic-so fixturenet (real geth + lighthouse) brought to the target state by armada-nitro's reconciler, then Sepolia brought to the same state by the same reconciler |
| Reference code (read-only) | kelce `~/code/git_puller/repos/`: `armada-relayer`, `armada-sdk`, `armada-interface`, `ts-nitro`, `waku-broadcaster-client`, `Railway-Wallet` |

## 4. Networks

armada-client builds no chain environment of its own. It runs against the **armada-nitro environment**: one target
state (Circle USDC, Aave v3 with its StataToken wrapper over that USDC, Lido wstETH, WETH, Armada's pool with the `demo3`
verification keys, armada-nitro contracts) reached by armada-nitro's reconciler on (1) a laconic-so fixturenet and
then (2) Sepolia. The reconciler writes a deployment manifest per network; armada-client derives its config from that
manifest (P1-05). Switching target = switching manifest. Everything is proven on the fixturenet before Sepolia.

## 5. Verification policy

- **Done = the e2e gate is green.** The gate is the stack-orchestrator e2e job driving the built daemon and CLI against
  the armada-nitro fixturenet. Unit tests are the inner loop for localizing failures, never acceptance.
- **Expected values come from outside the code under test**: the chain (receipts, events, balances, `eth_call`
  results), an independent tool (`cast`), or the specification. Never a value produced by running the implementation.
  Fixtures of external formats must be captured from the real system and carry a provenance note (command, block,
  commit).
- **Mock only real boundaries** (network egress in unit tests). Never mock armada-sdk, ethers, or internal modules.
- **Every test must be seen failing** for the right reason before it passes (red first), and each security check
  (fee verification, allowlist, binding) needs a negative case.
- **No exception lists, no skipped tests, no retries to green.**

## 6. Worker protocol (localfirst)

1. Work on kelce in `~/code/git_puller/repos/armada-client`, on branch `task/<id>` from `main`. Use Node 18.20.4:
   `export PATH=$HOME/.local/node-v18.20.4-linux-x64/bin:$PATH`.
2. Do only what the brief says. If a fact in the brief is wrong (a path, a signature, a version), stop and report the
   discrepancy with evidence instead of improvising.
3. Run the brief's acceptance commands exactly and include their real output in the report.
4. Commit with a message naming the task id. Do not push; the integrator reviews and merges.
5. Report: files changed, acceptance output, and any open question.

## 7. Phases

### Phase 1 — daemon with wallet and relayer, e2e on the armada-nitro fixturenet

| Task | Title | Depends on |
|---|---|---|
| P1-01 | Toolchain and workspace | — |
| P1-02 | `config` package | P1-01 |
| P1-03 | Vendor `armada-sdk` | P1-01 |
| P1-04 | `contracts` package | P1-01 |
| P1-05 | Use the armada-nitro environment (config from its deployment manifest) | armada-nitro environment |
| P1-06 | `wallet` package | P1-02, P1-03, P1-04, P1-05 |
| P1-07 | `relay` package | P1-03, P1-04, P1-06 |
| P1-08 | Daemon, HTTP server, CLI | P1-02, P1-06, P1-07 |
| P1-09 | E2E relay gate | P1-05, P1-08 |
| P1-10 | Linux distributable | P1-08 |

### Phase 2 — channels, watchtower, Waku (briefs written when phase 1 merges)

P2-01 Waku transport package (light node, Armada content topics). P2-02 Relay over Waku (signed fee announcements,
request/response). P2-03 Vendor `ts-nitro`, Node 18 build. P2-04 Adapt ts-nitro to ArmadaNitroAdjudicator (ABI,
`depositFromNote` funding, `SHIELD` allocations, custodian-aware signature check via `isActiveDelegate`). P2-05
`WakuMessageService`. P2-06 Watchtower (answer `ChallengeRegistered` within the window). P2-07 Hub role (custodian-backed
counterparty). P2-08 Acceptance e2e for the contract-layer paths of the 21.

### Phase 3 — mobile (briefs written when phase 2 merges)

P3-01 React Native shell with nodejs-mobile bridge (Railway pattern); the relay package ships in the app, disabled by default
(D11). P3-02 `leveldown-nodejs-mobile` behind
`abstract-level`. P3-03 Prover on mobile. P3-04 Android 16 KB page-size compliance of the nodejs-mobile build. P3-05 UI.

## 8. Known risks (unverified)

- The public Sepolia RPC limits `eth_getLogs` to 50,000 blocks; SDK sync from Armada's `demo3` deploy block on Sepolia
  depends on the SDK chunking its scans.
- Whether Railway's `@railgun-privacy/native-prover` proves Armada's circuit set (P3-03).
- nodejs-mobile's Android 16 KB page-size fix is committed upstream but unreleased (P3-04).
