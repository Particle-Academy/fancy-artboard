/**
 * Host-owned trust policy for agent-authored HTML.
 *
 * ArtBoard is open-world: an agent can propose a piece whose content is raw
 * HTML. That HTML used to reach `dangerouslySetInnerHTML` untouched, and a live
 * probe confirmed script execution from an `<img onerror>` handler **while the
 * piece was still PROPOSED** — so "pending review" was visual state, not a
 * security boundary.
 *
 * The fix is not to close the world but to make trust an explicit decision the
 * HOST owns and content can never elevate:
 *
 *     effective mode = most restrictive of (host policy × origin × review state)
 *
 * Nothing in a payload selects its own mode.
 */

/** How a piece's HTML is allowed to render. Ordered least → most restrictive. */
export type HtmlRenderMode = "trusted" | "sanitize" | "sandbox" | "blocked";

/** Restrictiveness rank — higher wins when combining decisions. */
const RANK: Record<HtmlRenderMode, number> = {
  trusted: 0,
  sanitize: 1,
  sandbox: 2,
  blocked: 3,
};

/** Return whichever mode is more restrictive. */
export function mostRestrictive(a: HtmlRenderMode, b: HtmlRenderMode): HtmlRenderMode {
  return RANK[a] >= RANK[b] ? a : b;
}

export type HtmlOrigin = "host" | "human" | "agent" | "external";
export type HtmlReviewState = "pending" | "accepted";

export type HtmlPolicyContext = {
  pieceId: string;
  sectionId: string;
  origin: HtmlOrigin;
  reviewState: HtmlReviewState;
};

export type SanitizedHtmlResult = {
  html: string;
  /** What was stripped, so a human can see why the render differs. */
  removed: Array<{ kind: string; detail: string }>;
};

export type HtmlPolicyViolation = {
  context: HtmlPolicyContext;
  /** What tripped: a removed construct, or a limit that was exceeded. */
  kind: string;
  detail: string;
};

export type HtmlPolicyLimits = {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
};

export type HtmlPolicy = {
  /** Mode for content that a human has accepted. Default `sanitize`. */
  accepted?: HtmlRenderMode;
  /**
   * Mode for content still awaiting review. Default `sandbox`.
   * `trusted` is deliberately not assignable — unreviewed content can never
   * run with full privileges.
   */
  pending?: Exclude<HtmlRenderMode, "trusted">;
  /** Final say. Its result is still floored by the origin/review baseline. */
  resolve?: (context: HtmlPolicyContext) => HtmlRenderMode;
  /** Replace the built-in sanitizer. */
  sanitizer?: (html: string, context: HtmlPolicyContext) => SanitizedHtmlResult;
  onViolation?: (event: HtmlPolicyViolation) => void;
  limits?: HtmlPolicyLimits;
};

export const DEFAULT_LIMITS: Required<HtmlPolicyLimits> = {
  maxBytes: 512_000,
  maxDepth: 64,
  maxNodes: 5_000,
};

/**
 * The floor for a given origin + review state, before the host's policy applies.
 *
 * Host-authored content is the only thing that may be trusted outright, and
 * only once it is not pending. Unknown provenance is blocked rather than
 * guessed at.
 */
function baseline(context: HtmlPolicyContext): HtmlRenderMode {
  if (context.reviewState === "pending") return "sandbox";
  switch (context.origin) {
    case "host":
      return "trusted";
    case "human":
    case "agent":
      return "sanitize";
    case "external":
      return "sanitize";
    default:
      return "blocked";
  }
}

/**
 * Resolve the effective render mode.
 *
 * Every input can only tighten: the host's `resolve`/`accepted`/`pending`
 * choice is combined with the origin baseline via `mostRestrictive`, so a host
 * may harden its own content but a policy can never loosen what the origin
 * and review state already require.
 */
export function resolveHtmlMode(
  policy: HtmlPolicy | undefined,
  context: HtmlPolicyContext,
): HtmlRenderMode {
  const floor = baseline(context);

  const configured =
    context.reviewState === "pending"
      ? (policy?.pending ?? "sandbox")
      : (policy?.accepted ?? "sanitize");

  let mode = mostRestrictive(floor, configured);

  if (policy?.resolve) {
    // A resolver may tighten further, never loosen below the baseline.
    mode = mostRestrictive(mode, policy.resolve(context));
  }

  return mode;
}

const EVENT_ATTR = /^on/i;
const UNSAFE_URL = /^(javascript|vbscript|data):/i;
/**
 * Unsafe schemes anywhere in a CSS value — `background:url(javascript:…)` puts
 * the scheme mid-string, so this one is deliberately unanchored. `data:` is
 * left alone except for text/html, since data-URI images are ordinary in CSS.
 */
const UNSAFE_CSS = /(javascript|vbscript)\s*:|data\s*:\s*text\/html/i;

/**
 * Normalize a URL attribute before testing its scheme.
 *
 * Browsers ignore whitespace and control characters inside a scheme, so
 * `java\tscript:` and `java\nscript:` both execute. Strip them first, or the
 * anchored test above is trivially bypassed.
 */
function normalizeUrl(value: string): string {
  // Drop spaces, control characters and NBSP by code point. Written as a filter
  // rather than a regex character class so the literal control bytes never end
  // up in this source file.
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 32 && code !== 127 && code !== 160;
    })
    .join("");
}
const BLOCKED_TAGS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "APPLET",
  "FORM",
  "BASE",
  "META",
  "LINK",
  "STYLE",
  "FOREIGNOBJECT",
]);
const URL_ATTRS = ["href", "src", "action", "formaction", "xlink:href", "poster", "background"];

/**
 * Built-in sanitizer: strips active content and reports what it removed.
 *
 * Deliberately implemented here rather than delegating to react-fancy's
 * `sanitizeHtml`, for two reasons — it must return a removal REPORT, and that
 * helper returns its input unchanged when `DOMParser` is unavailable, which
 * would silently pass raw agent HTML through during SSR. This one fails closed
 * instead (see `sanitizeHtmlWithReport`).
 */
export function sanitizeHtmlWithReport(html: string): SanitizedHtmlResult {
  const removed: SanitizedHtmlResult["removed"] = [];

  if (typeof DOMParser === "undefined") {
    // No parser (SSR / non-DOM runtime) means no way to make this safe. Emit
    // nothing rather than the raw string — failing closed is the whole point.
    return {
      html: "",
      removed: [{ kind: "unavailable", detail: "No DOMParser available; HTML withheld." }],
    };
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const body = doc.body;
  if (!body) return { html: "", removed: [{ kind: "unparsable", detail: "HTML could not be parsed." }] };

  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) walk(child);

    if (BLOCKED_TAGS.has(el.tagName)) {
      removed.push({ kind: "element", detail: `<${el.tagName.toLowerCase()}>` });
      el.remove();
      return;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();

      if (EVENT_ATTR.test(name)) {
        removed.push({ kind: "event-handler", detail: `${el.tagName.toLowerCase()}[${name}]` });
        el.removeAttribute(attr.name);
        continue;
      }

      if (URL_ATTRS.includes(name) && UNSAFE_URL.test(normalizeUrl(attr.value))) {
        removed.push({ kind: "unsafe-url", detail: `${name}="${attr.value.slice(0, 40)}"` });
        el.removeAttribute(attr.name);
        continue;
      }

      // url(javascript:…) and friends inside inline styles.
      if (name === "style" && UNSAFE_CSS.test(attr.value)) {
        removed.push({ kind: "unsafe-css", detail: "style contains an unsafe url()" });
        el.removeAttribute(attr.name);
      }
    }
  };

  for (const child of Array.from(body.children)) walk(child);

  return { html: body.innerHTML, removed };
}

/** Measure a document fragment against the configured limits. */
export function checkLimits(
  html: string,
  limits: HtmlPolicyLimits | undefined,
): { ok: boolean; violation?: { kind: string; detail: string } } {
  const merged = { ...DEFAULT_LIMITS, ...limits };

  const bytes = html.length;
  if (bytes > merged.maxBytes) {
    return { ok: false, violation: { kind: "limit", detail: `${bytes} bytes exceeds maxBytes ${merged.maxBytes}` } };
  }

  if (typeof DOMParser === "undefined") return { ok: true };

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const body = doc.body;
  if (!body) return { ok: true };

  let nodes = 0;
  let deepest = 0;
  const measure = (el: Element, depth: number) => {
    nodes++;
    if (depth > deepest) deepest = depth;
    for (const child of Array.from(el.children)) measure(child, depth + 1);
  };
  for (const child of Array.from(body.children)) measure(child, 1);

  if (nodes > merged.maxNodes) {
    return { ok: false, violation: { kind: "limit", detail: `${nodes} nodes exceeds maxNodes ${merged.maxNodes}` } };
  }
  if (deepest > merged.maxDepth) {
    return { ok: false, violation: { kind: "limit", detail: `depth ${deepest} exceeds maxDepth ${merged.maxDepth}` } };
  }
  return { ok: true };
}
