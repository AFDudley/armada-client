# P1-10 Linux distributable

Depends on: P1-08. Read `docs/SPEC.md` D1.

## Goal
A self-contained Linux x64 tarball of `armada-client` that runs on a machine with no Node installed.

## Deliver
- `scripts/package-linux.mjs` producing `dist-release/armada-client-<version>-linux-x64.tar.gz` containing: the
  official Node 18.20.4 linux-x64 binary (verified against `SHASUMS256.txt`), the built workspace output, production
  `node_modules` (native modules such as `classic-level` built for linux-x64), and an `armada-client` shell launcher
  that runs `node/bin/node apps/daemon/dist/main.js "$@"`.
- A `SHA256SUMS` file next to the tarball.

## Acceptance
```sh
node scripts/package-linux.mjs
docker run --rm -v $PWD/dist-release:/r ubuntu:22.04 sh -c 'cd /tmp && tar xzf /r/armada-client-*-linux-x64.tar.gz && ./armada-client/armada-client --help'
```
The container has no Node; `--help` prints usage. Paste output and the tarball size.

## Out of scope
Code signing, auto-update, other architectures.
