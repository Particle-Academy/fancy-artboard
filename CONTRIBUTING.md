# Contributing to @particle-academy/fancy-artboard

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Build and test

```bash
npm run build   # tsup
npm run dev     # tsup --watch
npm run lint    # tsc --noEmit && eslint .
npm test        # vitest run
```

`prepublishOnly` runs the tests and the lint before building. Sources are in
`src/` (`components/`, `html/`, `lib/`, `types.ts`, `screens.ts`,
`styles.css`); tests are in `tests/`; reference docs shipped in the package are
in `docs/`.

## Keep these true

- **`src/types.ts` is the stable surface** the `registerArtboardBridge` MCP
  bridge (in agent-integrations) targets.
- **Only `./screens` imports fancy-screens** (an optional peer); the base `.`
  import graph stays react-fancy-only.
- **Zero third-party runtime dependencies**: the board is composed from
  react-fancy primitives.

## Changelog

Update `CHANGELOG.md` (Keep a Changelog, `[Unreleased]` at the top) in the same
commit as the change.
