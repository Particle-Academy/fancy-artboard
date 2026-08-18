import type { HtmlOrigin } from "./html/policy";

export type Viewport = { x: number; y: number; zoom: number };
export type ArtPieceContent =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "html"; html: string }
  | { kind: "node" };
export type ArtPieceData = {
  id: string; label?: string; width?: number; height?: number;
  content: ArtPieceContent; pending?: boolean;
  /**
   * Who authored this piece. Drives the HTML trust policy together with
   * `pending`. Absent is treated as `"agent"` — the conservative assumption on
   * an open-world board, so unlabelled HTML is sanitised/sandboxed rather than
   * trusted.
   */
  origin?: HtmlOrigin;
};
export type ArtSectionData = { id: string; title: string; subtitle?: string; pieces: ArtPieceData[] };

/**
 * A free-floating note, as DATA.
 *
 * Notes existed only as React children, and `NoteProps` carried no id — so an
 * agent driving the board read every piece and was blind to every note: it
 * could not enumerate them, resolve one, or author one without emitting JSX.
 * That broke both halves of the component contract at once ("stable handles"
 * and "avoid forcing React children for things the agent must populate"), in a
 * package whose entire subject is a shared human+agent canvas.
 *
 * Mirrors {@link NoteProps} so a note round-trips between the two forms.
 */
export type ArtNoteData = {
  /** Stable handle. Rendered as `data-fa-note-id` so an agent never guesses DOM. */
  id: string;
  /** Note text. Named `text` rather than `value` because this is data, not a control. */
  text?: string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  rotate?: number;
  width?: number | string;
  /** Paper colour — a react-fancy StickyNote preset or any CSS colour. */
  color?: string;
  /** Trust-but-verify: an agent-proposed note awaiting a human. */
  pending?: boolean;
};

export type ArtBoardValue = {
  sections: ArtSectionData[];
  /**
   * Optional so this is additive: a board written before notes were data still
   * type-checks, and the JSX-children form keeps working alongside it.
   */
  notes?: ArtNoteData[];
};
