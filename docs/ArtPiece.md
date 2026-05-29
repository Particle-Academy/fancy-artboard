# `<ArtPiece>`

A single design frame inside an `ArtBoard.Section`. `ArtPiece` is an
**authoring marker** — it renders nothing itself; `ArtBoard` walks the markers
to build the `ArtBoardValue` and (for JSX content) a node registry. The actual
frame chrome + content host is rendered internally from the board value.

```tsx
<ArtBoard.Section id="s" title="Variants">
  <ArtPiece id="hero-a" label="Hero · A" width={1280} height={800}
    content={{ kind: "image", src: "/mocks/hero-a.png", alt: "Hero A" }} />

  <ArtPiece id="hero-b" label="Hero · B" content={{ kind: "html", html: heroHtml }} />

  <ArtPiece id="hero-c" label="Hero · C" width={1280} height={800}>
    <HeroMockup variant="c" />
  </ArtPiece>
</ArtBoard.Section>
```

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `id` | `string` | — | **Required.** Stable handle (`data-fa-piece`). |
| `label` | `string?` | `id` | Inline-editable header label. |
| `width` | `number?` | `260` | Natural px width (also the export width). |
| `height` | `number?` | `480` | Natural px height (also the export height). |
| `content` | `ArtPieceContent?` | `{ kind: "node" }` | Content source. Omit to use `children`. |
| `pending` | `boolean?` | `false` | Renders a trust-but-verify "proposed" affordance. |
| `children` | `ReactNode?` | — | JSX content (compiled to a `kind:"node"` piece). |

## Content kinds

All three render **inline** so they scale crisply under the world transform:

- **`{ kind: "image", src, alt? }`** — `<img>` with
  `width:100%; height:100%; object-fit:cover`.
- **`{ kind: "html", html }`** — the HTML string injected via
  `dangerouslySetInnerHTML` (live app mockups; inline so they scale).
- **`{ kind: "node" }`** — the JSX `children` you authored, resolved from the
  board's node registry by `id`.

## Per-piece chrome

Each frame's header (counter-scaled to stay constant on screen) carries:

- a **drag grip** for live reorder within the section,
- an **inline-editable label**,
- a **kebab menu** (react-fancy `<Dropdown>`): *Download PNG*, *Download HTML*,
  and a two-click-confirm **Delete**,
- a **focus** button (opens the full-screen overlay).

Icon buttons are wrapped in react-fancy `<Tooltip>`.

## Export

The kebab actions call the self-contained exporter (`src/lib/export.ts`):

- **PNG** — the content node is cloned with computed styles baked in, fonts /
  images / background-images inlined as data URIs, wrapped in a
  `foreignObject → canvas` at 3× the piece's `width × height`.
- **HTML** — the same self-contained clone wrapped in a standalone document.

Export is independent of viewport zoom. The actions also invoke
`onExport?.(pieceId, kind)` so the host can surface its own feedback (no Toast
provider required).

## Pending (trust-but-verify)

```tsx
<ArtPiece id="proposed" label="Agent draft" pending
  content={{ kind: "html", html: draftHtml }} />
```

Renders with a dashed ring + a "proposed" badge — the agent proposes, the human
confirms.
