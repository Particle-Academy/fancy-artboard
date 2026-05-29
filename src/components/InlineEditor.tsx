import { type CSSProperties, type ElementType } from "react";
import { cx } from "../lib/cx";

export type InlineEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
};

/**
 * Tiny contentEditable inline editor — crisp under counter-scale. Commits on
 * blur or Enter; Escape reverts. Stops pointerdown so it doesn't initiate a
 * viewport pan or a grip drag.
 */
export function InlineEditor({
  value,
  onChange,
  as,
  className,
  style,
  onClick,
  title,
}: InlineEditorProps) {
  const Tag = (as || "span") as ElementType;
  return (
    <Tag
      className={cx("fa-editable", className)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title={title}
      onClick={onClick}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onBlur={(e: React.FocusEvent<HTMLElement>) =>
        onChange?.(e.currentTarget.textContent ?? "")
      }
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.textContent = value;
          e.currentTarget.blur();
        }
      }}
      style={style}
    >
      {value}
    </Tag>
  );
}
