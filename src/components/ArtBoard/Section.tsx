import { type ReactNode } from "react";
import type { ArtSectionData } from "../../types";
import { useArtBoard } from "./context";
import { InlineEditor } from "../InlineEditor";
import { PieceFrame } from "../ArtPiece/PieceFrame";

export type SectionProps = {
  /** Stable handle. */
  id: string;
  title: string;
  subtitle?: string;
  /** `<ArtPiece>` children (authoring sugar). Ignored when `value` drives the board. */
  children?: ReactNode;
};

/**
 * Authoring marker for a section. Renders nothing on its own — `<ArtBoard>`
 * compiles `<ArtBoard.Section>` + `<ArtPiece>` children into the value. The
 * live section (titled head + horizontal piece row) is rendered by
 * `SectionView` from the controlled value.
 */
export function Section(_props: SectionProps): null {
  return null;
}
Section.displayName = "ArtBoard.Section";

/** The rendered section — head + horizontal row of piece frames in order. */
export function SectionView({ section }: { section: ArtSectionData }) {
  const board = useArtBoard();
  const order = section.pieces.map((p) => p.id);

  const patchTitle = (next: string) => {
    board.setSections((sections) =>
      sections.map((s) => (s.id === section.id ? { ...s, title: next } : s)),
    );
  };

  return (
    <div className="fa-section" data-fa-section={section.id}>
      <div className="fa-sectionhead-wrap">
        <div className="fa-sectionhead" data-fa-chrome="">
          <InlineEditor
            as="div"
            value={section.title}
            onChange={patchTitle}
            className="fa-sectiontitle"
          />
          {section.subtitle && <div className="fa-sectionsub">{section.subtitle}</div>}
        </div>
      </div>
      <div className="fa-row">
        {section.pieces.map((piece) => (
          <PieceFrame key={piece.id} sectionId={section.id} piece={piece} order={order} />
        ))}
      </div>
    </div>
  );
}
