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

## [0.4.0] — 2026-08-13

### Fixed

- **Dark mode did not exist.** The stylesheet had zero occurrences of `dark`, no `prefers-color-scheme` block, and exactly one colour token (`--fa-bg`) against ten hardcoded light literals. On a dark-scheme app the board rendered as a cream slab with white frames. Reported by a consumer against 0.3.0 and reproduced on our own showcase.

  The subtler half is why this was a correctness bug rather than polish: `.fa-viewport` declares `color`, making it the nearest ancestor with a declared colour above **all** piece content. Anything inside a piece that did not set its own text colour inherited warm dark ink — **including a react-fancy `<Card>` that had correctly resolved `dark:bg-zinc-900`**. react-fancy was behaving properly; this package overrode it lower in the tree, so the failure read as the *consumer's* bug.

  **What you must do:** nothing, if you are on a light-scheme app — light mode is unchanged, value for value, and a test pins that. If your app is dark, the board now follows it. If you shipped your own dark override for this, you can delete it; an unlayered override loaded after this stylesheet still wins, so nothing breaks if you don't.

### Added

- **A theme token layer**, scoped to `.fa-viewport` so the package never reaches into a consumer's globals: `--fa-bg`, `--fa-surface`, `--fa-ink`, `--fa-ink-strong`, `--fa-ink-muted`, `--fa-hover`, `--fa-hover-soft`, `--fa-dot`, `--fa-dot-on`, plus `--fa-accent`, `--fa-accent-soft` and `--fa-on-accent`. Override any of them to retheme the board without fighting specificity.

- **Dark support through two selectors**, because they cover different consumers: a `prefers-color-scheme: dark` media query for apps with no theme control, and `.dark` / `[data-theme="dark"]` for class-based apps. The media query is guarded (`:not(.light):not([data-theme="light"])`) so a user who explicitly picks light on a dark-scheme OS keeps a light board.

## [0.3.1] — 2026-08-13

### Fixed

- **The focus overlay rendered as a hairline instead of a lightbox.** Clicking *focus* on any board piece dimmed the board and produced a thin white line across the screen — no card, no arrows, no caption, no dots.

  `FocusOverlay` lays every one of its children out with `position: absolute`, so nothing is in flow and the panel has no intrinsic height. It renders through react-fancy's `<Modal size="full">`, which does not supply one either: `full` sets `max-width`/`max-height` — a **cap, not a size**. The panel therefore computed to **2px** (its own top and bottom border) and the whole overlay had no box to lay out in.

  The stylesheet defined `.fa-focus-bar`, `-stage`, `-card`, `-caption`, `-arrow` and `-dots` — every descendant — but never `.fa-focus`, the class the overlay hands to the panel precisely so it can size itself. Adding that rule (`height: 100dvh`, transparent chrome) fixes it; the Modal's own max-height still clamps the result, so the cap is not restated here and cannot go stale.

  **What you must do:** nothing but upgrade — no API changed. If you worked around this with your own `.fa-focus` override, you can drop it; note that yours will still win if it is unlayered and loaded after this stylesheet.

## [0.3.0] — 2026-08-07

### Changed

- **BREAKING — Node 22 is now declared as the floor.** `engines.node` is `>=22`, where this package previously declared **nothing at all**.

  Declaring nothing was not the same as supporting old Node: a consumer on 18 installed cleanly and found out at runtime.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

- **BREAKING — React 18 is no longer supported.** `peerDependencies.react` / `react-dom` are now `^19.0.0`.

  **What you must do:** on React 19, nothing. On React 18, stay on the previous release, or upgrade your app to 19 first.

  React 18 support was a claim nothing tested — every build and test in this package ran against 19, so the 18 half of the old range was never executed. An untested compatibility claim is worse than an absent one, because it reads as support.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.


## [0.2.2] — 2026-07-28

### Changed

- Widened the `@particle-academy/fancy-screens` requirement from `^0.4.0` to `>=0.4 <2.0`, so a sibling
  minor release is an upgrade and not a resolver conflict. **No action needed** —
  widening a range only adds candidates; the version you have today still resolves.

  A caret on a `0.x` range locks the MINOR, so every one of these pinned a
  sibling at whatever it happened to be on the day it was written, and each
  sibling release then read as a conflict to Composer/npm rather than an
  upgrade. Nothing in this package was using an API the newer minors removed
  — the range was the whole problem.

  This one was **already blocking**: the sibling had shipped past the cap,
  so installing the two together resolved to an old copy or refused
  outright. Nothing reported it, because a resolver quietly picking an older
  version looks exactly like success.

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
