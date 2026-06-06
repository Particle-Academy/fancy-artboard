# @particle-academy/fancy-artboard

[![Fancified](art/fancified.svg)](https://particle.academy)

A Figma-style design canvas for **Human+ UX** — a pan/zoom `ArtBoard` of
`ArtPiece`s (image, HTML, or live JSX), grouped into sections, with focus
mode, drag-reorder, inline rename, and PNG/HTML export. Composed entirely from
[`@particle-academy/react-fancy`](https://www.npmjs.com/package/@particle-academy/react-fancy)
primitives, zero third-party runtime deps.

```bash
npm install @particle-academy/fancy-artboard
```

```tsx
import { ArtBoard, ArtPiece } from "@particle-academy/fancy-artboard";
import "@particle-academy/fancy-artboard/styles.css";

export function Canvas() {
  return (
    <ArtBoard style={{ height: "100vh" }}>
      <ArtBoard.Section id="onboarding" title="Onboarding" subtitle="First-run variants">
        <ArtPiece id="a" label="A · Dusk" width={260} height={480}
          content={{ kind: "image", src: "/mocks/dusk.png" }} />
        <ArtPiece id="b" label="B · Minimal" width={260} height={480}>
          {/* any JSX — rendered as a kind:"node" piece, scales with zoom */}
          <MyMockup variant="minimal" />
        </ArtPiece>
      </ArtBoard.Section>
      <ArtBoard.Note top={40} left={620} rotate={-3}>
        Try the dusk gradient on the hero?
      </ArtBoard.Note>
    </ArtBoard>
  );
}
```

## Why

The suite targets applications where humans and agents share the same UI
surface. `ArtBoard` honours the **Human+ component contract**:

- **Controlled state** — `value` + `onChange`, `viewport` + `onViewportChange`,
  `focus` + `onFocusChange`. Nothing an agent might read or write is
  internal-only.
- **Stable handles** — every frame carries `data-fa-piece={id}`, every section
  `data-fa-section={id}`. Agents never guess the DOM.
- **JSON-friendly inputs** — the whole board is an `ArtBoardValue`: arrays of
  plain objects with `kind:"image" | "html" | "node"` content. Agents can emit
  it directly.
- **Bridgeable** — the type contract in `src/types.ts` is the stable surface a
  sibling MCP bridge (`registerArtboardBridge`) targets.
- **Trust-but-verify** — `pending` pieces render with a dashed "proposed" ring;
  agents stage, humans confirm.

The component emits no agent activity events itself — presence/undo live in a
bridge layer.

## Input mapping (Figma-style)

| Gesture | Action |
|---|---|
| Trackpad pinch (or Safari pinch) | Cursor-anchored zoom |
| Notched mouse wheel | Stepped zoom |
| Two-finger scroll | Pan |
| Middle-drag / primary-drag on empty background | Pan |
| Grip-drag on a piece header | Live reorder within the section |
| `← / →` (focus mode) | Prev / next piece in section |
| `↑ / ↓` (focus mode) | Prev / next populated section |
| `Esc` (focus mode) | Exit |

Chrome (section titles, piece headers, buttons) counter-scales via a
`--fa-inv-zoom` CSS variable so it stays a constant on-screen size while piece
**content** scales with the world transform.

## Authoring two ways

- **JSX sugar** — `<ArtBoard.Section>` / `<ArtPiece>` children compile to an
  `ArtBoardValue` and a content registry for `kind:"node"` (JSX) pieces.
- **Data** — pass a `value` (and `onChange`) to drive the board from JSON.
  `value` is authoritative when provided; JSX nodes still resolve from children
  by `id`, since JSON can't carry React nodes.

## `/screens`

```ts
import { registerArtboardSchema } from "@particle-academy/fancy-artboard/screens";
registerArtboardSchema(); // once at host startup
```

Registers `ArtBoard`, `ArtBoard.Section`, and `ArtPiece` with
`@particle-academy/fancy-screens` so a `ScreenSchema` can render artboard nodes.
This is the only entry that imports fancy-screens (an optional peer) — the base
`.` import graph stays react-fancy-only.

## Docs

- [`docs/ArtBoard.md`](./docs/ArtBoard.md)
- [`docs/ArtPiece.md`](./docs/ArtPiece.md)

## License

MIT
