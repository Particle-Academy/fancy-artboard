// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Resolved from the package root (vitest's cwd) rather than `import.meta.url`:
// under the jsdom environment that is not a file: URL, so `fileURLToPath`
// throws before a single assertion runs.
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

/** Extract one top-level rule body by exact selector. */
function ruleBody(selector: string): string | null {
  const re = new RegExp(
    `(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  return re.exec(css)?.[2] ?? null;
}

/**
 * The focus overlay must give ITSELF a box.
 *
 * `FocusOverlay` renders through react-fancy's `<Modal size="full">` and lays
 * every one of its own children out with `position: absolute` — the bar, the
 * stage, both arrows, the dots. Nothing is in flow, so the panel has NO
 * intrinsic height, and `size="full"` does not supply one: it sets only
 * `max-w`/`max-h` (a CAP, not a size) on a panel whose own classes are
 * `relative flex w-full flex-col ... border bg-white`.
 *
 * The result was a panel that computed to zero height. Not an invisible
 * overlay, either — a bordered white box collapsed to a HAIRLINE across the
 * screen, over a dimmed board. Clicking "focus" on any piece produced that and
 * nothing else.
 *
 * Nothing could report it: the component mounted, the modal opened, every
 * child rendered into the DOM with correct props, and no error was thrown
 * anywhere. The overlay was fully wired and completely unseeable, because the
 * one rule that gave the panel a size was the one rule nobody wrote. The
 * stylesheet defined `.fa-focus-bar`, `-stage`, `-card`, `-caption`, `-arrow`,
 * `-dots` — every DESCENDANT — and never `.fa-focus` itself.
 *
 * So assert the container rule exists and carries a height. Sizing lives here
 * rather than in react-fancy on purpose: `full` meaning "capped at the
 * viewport" is a legitimate contract, and widening it to "IS the viewport"
 * would silently resize every other `size="full"` modal in the kit.
 */
describe(".fa-focus — the overlay's own container", () => {
  it("is styled at all", () => {
    // The literal defect: only descendants were.
    expect(ruleBody(".fa-focus")).not.toBeNull();
  });

  it("declares a height, because no child contributes one", () => {
    const body = ruleBody(".fa-focus") ?? "";

    expect(body).toMatch(/(^|[\s;])height\s*:/);
  });

  it("establishes a positioning context for its absolute children", () => {
    const body = ruleBody(".fa-focus") ?? "";

    expect(body).toMatch(/(^|[\s;])position\s*:\s*(relative|fixed|absolute)/);
  });
});

describe("the children this container exists for", () => {
  // Guards the premise above: if these ever stop being absolutely positioned,
  // the container rule is no longer load-bearing and this suite should be
  // revisited rather than silently kept.
  it.each([
    ".fa-focus-bar",
    ".fa-focus-stage",
    ".fa-focus-arrow",
    ".fa-focus-dots",
  ])("%s is out of flow", (selector) => {
    expect(ruleBody(selector) ?? "").toMatch(/position\s*:\s*absolute/);
  });
});
