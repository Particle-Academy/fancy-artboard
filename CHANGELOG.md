# Changelog

All notable changes to `@particle-academy/fancy-artboard` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0.** Breaking changes land in MINOR releases (`0.x.0`), not majors.
> Read the version number as "0.x is still moving", not as a stability promise.

> **This file starts at 0.2.1.** Entries for 0.1.0–0.2.0 are reconstructed from
> `git log` and are deliberately terse; the commit history is the record for
> those releases.

## [Unreleased]

## [0.2.1] — 2026-07-27

### Security

- **esbuild forced to >= 0.28.1** ([GHSA-g7r4-m6w7-qqqr] — arbitrary file read
  via the esbuild dev server on Windows, low severity). esbuild reaches this
  repo only as a build-time transitive of `tsup` and `vitest`, both
  devDependencies, so **nothing shipped in the published package was affected
  and no consumer was ever exposed** — this closes the alert on the repo's own
  dev tree.

  The fix is an `overrides` entry rather than a dependency bump because there is
  nothing to bump to: `tsup@8.5.1` (latest) ranges `esbuild: ^0.27.0`, and no
  patched 0.27.x exists — the fix first shipped in esbuild 0.28.1. The override
  installs the *patched* esbuild, it does not suppress the finding. **Remove it
  once tsup ships an esbuild >= 0.28.1 range.**

- **postcss bumped to 8.5.23** ([GHSA-r28c-9q8g-f849] — path traversal in
  previous-source-map auto-loading). Also build-time-only, and resolved *within*
  the existing semver range rather than pinned.

### Consumers

- **Nothing to do.** Both fixes are devDependency-tree only; the published
  `dist/` is byte-identical in behaviour to 0.2.0.

## [0.2.0] — 2026-07-19

### Security

- **Agent-authored HTML is gated behind a host-owned trust policy.** An
  `ArtPiece` of kind `html` is no longer injected verbatim; the host decides
  what agent-supplied markup is allowed to render.

## [0.1.1] — 2026-06-02

### Changed

- Widened the `@particle-academy/react-fancy` peer range to `>=3` so the package
  installs cleanly alongside react-fancy v4.

## [0.1.0] — 2026-05-29

### Added

- Initial release: `ArtBoard`, a Figma-style pan/zoom design canvas of
  `ArtPiece`s (`image`, `html`, or `jsx`), with a `./screens` entry point for
  rendering inside a `fancy-screens` Screen.

[GHSA-g7r4-m6w7-qqqr]: https://github.com/advisories/GHSA-g7r4-m6w7-qqqr
[GHSA-r28c-9q8g-f849]: https://github.com/advisories/GHSA-r28c-9q8g-f849
