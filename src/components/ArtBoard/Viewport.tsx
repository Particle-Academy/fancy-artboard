import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Viewport } from "../../types";

type ViewportEngineProps = {
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  minZoom: number;
  maxZoom: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const GRID_COLOR = "rgba(0,0,0,0.06)";
const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(
  GRID_COLOR,
)}' stroke-width='1'/%3E%3C/svg%3E")`;

/**
 * Transform-based pan/zoom engine (internal). Writes `translate3d(x,y,0)
 * scale(zoom)` straight to a DOM ref so wheel ticks bypass React; the
 * controlled `viewport` prop is the source of truth and `onViewportChange`
 * fires after each gesture frame.
 *
 * Input mapping (Figma-style):
 *   - trackpad pinch (ctrlKey wheel, non-integer delta) -> zoom
 *   - notched mouse wheel (integer |deltaY|>=40 or deltaMode!==0) -> stepped zoom
 *   - two-finger scroll -> pan
 *   - middle-drag / primary-drag on empty background -> pan
 *   - Safari gesturestart/change/end -> zoom
 *
 * Cursor-anchored zoom keeps the world point under the cursor fixed, then
 * cancels the vertical drift introduced by `--fa-inv-zoom`-driven reflow of
 * the section heads (CSS `zoom`) by re-pinning the DOM element under the
 * cursor.
 */
export function ViewportEngine({
  viewport,
  onViewportChange,
  minZoom,
  maxZoom,
  children,
  className,
  style,
}: ViewportEngineProps) {
  const vpRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  // Live transform state lives in a ref so high-frequency wheel/pointer events
  // don't round-trip through React. We mirror the controlled prop into it.
  const tf = useRef<Viewport>(viewport);
  const onChangeRef = useRef(onViewportChange);
  onChangeRef.current = onViewportChange;
  const limits = useRef({ minZoom, maxZoom });
  limits.current = { minZoom, maxZoom };

  // Write the live transform to the DOM + expose --fa-inv-zoom for chrome.
  const apply = useCallback(() => {
    const el = worldRef.current;
    if (!el) return;
    const { x, y, zoom } = tf.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    el.style.setProperty("--fa-inv-zoom", String(1 / zoom));
  }, []);

  // Sync external (controlled) changes into the ref + DOM. Skip if the value
  // already matches what we wrote (our own gesture echo).
  useEffect(() => {
    const cur = tf.current;
    if (cur.x !== viewport.x || cur.y !== viewport.y || cur.zoom !== viewport.zoom) {
      tf.current = viewport;
      apply();
    }
  }, [viewport, apply]);

  // Initial paint.
  useEffect(() => {
    apply();
  }, [apply]);

  const commit = useCallback(() => {
    onChangeRef.current({ ...tf.current });
  }, []);

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const zoomAt = (cx: number, cy: number, factor: number) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left;
      const py = cy - r.top;
      const t = tf.current;
      const next = Math.min(limits.current.maxZoom, Math.max(limits.current.minZoom, t.zoom * factor));
      const k = next / t.zoom;

      // The `--fa-inv-zoom`-driven section heads (CSS `zoom`) reflow on every
      // scale change, shifting world layout vertically. Anchor the DOM element
      // under the cursor: record its screen-Y, apply, then cancel the drift.
      let marker: Element | null = null;
      let markerY0 = 0;
      if (k !== 1) {
        const hit = document.elementFromPoint(cx, cy);
        marker = hit ? hit.closest("[data-fa-piece],[data-fa-section]") : null;
        if (marker) markerY0 = marker.getBoundingClientRect().top;
      }

      // Keep the world point under the cursor fixed.
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.zoom = next;
      apply();

      if (marker) {
        const drift = marker.getBoundingClientRect().top - (cy + (markerY0 - cy) * k);
        if (Math.abs(drift) > 0.1) {
          t.y -= drift;
          apply();
        }
      }
    };

    // Physical wheel vs trackpad-scroll heuristic.
    const isMouseWheel = (e: WheelEvent) =>
      e.deltaMode !== 0 ||
      (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);

    let isGesturing = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isGesturing) return; // Safari gesture* owns the pinch
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
      commit();
    };

    // Safari native pinch.
    let gsBase = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      zoomAt(ge.clientX, ge.clientY, (gsBase * ge.scale) / tf.current.zoom);
      commit();
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      isGesturing = false;
      commit();
    };

    // Drag-pan: middle button anywhere, or primary on empty background.
    let drag: { id: number; lx: number; ly: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      const onBg = !target.closest("[data-fa-piece], .fa-editable, [data-fa-chrome]");
      if (!(e.button === 1 || (e.button === 0 && onBg))) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
      vp.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = "";
      commit();
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false });
    vp.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false });
    vp.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false });
    vp.addEventListener("pointerdown", onPointerDown);
    vp.addEventListener("pointermove", onPointerMove);
    vp.addEventListener("pointerup", onPointerUp);
    vp.addEventListener("pointercancel", onPointerUp);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("gesturestart", onGestureStart as EventListener);
      vp.removeEventListener("gesturechange", onGestureChange as EventListener);
      vp.removeEventListener("gestureend", onGestureEnd as EventListener);
      vp.removeEventListener("pointerdown", onPointerDown);
      vp.removeEventListener("pointermove", onPointerMove);
      vp.removeEventListener("pointerup", onPointerUp);
      vp.removeEventListener("pointercancel", onPointerUp);
    };
  }, [apply, commit]);

  return (
    <div ref={vpRef} className={"fa-viewport " + (className ?? "")} style={style}>
      <div ref={worldRef} className="fa-world">
        <div
          className="fa-grid"
          style={{ backgroundImage: gridSvg }}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}
