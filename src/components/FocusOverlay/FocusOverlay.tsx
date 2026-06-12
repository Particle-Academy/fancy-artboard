import { useEffect, useState } from "react";
import { Modal, Button, Dropdown } from "@particle-academy/react-fancy";
import type { ArtBoardValue, ArtPieceData, ArtSectionData } from "../../types";
import { useArtBoard } from "../ArtBoard/context";

const DEFAULT_W = 260;
const DEFAULT_H = 480;

/** Locate the focused piece + its section within the board value. */
function locate(value: ArtBoardValue, pieceId: string) {
  for (let s = 0; s < value.sections.length; s++) {
    const sec = value.sections[s];
    const p = sec.pieces.findIndex((piece) => piece.id === pieceId);
    if (p >= 0) return { sec, secIdx: s, piece: sec.pieces[p], pieceIdx: p };
  }
  return null;
}

/**
 * Full-screen focus overlay (driven by `focus`). Arrow nav: <- / -> within the
 * section, up / down across sections; a dots row + a section dropdown. Renders
 * through react-fancy's `<Modal size="full">` (its own portal).
 */
export function FocusOverlay() {
  const board = useArtBoard();
  const focusId = board.focus;
  const loc = focusId ? locate(board.value, focusId) : null;

  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  // Arrow navigation.
  useEffect(() => {
    if (!loc) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        stepSection(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        stepSection(1);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc?.piece.id]);

  if (!loc) return null;
  const { sec, secIdx, piece, pieceIdx } = loc;
  const peers = sec.pieces;

  function step(d: number) {
    const next = peers[(pieceIdx + d + peers.length) % peers.length];
    if (next) board.setFocus(next.id);
  }
  function stepSection(d: number) {
    const sections = board.value.sections;
    const n = sections.length;
    for (let i = 1; i <= n; i++) {
      const ns = sections[(((secIdx + d * i) % n) + n) % n];
      if (ns.pieces[0]) {
        board.setFocus(ns.pieces[0].id);
        return;
      }
    }
  }

  const width = piece.width ?? DEFAULT_W;
  const height = piece.height ?? DEFAULT_H;
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));

  const close = () => board.setFocus(null);

  return (
    <Modal open onClose={close} size="full" className="fa-focus">
      <div className="fa-focus-bar" data-fa-chrome="">
        <SectionPicker
          sections={board.value.sections}
          current={sec}
          onPick={(id) => board.setFocus(id)}
        />
        <div style={{ flex: 1 }} />
        <Button variant="ghost" icon="x" onClick={close} aria-label="Close focus" />
      </div>

      <div className="fa-focus-stage">
        <div
          className="fa-focus-card-wrap"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            className="fa-focus-card"
            style={{ width, height, transform: `scale(${scale})` }}
          >
            <FocusContent piece={piece} nodes={board.nodes} />
          </div>
        </div>
        <div className="fa-focus-caption">
          {piece.label ?? piece.id}
          <span className="fa-focus-index">
            {pieceIdx + 1} / {peers.length}
          </span>
        </div>
      </div>

      <Button
        variant="circle"
        icon="chevron-left"
        className="fa-focus-arrow fa-focus-arrow-left"
        onClick={() => step(-1)}
        aria-label="Previous"
      />
      <Button
        variant="circle"
        icon="chevron-right"
        className="fa-focus-arrow fa-focus-arrow-right"
        onClick={() => step(1)}
        aria-label="Next"
      />

      <div className="fa-focus-dots" data-fa-chrome="">
        {peers.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={"fa-focus-dot" + (i === pieceIdx ? " fa-focus-dot-on" : "")}
            onClick={() => board.setFocus(p.id)}
            aria-label={`Go to ${p.label ?? p.id}`}
          />
        ))}
      </div>
    </Modal>
  );
}

function FocusContent({
  piece,
  nodes,
}: {
  piece: ArtPieceData;
  nodes: Map<string, React.ReactNode>;
}) {
  const c = piece.content;
  if (c.kind === "image")
    return (
      <img
        src={c.src}
        alt={c.alt ?? piece.label ?? piece.id}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  if (c.kind === "html")
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: c.html }}
      />
    );
  return <>{nodes.get(piece.id) ?? null}</>;
}

function SectionPicker({
  sections,
  current,
  onPick,
}: {
  sections: ArtSectionData[];
  current: ArtSectionData;
  onPick: (firstPieceId: string) => void;
}) {
  const populated = sections.filter((s) => s.pieces.length > 0);
  return (
    <Dropdown placement="bottom-start">
      <Dropdown.Trigger>
        <button type="button" className="fa-focus-title">
          <span className="fa-focus-title-text">{current.title}</span>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M2 4l3.5 3.5L9 4" />
          </svg>
          {current.subtitle && <span className="fa-focus-subtitle">{current.subtitle}</span>}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Items>
        {populated.map((s) => (
          <Dropdown.Item key={s.id} onClick={() => onPick(s.pieces[0].id)}>
            {s.title}
          </Dropdown.Item>
        ))}
      </Dropdown.Items>
    </Dropdown>
  );
}
