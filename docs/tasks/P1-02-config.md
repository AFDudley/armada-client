# P1-02 `config` package

Depends on: P1-01. Read `docs/SPEC.md` §3–§4.

## Goal
One typed configuration file shape that targets the Sepolia fork or Sepolia, loaded and validated strictly.

## Deliver
`packages/config/` (`@armada-client/config`) exporting:

```ts
export type Address = `0x${string}`;

export interface ClientConfig {
  network: { name: string; chainId: number; rpcUrl: string };
  armada: {
    pool: Address;
    usdc: Address;
    deployBlock: number;
    artifactsBaseUrl: string;      // e.g. https://circuits.knowable.run/v0.1.0-dev
  };
  nitroRailgun: { adjudicator: Address; consensusApp: Address; hubCustodian?: Address };
  dataDir: string;                 // resolved to an absolute path, relative to the config file's directory
  wallet?: { rootSecretFile: string };            // file holds 32 bytes as 0x-hex
  relayer?: {
    listen: { host: string; port: number };
    eoaKeyFile: string;                            // file holds the EOA private key as 0x-hex
    shieldedRootSecretFile: string;                // file holds 32 bytes as 0x-hex
    feeTtlSeconds: number;
    feeBufferBps: number;                          // grace after expiry, as relayer-v2 FeeCalculator.resolve
    fees: { transfer: string; unshield: string };  // USDC raw (6 decimals) as decimal strings
  };
}

export class ConfigError extends Error { readonly path: string }   // path like "armada.pool"
export function parseConfig(json: unknown, baseDir: string): ClientConfig;  // throws ConfigError
export function loadConfig(file: string): Promise<ClientConfig>;           // reads + parseConfig
export function readSecretFile(file: string): Promise<Uint8Array>;         // 0x-hex file -> bytes
```

Validation rules: every address passes `ethers.getAddress` and is stored checksummed; `chainId`, `deployBlock`,
ports, `feeTtlSeconds`, `feeBufferBps` are non-negative integers; fee strings match `^[0-9]+$`; unknown keys are an
error; a missing required key is an error whose `path` names it. File paths inside the config resolve relative to
the config file.

Also deliver `config/fork.json` and `config/sepolia.json` at the repository root with the `demo3` values from
`docs/SPEC.md` §3. `fork.json` is for processes on the kelce host: `rpcUrl` = `http://127.0.0.1:8545` (the fork's port
is mapped to the same host port, P1-05). Containers generate their own config from the deployment file (P1-05, P1-09).
Sepolia's `rpcUrl` is `https://ethereum-sepolia-rpc.publicnode.com`. `nitroRailgun` addresses are the zero address in
both committed files; P1-05's `scripts/fork-config.mjs` writes a filled-in copy for the fork.

Dependency: `ethers` 6 (pinned exact).

## Acceptance
Tests in `packages/config/test/config.test.ts`, each seen failing first:
- a valid config round-trips with checksummed addresses and absolute `dataDir`;
- an invalid address at `armada.usdc` throws `ConfigError` with `path === "armada.usdc"`;
- an unknown key throws; a missing `network.rpcUrl` throws with that path;
- both committed files `config/fork.json` and `config/sepolia.json` parse.
```sh
npm run check
```

## Out of scope
Environment-variable overrides. Secret generation.
