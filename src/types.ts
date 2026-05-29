export type Viewport = { x: number; y: number; zoom: number };
export type ArtPieceContent =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "html"; html: string }
  | { kind: "node" };
export type ArtPieceData = {
  id: string; label?: string; width?: number; height?: number;
  content: ArtPieceContent; pending?: boolean;
};
export type ArtSectionData = { id: string; title: string; subtitle?: string; pieces: ArtPieceData[] };
export type ArtBoardValue = { sections: ArtSectionData[] };
