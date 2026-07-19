import { useMemo, type CSSProperties } from "react";
import {
  checkLimits,
  resolveHtmlMode,
  sanitizeHtmlWithReport,
  type HtmlPolicy,
  type HtmlPolicyContext,
} from "./policy";

/**
 * The one place agent-authored HTML is rendered.
 *
 * `PieceFrame` and `FocusOverlay` both used their own `dangerouslySetInnerHTML`
 * call, which is how the same hole existed twice. Both now render through this
 * component, so a policy change lands everywhere and neither surface can drift
 * back to raw output.
 */
export type PolicyHtmlProps = {
  html: string;
  policy?: HtmlPolicy;
  context: HtmlPolicyContext;
  style?: CSSProperties;
  className?: string;
};

const FILL: CSSProperties = { width: "100%", height: "100%" };

export function PolicyHtml({ html, policy, context, style, className }: PolicyHtmlProps) {
  const mode = resolveHtmlMode(policy, context);

  const resolved = useMemo(() => {
    if (mode === "blocked") return { html: "", removed: [], blocked: true as const };

    const limits = checkLimits(html, policy?.limits);
    if (!limits.ok) {
      policy?.onViolation?.({ context, kind: limits.violation!.kind, detail: limits.violation!.detail });
      return { html: "", removed: [limits.violation!], blocked: true as const };
    }

    if (mode === "trusted") return { html, removed: [], blocked: false as const };
    if (mode === "sandbox") return { html, removed: [], blocked: false as const };

    const result = policy?.sanitizer ? policy.sanitizer(html, context) : sanitizeHtmlWithReport(html);
    for (const item of result.removed) {
      policy?.onViolation?.({ context, kind: item.kind, detail: item.detail });
    }
    return { ...result, blocked: false as const };
    // `policy` identity churn would re-sanitize every render; the fields that
    // actually affect the output are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, mode, policy?.sanitizer, policy?.limits, context.pieceId, context.reviewState, context.origin]);

  const base = { ...FILL, ...style };

  if (resolved.blocked) {
    return (
      <div
        className={className}
        style={base}
        data-artboard-html-mode="blocked"
        data-artboard-html-blocked=""
      />
    );
  }

  if (mode === "sandbox") {
    // No allow-scripts and no allow-same-origin: the document is inert and
    // cannot reach this origin. This is what makes "pending" an actual boundary
    // rather than a label — unreviewed markup renders visually without ever
    // executing.
    return (
      <iframe
        className={className}
        style={{ ...base, border: 0, background: "transparent" }}
        sandbox=""
        srcDoc={resolved.html}
        title={`artboard-piece-${context.pieceId}`}
        data-artboard-html-mode="sandbox"
      />
    );
  }

  return (
    <div
      className={className}
      style={base}
      data-artboard-html-mode={mode}
      data-artboard-html-removed={resolved.removed.length || undefined}
      dangerouslySetInnerHTML={{ __html: resolved.html }}
    />
  );
}
