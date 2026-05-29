import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type {
  ArtBoardValue,
  ArtPieceData,
  ArtSectionData,
  Viewport,
} from "../../types";
import { ArtBoardContext, type ArtBoardCtx } from "./context";
import { ViewportEngine } from "./Viewport";
import { Section, SectionView, type SectionProps } from "./Section";
import { ArtPiece, type ArtPieceProps } from "../ArtPiece/ArtPiece";
import { Note } from "../Note/Note";
import { FocusOverlay } from "../FocusOverlay/FocusOverlay";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export type ArtBoardProps = {
  value?: ArtBoardValue;
  defaultValue?: ArtBoardValue;
  onChange?: (v: ArtBoardValue) => void;
  viewport?: Viewport;
  defaultViewport?: Viewport;
  onViewportChange?: (v: Viewport) => void;
  focus?: string | null;
  onFocusChange?: (pieceId: string | null) => void;
  minZoom?: number;
  maxZoom?: number;
  onExport?: (pieceId: string, kind: "png" | "html") => void;
  /** `<ArtBoard.Section>` / `<ArtPiece>` authoring sugar. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

// Recursively unwrap fragments so <>...</> grouping doesn't hide children.
function flatten(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Fragment) {
      out.push(...flatten((c.props as { children?: ReactNode }).children));
    } else {
      out.push(c);
    }
  });
  return out;
}

type Compiled = { value: ArtBoardValue; nodes: Map<string, ReactNode> };

/** Walk Section/ArtPiece children into an ArtBoardValue + JSX node registry. */
function compileChildren(children: ReactNode): Compiled {
  const sections: ArtSectionData[] = [];
  const nodes = new Map<string, ReactNode>();

  flatten(children).forEach((sec) => {
    if (!isValidElement(sec) || sec.type !== Section) return;
    const sp = sec.props as SectionProps;
    const sid = sp.id ?? sp.title;
    if (!sid) return;
    const pieces: ArtPieceData[] = [];
    flatten(sp.children).forEach((pc) => {
      if (!isValidElement(pc) || pc.type !== ArtPiece) return;
      const pp = (pc as ReactElement).props as ArtPieceProps;
      if (!pp.id) return;
      const content = pp.content ?? { kind: "node" as const };
      if (content.kind === "node") nodes.set(pp.id, pp.children);
      pieces.push({
        id: pp.id,
        label: pp.label,
        width: pp.width,
        height: pp.height,
        content,
        pending: pp.pending,
      });
    });
    sections.push({ id: sid, title: sp.title, subtitle: sp.subtitle, pieces });
  });

  return { value: { sections }, nodes };
}

/**
 * Figma-style design canvas. Controlled (or uncontrolled) pan/zoom board of
 * `ArtPiece`s grouped into `ArtBoard.Section`s. Composes react-fancy chrome and
 * emits no agent events itself — a bridge layer owns presence/undo.
 */
function ArtBoardRoot({
  value,
  defaultValue,
  onChange,
  viewport,
  defaultViewport,
  onViewportChange,
  focus,
  onFocusChange,
  minZoom = 0.1,
  maxZoom = 8,
  onExport,
  children,
  className,
  style,
}: ArtBoardProps) {
  // children -> value + node registry (one source of truth). Recomputed each
  // render so authored JSX stays live, but only used to seed uncontrolled state.
  const compiled = useMemo(() => compileChildren(children), [children]);

  // value: controlled if `value` defined, else internal seeded from
  // defaultValue ?? compiled-from-children.
  const [internalValue, setInternalValue] = useState<ArtBoardValue>(
    () => defaultValue ?? compiled.value,
  );
  const resolvedValue = value ?? internalValue;

  const setValue = useCallback(
    (next: ArtBoardValue) => {
      if (value === undefined) setInternalValue(next);
      onChange?.(next);
    },
    [value, onChange],
  );

  const setSections = useCallback(
    (fn: (sections: ArtSectionData[]) => ArtSectionData[]) => {
      const cur = value ?? internalValueRef.current;
      setValue({ sections: fn(cur.sections) });
    },
    // setValue depends on value/onChange; cur is read via ref to stay fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setValue, value],
  );
  // Keep latest internal value reachable from the stable setSections closure.
  const internalValueRef = useRef(internalValue);
  internalValueRef.current = internalValue;

  // viewport: controlled or internal.
  const [internalVp, setInternalVp] = useState<Viewport>(
    () => defaultViewport ?? DEFAULT_VIEWPORT,
  );
  const resolvedVp = viewport ?? internalVp;
  const setVp = useCallback(
    (next: Viewport) => {
      if (viewport === undefined) setInternalVp(next);
      onViewportChange?.(next);
    },
    [viewport, onViewportChange],
  );

  // focus: controlled or internal.
  const [internalFocus, setInternalFocus] = useState<string | null>(null);
  const resolvedFocus = focus !== undefined ? focus : internalFocus;
  const setFocus = useCallback(
    (next: string | null) => {
      if (focus === undefined) setInternalFocus(next);
      onFocusChange?.(next);
    },
    [focus, onFocusChange],
  );

  // The node registry: when controlled by `value`, JSX nodes still come from
  // children (the value JSON can't carry React nodes). Merge children-derived
  // nodes regardless of the value source.
  const ctx: ArtBoardCtx = useMemo(
    () => ({
      value: resolvedValue,
      nodes: compiled.nodes,
      patchValue: setValue,
      setSections,
      focus: resolvedFocus,
      setFocus,
      onExport,
    }),
    [resolvedValue, compiled.nodes, setValue, setSections, resolvedFocus, setFocus, onExport],
  );

  return (
    <ArtBoardContext.Provider value={ctx}>
      <ViewportEngine
        viewport={resolvedVp}
        onViewportChange={setVp}
        minZoom={minZoom}
        maxZoom={maxZoom}
        className={className}
        style={style}
      >
        {resolvedValue.sections.map((section) => (
          <SectionView key={section.id} section={section} />
        ))}
        {/* Free-floating notes authored as direct children (outside sections). */}
        {flatten(children).filter((c) => isValidElement(c) && c.type === Note)}
      </ViewportEngine>
      {resolvedFocus != null && <FocusOverlay />}
    </ArtBoardContext.Provider>
  );
}

export const ArtBoard = Object.assign(ArtBoardRoot, {
  Section,
  Note,
});
