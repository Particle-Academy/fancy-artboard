// /screens subpath — the ONLY module that imports fancy-screens (optional
// peer). Keeps the base `.` import graph react-fancy-only.
import { registerSchemaComponents } from "@particle-academy/fancy-screens";
import { ArtBoard } from "./components/ArtBoard/ArtBoard";
import { SectionView } from "./components/ArtBoard/Section";
import { ArtPiece } from "./components/ArtPiece/ArtPiece";
import type { ComponentType } from "react";

/**
 * Register ArtBoard's components with fancy-screens so a `ScreenSchema` can
 * render `{ "type": "ArtBoard", ... }` nodes. Call once at host startup.
 */
export function registerArtboardSchema(): void {
  registerSchemaComponents({
    ArtBoard: ArtBoard as unknown as ComponentType<Record<string, unknown>>,
    "ArtBoard.Section": SectionView as unknown as ComponentType<Record<string, unknown>>,
    ArtPiece: ArtPiece as unknown as ComponentType<Record<string, unknown>>,
  });
}
