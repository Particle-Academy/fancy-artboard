// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  checkLimits,
  mostRestrictive,
  resolveHtmlMode,
  sanitizeHtmlWithReport,
  type HtmlPolicy,
  type HtmlPolicyContext,
} from "../src/html/policy";
import { PolicyHtml } from "../src/html/PolicyHtml";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

const ctx = (over: Partial<HtmlPolicyContext> = {}): HtmlPolicyContext => ({
  pieceId: "p1",
  sectionId: "s1",
  origin: "agent",
  reviewState: "accepted",
  ...over,
});

// The payload from the live probe that proved the hole.
const EXPLOIT = `<img src="x" onerror="window.__pwned = true">`;

describe("resolveHtmlMode — content cannot elevate its own trust", () => {
  it("sandboxes pending content even when the host asks for trusted", () => {
    // The reported failure: a PROPOSED piece executed script, so pending review
    // was visual state rather than a boundary.
    const policy: HtmlPolicy = { accepted: "trusted", resolve: () => "trusted" };
    expect(resolveHtmlMode(policy, ctx({ reviewState: "pending" }))).toBe("sandbox");
  });

  it("never trusts agent-authored content, even when accepted", () => {
    const policy: HtmlPolicy = { accepted: "trusted" };
    expect(resolveHtmlMode(policy, ctx({ origin: "agent" }))).toBe("sanitize");
  });

  it("allows trusted only for accepted host-authored content", () => {
    expect(resolveHtmlMode({ accepted: "trusted" }, ctx({ origin: "host" }))).toBe("trusted");
    expect(resolveHtmlMode({ accepted: "trusted" }, ctx({ origin: "host", reviewState: "pending" }))).toBe("sandbox");
  });

  it("lets a resolver tighten but never loosen", () => {
    expect(resolveHtmlMode({ resolve: () => "blocked" }, ctx({ origin: "host" }))).toBe("blocked");
    // Asking for trusted on agent content cannot drop below the sanitize floor.
    expect(resolveHtmlMode({ resolve: () => "trusted" }, ctx({ origin: "agent" }))).toBe("sanitize");
  });

  it("defaults to sanitize for accepted and sandbox for pending", () => {
    expect(resolveHtmlMode(undefined, ctx())).toBe("sanitize");
    expect(resolveHtmlMode(undefined, ctx({ reviewState: "pending" }))).toBe("sandbox");
  });

  it("ranks modes so the most restrictive wins", () => {
    expect(mostRestrictive("trusted", "blocked")).toBe("blocked");
    expect(mostRestrictive("sandbox", "sanitize")).toBe("sandbox");
    expect(mostRestrictive("trusted", "trusted")).toBe("trusted");
  });
});

describe("sanitizeHtmlWithReport", () => {
  it("strips the event handler that the probe exploited", () => {
    const out = sanitizeHtmlWithReport(EXPLOIT);
    expect(out.html).not.toContain("onerror");
    expect(out.removed.some((r) => r.kind === "event-handler")).toBe(true);
  });

  it("removes scripts, iframes, and forms", () => {
    const out = sanitizeHtmlWithReport(
      `<div><script>alert(1)</script><iframe src="x"></iframe><form action="/y"></form>ok</div>`,
    );
    expect(out.html).not.toContain("<script");
    expect(out.html).not.toContain("<iframe");
    expect(out.html).not.toContain("<form");
    expect(out.html).toContain("ok");
  });

  it("drops javascript: and data: URLs", () => {
    const out = sanitizeHtmlWithReport(`<a href="javascript:alert(1)">x</a>`);
    expect(out.html).not.toContain("javascript:");
    expect(out.removed.some((r) => r.kind === "unsafe-url")).toBe(true);
  });

  it("drops unsafe inline style urls", () => {
    const out = sanitizeHtmlWithReport(`<div style="background:url(javascript:alert(1))">x</div>`);
    expect(out.html).not.toContain("javascript:");
  });

  it("keeps benign markup intact", () => {
    const out = sanitizeHtmlWithReport(`<div class="a"><p>Hello <strong>world</strong></p></div>`);
    expect(out.html).toContain("<strong>world</strong>");
    expect(out.removed).toHaveLength(0);
  });

  it("reports what it removed so a human can see the difference", () => {
    const out = sanitizeHtmlWithReport(EXPLOIT);
    expect(out.removed[0]).toMatchObject({ kind: "event-handler" });
    expect(out.removed[0].detail).toContain("onerror");
  });
});

describe("checkLimits", () => {
  it("rejects oversized payloads", () => {
    const big = "x".repeat(200);
    expect(checkLimits(big, { maxBytes: 100 }).ok).toBe(false);
  });

  it("rejects excessive nesting", () => {
    const deep = "<div>".repeat(30) + "hi" + "</div>".repeat(30);
    expect(checkLimits(deep, { maxDepth: 5 }).ok).toBe(false);
  });

  it("accepts ordinary content", () => {
    expect(checkLimits("<p>fine</p>", {}).ok).toBe(true);
  });
});

describe("<PolicyHtml>", () => {
  it("strips the exploit's handler in the default (sanitize) mode", () => {
    // NOTE: jsdom does not load images, so an `onerror` handler never fires
    // here — asserting `window.__pwned` stays unset would pass against the
    // OLD vulnerable render too, and prove nothing. The load-bearing assertion
    // is that the attribute is gone from the DOM: verified to fail against the
    // previous raw `dangerouslySetInnerHTML`, which kept it verbatim.
    delete (window as Record<string, unknown>).__pwned;
    const view = mount(<PolicyHtml html={EXPLOIT} context={ctx()} />);
    expect(view.host.innerHTML).not.toContain("onerror");
    expect((window as Record<string, unknown>).__pwned).toBeUndefined();
    view.unmount();
  });

  it("renders pending content in a scriptless sandboxed iframe", () => {
    const view = mount(<PolicyHtml html={EXPLOIT} context={ctx({ reviewState: "pending" })} />);
    const frame = view.host.querySelector("iframe")!;
    expect(frame).not.toBeNull();
    // Empty sandbox = no scripts, no same-origin. This is what makes "pending"
    // a boundary instead of a label.
    expect(frame.getAttribute("sandbox")).toBe("");
    view.unmount();
  });

  it("renders nothing for blocked content", () => {
    const view = mount(
      <PolicyHtml html="<p>hi</p>" policy={{ resolve: () => "blocked" }} context={ctx()} />,
    );
    expect(view.host.querySelector("[data-artboard-html-blocked]")).not.toBeNull();
    expect(view.host.textContent).toBe("");
    view.unmount();
  });

  it("reports violations to the host", () => {
    const onViolation = vi.fn();
    const view = mount(<PolicyHtml html={EXPLOIT} policy={{ onViolation }} context={ctx()} />);
    expect(onViolation).toHaveBeenCalled();
    expect(onViolation.mock.calls[0][0]).toMatchObject({ kind: "event-handler" });
    view.unmount();
  });

  it("uses a host-supplied sanitizer when given one", () => {
    const sanitizer = vi.fn(() => ({ html: "<p>replaced</p>", removed: [] }));
    const view = mount(<PolicyHtml html={EXPLOIT} policy={{ sanitizer }} context={ctx()} />);
    expect(sanitizer).toHaveBeenCalled();
    expect(view.host.textContent).toContain("replaced");
    view.unmount();
  });

  it("renders raw HTML only for accepted host content", () => {
    const view = mount(
      <PolicyHtml
        html="<p>host markup</p>"
        policy={{ accepted: "trusted" }}
        context={ctx({ origin: "host" })}
      />,
    );
    expect(view.host.querySelector('[data-artboard-html-mode="trusted"]')).not.toBeNull();
    view.unmount();
  });

  it("blocks payloads that bust the limits instead of rendering them", () => {
    const view = mount(
      <PolicyHtml html={"x".repeat(500)} policy={{ limits: { maxBytes: 100 } }} context={ctx()} />,
    );
    expect(view.host.querySelector("[data-artboard-html-blocked]")).not.toBeNull();
    view.unmount();
  });
});

describe("scheme obfuscation", () => {
  it("strips javascript: hidden with embedded control characters", () => {
    // Browsers ignore whitespace/control bytes inside a scheme, so an anchored
    // check on the raw attribute is trivially bypassed.
    const out = sanitizeHtmlWithReport(`<a href="java\tscript:alert(1)">x</a>`);
    expect(out.html).not.toContain("script:");
    expect(out.removed.some((r) => r.kind === "unsafe-url")).toBe(true);
  });

  it("strips javascript: with a leading newline", () => {
    const out = sanitizeHtmlWithReport(`<a href="\njavascript:alert(1)">x</a>`);
    expect(out.html).not.toContain("javascript:");
  });

  it("keeps ordinary relative and absolute hrefs", () => {
    const out = sanitizeHtmlWithReport(`<a href="/docs">a</a><a href="https://example.com">b</a>`);
    expect(out.html).toContain('href="/docs"');
    expect(out.html).toContain('href="https://example.com"');
  });
});
