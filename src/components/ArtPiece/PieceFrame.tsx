import { useRef, useState, type CSSProperties } from "react";
import { Button, Dropdown, Tooltip } from "@particle-academy/react-fancy";
import type { ArtPieceData, ArtSectionData } from "../../types";
import { useArtBoard } from "../ArtBoard/context";
import { InlineEditor } from "../InlineEditor";
import { exportPiece, exportName, type ExportKind } from "../../lib/export";
import { cx } from "../../lib/cx";

const DEFAULT_W = 260;
const DEFAULT_H = 480;

type PieceFrameProps = {
  sectionId: string;
  piece: ArtPieceData;
  /** Ordered piece ids in the section — for live drag-reorder. */
  order: string[];
};

export function PieceFrame({ sectionId, piece, order }: PieceFrameProps) {
  const board = useArtBoard();
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Two-click delete confirm — persists across menu re-opens.
  const [confirming, setConfirming] = useState(false);
  const width = piece.width ?? DEFAULT_W;
  const height = piece.height ?? DEFAULT_H;
  const id = piece.id;
  const label = piece.label ?? id;

  const renameLabel = (next: string) => {
    board.setSections((sections) =>
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, pieces: s.pieces.map((p) => (p.id === id ? { ...p, label: next } : p)) }
          : s,
      ),
    );
  };

  const reorder = (nextOrder: string[]) => {
    board.setSections((sections) =>
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        const byId = new Map(s.pieces.map((p) => [p.id, p]));
        return { ...s, pieces: nextOrder.map((k) => byId.get(k)!).filter(Boolean) };
      }),
    );
  };

  const remove = () => {
    board.setSections((sections) =>
      sections.map((s) =>
        s.id === sectionId ? { ...s, pieces: s.pieces.filter((p) => p.id !== id) } : s,
      ),
    );
  };

  const doExport = (kind: ExportKind) => {
    board.onExport?.(id, kind);
    if (!cardRef.current) return;
    exportPiece(cardRef.current, width, height, exportName(piece.label, id), kind).catch((e) =>
      // eslint-disable-next-line no-console
      console.error("[fancy-artboard] export failed:", e),
    );
  };

  const focus = () => board.setFocus(id);

  // Live drag-reorder: dragged card sticks to the cursor; siblings slide into
  // their would-be slots via transforms; DOM order commits only on drop.
  const onGripDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const me = slotRef.current;
    if (!me) return;
    // translateX is in local (pre-scale) space but pointer deltas + rect.left
    // are screen-space — divide by the live zoom so it tracks the cursor.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-fa-section="${CSS.escape(sectionId)}"] [data-fa-piece]`,
      ),
    );
    const homes = peers.map((el) => ({
      el,
      id: el.dataset.faPiece as string,
      x: el.getBoundingClientRect().left,
    }));
    const slotXs = homes.map((h) => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add("fa-dragging");

    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0;
      let best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter((k) => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };

    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove("fa-dragging");
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit in the same frame so there's no snap-back flash.
      setTimeout(() => {
        for (const h of homes) {
          h.el.style.transition = "none";
          h.el.style.transform = "";
        }
        if (liveOrder.join("|") !== order.join("|")) reorder(liveOrder);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            for (const h of homes) h.el.style.transition = "";
          }),
        );
      }, 180);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const cardStyle: CSSProperties = {
    width,
    height,
  };

  return (
    <div ref={slotRef} className="fa-slot" data-fa-piece={id}>
      <div
        className="fa-header"
        data-fa-chrome=""
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="fa-labelrow">
          <span
            className="fa-grip"
            onPointerDown={onGripDown}
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor" aria-hidden>
              <circle cx="2" cy="2" r="1.1" />
              <circle cx="7" cy="2" r="1.1" />
              <circle cx="2" cy="6.5" r="1.1" />
              <circle cx="7" cy="6.5" r="1.1" />
              <circle cx="2" cy="11" r="1.1" />
              <circle cx="7" cy="11" r="1.1" />
            </svg>
          </span>
          <span className="fa-labeltext" onClick={focus} title="Click to focus">
            <InlineEditor
              value={label}
              onChange={renameLabel}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 15, fontWeight: 500, lineHeight: 1 }}
            />
          </span>
        </div>
        <div className="fa-btns">
          <Dropdown placement="bottom-start">
            <Dropdown.Trigger>
              <Tooltip content="More">
                <Button variant="ghost" size="sm" icon="more-horizontal" aria-label="More" />
              </Tooltip>
            </Dropdown.Trigger>
            <Dropdown.Items className="fa-menu">
              <Dropdown.Item
                onClick={() => {
                  setConfirming(false);
                  doExport("png");
                }}
              >
                Download PNG
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => {
                  setConfirming(false);
                  doExport("html");
                }}
              >
                Download HTML
              </Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item
                danger
                onClick={() => {
                  if (confirming) {
                    setConfirming(false);
                    remove();
                  } else {
                    setConfirming(true);
                  }
                }}
              >
                {confirming ? "Click again to delete" : "Delete"}
              </Dropdown.Item>
            </Dropdown.Items>
          </Dropdown>
          <Tooltip content="Focus">
            <Button variant="ghost" size="sm" icon="maximize" onClick={focus} aria-label="Focus" />
          </Tooltip>
        </div>
      </div>
      <div
        ref={cardRef}
        className={cx("fa-card", piece.pending && "fa-pending")}
        style={cardStyle}
      >
        <PieceContent piece={piece} />
        {piece.pending && <span className="fa-pending-badge">proposed</span>}
      </div>
    </div>
  );
}

/** Renders the piece content inline so it scales crisply under the world transform. */
function PieceContent({ piece }: { piece: ArtPieceData }) {
  const board = useArtBoard();
  const c = piece.content;
  if (c.kind === "image") {
    return (
      <img
        src={c.src}
        alt={c.alt ?? piece.label ?? piece.id}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  if (c.kind === "html") {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: c.html }}
      />
    );
  }
  // kind: "node" — the JSX child the human authored.
  const node = board.nodes.get(piece.id);
  return <>{node ?? null}</>;
}
