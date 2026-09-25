# P1-05 Fork stack (anvil fork of Sepolia, deploy, fund)

Depends on: nothing. Read `docs/SPEC.md` §3–§4 and kelce `~/src/nitro-railgun/README.md` ("Local stack").

## Goal
A laconic stack-orchestrator external stack that runs a pinned anvil fork of Sepolia — where Armada's real `demo3` pool
and verifier live — deploys nitro-railgun against that pool, and funds test accounts.

## Read first
- kelce `~/src/nitro-railgun/stack/` (a working external stack: layout, `build.sh`, jobs) — copy its conventions.
- kelce `~/src/nitro-railgun/script/Deploy.s.sol` (env `ARMADA_POOL`, `HUB_GROUP_KEY_X/Y`, `HUB_REVOCATION_DELAY`;
  writes `deployments/<chainId>.json`).
- stack-orchestrator: `laconic-so` is `~/bin/laconic-so` on kelce; jobs run with `laconic-so deployment --dir <d> run-job <name>`.

## Deliver (under `stack/`)
- `stacks/armada-client/stack.yml`: pod `armada-fork`; jobs `armada-fork-setup` (and later tasks add more jobs).
- `compose/docker-compose-armada-fork.yml`: service `armada-fork` using image `ghcr.io/foundry-rs/foundry:v1.8.3`,
  entrypoint `anvil`, args `--host 0.0.0.0 --port 8545 --chain-id 11155111 --fork-url ${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com} --fork-block-number ${FORK_BLOCK:-11773700} --block-time 1`,
  healthcheck `cast block-number`, port `8545`, and a volume `armada_deployments:/deployments` (declared in the pod so
  stack-orchestrator records it in the deployment spec and places it under the deployment directory; the job below
  mounts the same volume). Create the deployment with `laconic-so … deploy init --map-ports-to-host localhost-same` so
  the host reaches the fork at `127.0.0.1:8545`.
- `compose-jobs/docker-compose-armada-fork-setup.yml` using image `cerc/nitro-railgun-foundry:local` (built by
  nitro-railgun's stack; this task's README states to build it first) with a script that:
  1. waits for the RPC;
  2. deploys nitro-railgun with `forge script script/Deploy.s.sol --broadcast` against the fork using
     `ARMADA_POOL=0x5f3324b47b3CFf937BB67C30B362898E193e5216`, `HUB_REVOCATION_DELAY=600`, deployer = anvil account 0
     key, and the group key of the fixed scalar
     `0xa4ddf31f7f32ba696f14ce50ecf3f21e3e100e83bdf47966e7b07468e9500b6e` (the default in nitro-railgun's
     `stack/container-build/cerc-nitro-railgun-foundry/nitro-railgun-local:12`): `cast wallet public-key --raw-private-key <scalar>`
     prints 64 bytes; `HUB_GROUP_KEY_X` = the first 32, `HUB_GROUP_KEY_Y` = the last 32;
  3. funds accounts: `anvil_setBalance` 100 ETH for anvil accounts 0–4; USDC for accounts 1 and 2 (1,000 USDC each)
     by impersonating the token's `masterMinter()` (`anvil_impersonateAccount`), calling
     `configureMinter(<minter>, <allowance>)`, then `mint` from the minter — no storage-slot writes;
  4. writes `/deployments/fork.json` (named volume `armada_deployments`) with
     `{ "chainId": 11155111, "forkBlock": ..., "armada": {pool, usdc, deployBlock: 11588108}, "nitroRailgun": {adjudicator, consensusApp, hubCustodian} }`.
- `scripts/fork-config.mjs <deployment-dir> <out-file>`: reads `<deployment-dir>/data/armada_deployments/fork.json`
  and writes `<out-file>`: a copy of `config/fork.json` with the `nitroRailgun` addresses filled in (`data/` is
  git-ignored). If stack-orchestrator does not place the volume at that path, stop and report where it is.
- `stack/README.md`: the exact commands to build, `deploy init/create/start`, and run the job.

## Acceptance (paste output)
After `run-job armada-fork-setup` and `node scripts/fork-config.mjs <deployment-dir> data/fork.config.json`, from kelce
with `cast --rpc-url http://127.0.0.1:8545`:
- `cast code <adjudicator>` is non-empty and `cast call <adjudicator> "pool()(address)"` = the demo3 pool;
- `cast call <usdc> "balanceOf(address)(uint256)" <account1>` = `1000000000`;
- `cast call <pool> "testingMode()(bool)"` = `false` (real verification on the fork);
- `cast chain-id` = `11155111`.
Running the job a second time on the same deployment succeeds.

## Out of scope
The daemon, wallet, or e2e scenario (later tasks add their jobs).
