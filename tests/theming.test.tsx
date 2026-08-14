// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

/** Extract one rule body by exact selector (first match). */
function ruleBody(selector: string): string | null {
  const re = new RegExp(
    `(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  return re.exec(css)?.[2] ?? null;
}

/**
 * Dark mode — reported by a consumer (Ripple / The Ripple Effect) against
 * 0.3.0, reproduced on our own showcase before this was written.
 *
 * The stylesheet had NO dark handling whatsoever: zero occurrences of "dark",
 * no `prefers-color-scheme` block, and exactly one colour token (`--fa-bg`)
 * against ten hardcoded light literals. On a dark-scheme app the board rendered
 * as a cream slab with white frames.
 *
 * The nastier half was invisible from inside this package. `.fa-viewport`
 * declares `color`, and it is the nearest ancestor with a declared colour above
 * ALL piece content — so anything inside a piece that does not set its own text
 * colour inherits warm dark ink, INCLUDING a react-fancy `<Card>` that had
 * correctly resolved `dark:bg-zinc-900`. react-fancy was behaving properly; the
 * two packages simply disagreed about theme, and this one won the cascade by
 * declaring colour lower in the tree. It therefore read as the CONSUMER's bug.
 *
 * The rule these tests encode: a colour that changes with theme must be a
 * token, and every token must be reassigned in both dark selectors. Asserting
 * "no bare literal in a themed declaration" is what stops the next colour from
 * being added the old way — the failure mode here was never one wrong value, it
 * was ten values with no mechanism.
 */
const THEMED_TOKENS = [
  "--fa-bg",
  "--fa-surface",
  "--fa-ink",
  "--fa-ink-strong",
  "--fa-ink-muted",
  "--fa-hover",
  "--fa-hover-soft",
  "--fa-dot",
  "--fa-dot-on",
];

describe("tokens", () => {
  const viewport = ruleBody(".fa-viewport") ?? "";

  it.each(THEMED_TOKENS)("%s is defined on .fa-viewport", (token) => {
    expect(viewport).toContain(`${token}:`);
  });

  it("keeps light mode byte-identical to the pre-token values", () => {
    // Tokenising must not restyle light mode -- the only observable change for
    // a light-scheme consumer should be none at all.
    const expected: Record<string, string> = {
      "--fa-bg": "#f0eee9",
      "--fa-surface": "#fff",
      "--fa-ink": "rgba(60, 50, 40, 0.7)",
      "--fa-ink-strong": "rgba(40, 30, 20, 0.85)",
      "--fa-ink-muted": "rgba(60, 50, 40, 0.6)",
      "--fa-hover": "rgba(0, 0, 0, 0.08)",
      "--fa-hover-soft": "rgba(0, 0, 0, 0.05)",
      "--fa-dot": "rgba(120, 110, 100, 0.3)",
      "--fa-dot-on": "rgba(60, 50, 40, 0.85)",
    };

    for (const [token, value] of Object.entries(expected)) {
      expect(viewport).toContain(`${token}: ${value}`);
    }
  });
});

describe("dark mode is actually wired", () => {
  it("has a prefers-color-scheme block", () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  });

  it("also supports class-based consumers", () => {
    // Tailwind-style `.dark` and `[data-theme]` apps never fire the media
    // query when the user overrides the system scheme.
    expect(css).toMatch(/\.dark\s/);
    expect(css).toMatch(/\[data-theme="dark"\]/);
  });

  it("an explicit LIGHT choice still beats a dark system", () => {
    // Without this guard a consumer who forces light on a dark-scheme OS gets
    // dark tokens from the media query anyway.
    expect(css).toMatch(/:not\(\.light\)|:not\(\[data-theme="light"\]\)/);
  });

  it.each(THEMED_TOKENS)("%s is reassigned in every dark selector", (token) => {
    const darkBlocks = css.split(/@media\s*\(prefers-color-scheme:\s*dark\)/)[1] ?? "";
    const classBlock = ruleBody('.dark .fa-viewport,\n[data-theme="dark"] .fa-viewport') ?? "";

    expect(darkBlocks).toContain(`${token}:`);
    expect(classBlock).toContain(`${token}:`);
  });
});

describe("no declaration hardcodes a colour", () => {
  it("every colour goes through a token", () => {
    // A literal is how all ten of these got written in the first place. Once
    // every colour is a `var()`, adding one the old way fails here rather than
    // shipping and being found by a consumer in dark mode.
    //
    // The accent is a token too (`--fa-accent` / `--fa-on-accent`) even though
    // it does NOT change between themes: exempting it by value would leave a
    // literal-shaped hole for the next colour to be added through.
    const offenders: string[] = [];
    const re = /^\s*(color|background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/gm;

    for (const m of css.matchAll(re)) {
      offenders.push(`${m[1]}: ${m[2]}`);
    }

    expect(offenders).toEqual([]);
  });
});
