import { type ReactNode } from "react";
import { StickyNote } from "@particle-academy/react-fancy";

export type NoteProps = {
  /**
   * Stable handle. Rendered as `data-fa-note-id` so an agent can resolve this
   * note instead of guessing at the DOM — the contract's "stable handles"
   * clause, which this component previously failed.
   *
   * Optional so notes written before it existed keep working; they are simply
   * not addressable.
   */
  id?: string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  rotate?: number;
  width?: number | string;
  /** Paper color — react-fancy StickyNote preset or any CSS color. */
  color?: string;
  /** Note text (controlled). */
  value?: string;
  onChange?: (text: string) => void;
  /** Static content; overrides editable text. */
  children?: ReactNode;
  editable?: boolean;
  selected?: boolean;
};

/**
 * Absolutely-positioned sticky note placed in the canvas world. The paper and
 * editable text are react-fancy's `<StickyNote>`; this wrapper owns position +
 * rotation (mirroring the reference DCPostIt).
 */
export function Note({
  id,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180,
  color = "yellow",
  value,
  onChange,
  children,
  editable,
  selected,
}: NoteProps) {
  return (
    <div
      className="fa-note"
      data-fa-note=""
      data-fa-note-id={id}
      style={{ position: "absolute", top, left, right, bottom, zIndex: 5 }}
    >
      <StickyNote
        value={value}
        onChange={onChange}
        color={color}
        rotate={rotate}
        width={width}
        editable={editable ?? !children}
        selected={selected}
      >
        {children}
      </StickyNote>
    </div>
  );
}
Note.displayName = "ArtBoard.Note";
