import { createContext, useContext, type ReactNode } from "react";
import type { ArtBoardValue, ArtSectionData } from "../../types";

/** Internal board context shared by Section / PieceFrame / FocusOverlay. */
export type ArtBoardCtx = {
  value: ArtBoardValue;
  /** JSX content for `kind:"node"` pieces, keyed by piece id. */
  nodes: Map<string, ReactNode>;
  /** Current scale (1/--fa-inv-zoom) — used by drag math to map screen px. */
  patchValue: (next: ArtBoardValue) => void;
  setSections: (fn: (sections: ArtSectionData[]) => ArtSectionData[]) => void;
  focus: string | null;
  setFocus: (pieceId: string | null) => void;
  onExport?: (pieceId: string, kind: "png" | "html") => void;
};

export const ArtBoardContext = createContext<ArtBoardCtx | null>(null);

export function useArtBoard(): ArtBoardCtx {
  const ctx = useContext(ArtBoardContext);
  if (!ctx) throw new Error("ArtBoard subcomponent used outside <ArtBoard>");
  return ctx;
}
