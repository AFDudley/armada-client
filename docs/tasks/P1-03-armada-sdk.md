# P1-03 Vendor `armada-sdk`

Depends on: P1-01. Read `docs/SPEC.md` D1, D2, §3.

## Goal
Make `@armada/sdk` (not published to npm; version `0.0.0`) buildable and importable from this workspace on
Node 18.20.4, unmodified.

## Read first
- kelce `~/code/git_puller/repos/armada-sdk/package.json` (scripts `build:vendor`, `prebuild`, `build`; `exports`).
- `armada-sdk/README.md`, `armada-sdk/NOTICE.md`.

## Deliver
- Git submodule `vendor/armada-sdk` → `https://github.com/ship-armada/armada-sdk` at commit `a77ceeb`.
- Add `"vendor/armada-sdk"` to the root `workspaces` list so `@armada/sdk` resolves by name.
- A root script `build:sdk` that runs the SDK's own build (`npm run build -w @armada/sdk`) and make `build` run it
  first. Do not edit any file inside `vendor/armada-sdk`.
- `packages/sdk-check/test/sdk.test.ts` (a private test-only workspace) proving the build works on Node 18:
  1. imports `@armada/sdk`, `@armada/sdk/core`, `@armada/sdk/wallet`, `@armada/sdk/prover`;
  2. reproduces one known-answer vector from `vendor/armada-sdk/test/vectors/` (pick a Poseidon or key-derivation
     vector; the expected value comes from the vector file, not from running the code). Name the vector file and
     entry in the test.

## Acceptance
```sh
git submodule update --init vendor/armada-sdk
npm ci && npm run check
```
Report the SDK build output and the vector test result. If the SDK build fails on Node 18, stop and report the error.

## Out of scope
Changing SDK code. React Native anything.
