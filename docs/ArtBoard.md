# `<ArtBoard>`

The controlled pan/zoom canvas. Owns the viewport engine, renders sections +
piece frames, and shows a full-screen focus overlay when a piece is focused.

```tsx
import { ArtBoard, ArtPiece } from "@particle-academy/fancy-artboard";
import "@particle-academy/fancy-artboard/styles.css";
```

`ArtBoard.Section` and `ArtBoard.Note` are attached to the component.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `ArtBoardValue` | — | Controlled board content. Authoritative when set. |
| `defaultValue` | `ArtBoardValue` | from children | Initial value (uncontrolled). |
| `onChange` | `(v: ArtBoardValue) => void` | — | Fires on rename / reorder / delete. |
| `viewport` | `Viewport` | — | Controlled `{ x, y, zoom }`. |
| `defaultViewport` | `Viewport` | `{ x:0, y:0, zoom:1 }` | Initial viewport (uncontrolled). |
| `onViewportChange` | `(v: Viewport) => void` | — | Fires after each pan/zoom frame. |
| `focus` | `string \| null` | — | Controlled focused piece id. |
| `onFocusChange` | `(id: string \| null) => void` | — | Fires when focus enters/exits. |
| `minZoom` | `number` | `0.1` | |
| `maxZoom` | `number` | `8` | |
| `onExport` | `(pieceId, "png" \| "html") => void` | — | Notified on each export action. |
| `children` | `ReactNode` | — | `<ArtBoard.Section>` / `<ArtBoard.Note>` sugar. |
| `className` / `style` | — | — | Applied to the viewport element. Set a height. |

Every prop with both a controlled (`value`) and `default*` form follows the
standard rule: **the prop wins when defined, otherwise internal state is used**,
and the matching `on*` callback always fires.

## Controlled vs. uncontrolled

```tsx
// Uncontrolled — JSX children seed the initial value.
<ArtBoard>
  <ArtBoard.Section id="s1" title="Variants">
    <ArtPiece id="a" content={{ kind: "html", html: "<h1>A</h1>" }} />
  </ArtBoard.Section>
</ArtBoard>

// Controlled — JSON drives the board.
const [value, setValue] = useState<ArtBoardValue>({ sections: [...] });
<ArtBoard value={value} onChange={setValue} />
```

When controlled by `value`, JSX content for `kind:"node"` pieces still resolves
from the `<ArtPiece>` children by matching `id` (JSON can't carry React nodes).

## Value shape

```ts
type ArtBoardValue = { sections: ArtSectionData[] };
type ArtSectionData = {
  id: string; title: string; subtitle?: string; pieces: ArtPieceData[];
};
type ArtPieceData = {
  id: string; label?: string; width?: number; height?: number;
  content: ArtPieceContent; pending?: boolean;
};
type ArtPieceContent =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "html"; html: string }
  | { kind: "node" };
type Viewport = { x: number; y: number; zoom: number };
```

## `ArtBoard.Section`

Groups pieces into a titled, horizontally-scrolling row.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Stable handle (`data-fa-section`). Falls back to `title`. |
| `title` | `string` | Inline-editable. |
| `subtitle` | `string?` | |
| `children` | `ReactNode` | `<ArtPiece>` markers. |

## `ArtBoard.Note`

An absolutely-positioned react-fancy `<StickyNote>` placed in the world.

| Prop | Type | Default |
|---|---|---|
| `top` / `left` / `right` / `bottom` | `number \| string` | — |
| `rotate` | `number` | `-2` |
| `width` | `number \| string` | `180` |
| `color` | `string` | `"yellow"` |
| `value` / `onChange` | editable text | — |
| `children` | static content (overrides text) | — |

## Stable handles & bridges

Each piece frame renders `data-fa-piece={id}`; each section `data-fa-section={id}`.
A sibling MCP bridge targets the `ArtBoardValue` type contract and these
handles — it never DOM-scrapes. `ArtBoard` itself emits no `AgentActivity`;
that lives in the bridge layer.

## Notes

- Set a height on the canvas (`style={{ height: "100vh" }}`) — it fills its box.
- `pending: true` renders a piece with a dashed "proposed" ring + badge
  (trust-but-verify).
- Import `@particle-academy/fancy-artboard/styles.css` once.
