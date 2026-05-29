import { type ReactNode } from "react";
import type { ArtPieceContent } from "../../types";

export type ArtPieceProps = {
  /** Stable handle — agents/selectors target this without guessing the DOM. */
  id: string;
  label?: string;
  width?: number;
  height?: number;
  /**
   * Content source. Omit to render `children` as a `kind:"node"` piece
   * (JSX authoring sugar), or pass an explicit image/html/node descriptor.
   */
  content?: ArtPieceContent;
  /** Proposed (agent-staged) piece — renders with a trust-but-verify affordance. */
  pending?: boolean;
  /** JSX content when authoring inline (compiled to a `kind:"node"` piece). */
  children?: ReactNode;
};

/**
 * Authoring marker for a single design frame. Renders nothing itself — the
 * parent `<ArtBoard>` walks `<ArtPiece>` children to compile the
 * `ArtBoardValue` and a content registry (for `kind:"node"` JSX). The frame
 * chrome + content host is rendered by `PieceFrame`.
 */
export function ArtPiece(_props: ArtPieceProps): null {
  return null;
}
ArtPiece.displayName = "ArtPiece";
