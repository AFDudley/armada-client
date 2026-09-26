# P1-05 Use the armada-nitro environment

Depends on: P1-02; the armada-nitro environment (in `AFDudley/armada-nitro`) publishing a deployment manifest.
Read `docs/SPEC.md` §4.

## Goal
armada-client builds no chain environment. It derives its configuration from the deployment manifest that
armada-nitro's reconciler writes for each network (the laconic-so fixturenet, then Sepolia).

## Manifest contract (what armada-client requires from armada-nitro)
armada-nitro's reconciler writes the manifest (`docs/ENVIRONMENT.md` §5 in armada-nitro): on the fixturenet,
`manifest.json` in the deployment's `armada_env` volume; for Sepolia, the committed `env/manifests/sepolia.json`.
armada-client reads these fields and nothing else:
```json
{
  "network":     { "name": "fixturenet", "chainId": 31337, "rpcUrl": "http://…", "hostRpcUrl": "http://127.0.0.1:…" },
  "armada":      { "pool": "0x…", "usdc": "0x…", "deployBlock": 0, "artifactsBaseUrl": "https://…" },
  "armadaNitro": { "adjudicator": "0x…", "consensusApp": "0x…", "hubCustodian": "0x…" },
  "assets":      { "weth": "0x…", "wstETH": "0x…", "waUSDC": "0x…" },
  "testAccounts": [ { "address": "0x…", "privateKeyFile": "…" } ]
}
```
`rpcUrl` is the address inside the stack's network; `hostRpcUrl` the address from the kelce host. `testAccounts` is
present only on the fixturenet, where the reconciler funds each with ETH and USDC. If armada-nitro's manifest differs,
stop and report the difference.

## Deliver
- `scripts/config-from-manifest.mjs <manifest> <out-file> [--host]`: writes a `ClientConfig` (P1-02) from the manifest,
  using `hostRpcUrl` with `--host`, else `rpcUrl`; validates it with `parseConfig` before writing. Wallet and relayer key
  file paths come from flags `--wallet-secret <file>`, `--relayer-eoa-key <file>`, `--relayer-secret <file>`,
  `--relayer-port <n>`; relayer fees from `--fees transfer=<raw>,unshield=<raw>`. The relayer section is written with
  `enabled: true` only when `--enable-relayer` is given; otherwise `enabled: false` (SPEC D11).
- `data/` stays git-ignored; generated configs go there.

## Acceptance
With the armada-nitro fixturenet running (per armada-nitro's README), paste output of:
```sh
node scripts/config-from-manifest.mjs <deployment-dir>/…/fixturenet.json data/fixturenet.config.json --host \
  --wallet-secret data/user.secret --relayer-eoa-key <testAccounts[1].privateKeyFile> --relayer-secret data/relayer.secret \
  --relayer-port 8600 --fees transfer=5000,unshield=5000 --enable-relayer
cast code --rpc-url $(jq -r .network.rpcUrl data/fixturenet.config.json) $(jq -r .armadaNitro.adjudicator data/fixturenet.config.json) | head -c 20
```
The generated config parses; the adjudicator address has code on the fixturenet.

## Out of scope
Building, deploying or funding anything on a chain (armada-nitro's reconciler does that).
