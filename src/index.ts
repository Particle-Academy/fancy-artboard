export { ArtBoard, type ArtBoardProps } from "./components/ArtBoard/ArtBoard";
export { ArtPiece, type ArtPieceProps } from "./components/ArtPiece/ArtPiece";
export { type SectionProps } from "./components/ArtBoard/Section";
export { type NoteProps } from "./components/Note/Note";
export type {
  Viewport,
  ArtPieceContent,
  ArtPieceData,
  ArtSectionData,
  ArtNoteData,
  ArtBoardValue,
} from "./types";

export {
  resolveHtmlMode,
  sanitizeHtmlWithReport,
  mostRestrictive,
  DEFAULT_LIMITS,
  type HtmlPolicy,
  type HtmlPolicyContext,
  type HtmlPolicyViolation,
  type HtmlRenderMode,
  type HtmlOrigin,
  type HtmlReviewState,
  type SanitizedHtmlResult,
} from "./html/policy";
export { PolicyHtml, type PolicyHtmlProps } from "./html/PolicyHtml";
