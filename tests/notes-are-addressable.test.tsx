// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ArtBoard } from "../src/components/ArtBoard/ArtBoard";
import type { ArtBoardValue } from "../src/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

/**
 * Notes must be ADDRESSABLE, which is two separate requirements from the
 * component contract, and `<Note>` failed both.
 *
 *   > **Stable handles.** Each interactive element has a stable identity.
 *   > **JSON-friendly inputs.** Avoid forcing React children for things the
 *   > agent must populate.
 *
 * `NoteProps` had no `id`, and `ArtBoardValue` was `{ sections }` — notes lived
 * exclusively as React children (`flatten(children).filter(c => c.type === Note)`).
 * So an agent driving the board read every piece (pieces do carry ids) and was
 * blind to every note: it could not enumerate them, could not resolve one, and
 * could not author one, because authoring meant emitting JSX.
 *
 * That is the exact failure the contract's two clauses exist to prevent, and it
 * shipped in a package whose whole subject is a shared human+agent canvas.
 *
 * Raised by a consumer (Ripple) blocked on agent-to-agent annotation, but it is
 * a contract violation on its own terms — which is why the fix is designed from
 * the contract rather than from their integration.
 */
describe("notes as data", () => {
  it("renders notes supplied through value, not only as children", () => {
    const value: ArtBoardValue = {
      sections: [],
      notes: [
        { id: "n1", text: "Check the contrast here", left: 40, top: 60 },
        { id: "n2", text: "Second pass needed", left: 220, top: 90 },
      ],
    };

    const { host, unmount } = mount(<ArtBoard value={value} />);

    expect(host.querySelectorAll("[data-fa-note-id]").length).toBe(2);
    expect(host.textContent).toContain("Check the contrast here");

    unmount();
  });

  it("gives every note a stable handle an agent can resolve", () => {
    const value: ArtBoardValue = {
      sections: [],
      notes: [{ id: "review-42", text: "Anchor copy is wrong" }],
    };

    const { host, unmount } = mount(<ArtBoard value={value} />);

    // The handle is the id the agent already holds — not a DOM guess.
    expect(host.querySelector('[data-fa-note-id="review-42"]')).not.toBeNull();

    unmount();
  });

  it("still renders notes authored as JSX children", () => {
    // The children form is how every existing consumer writes notes. Surfacing
    // notes as data must ADD a way in, not replace one.
    const { host, unmount } = mount(
      <ArtBoard>
        <ArtBoard.Note id="jsx-1" value="Authored as a child" />
      </ArtBoard>,
    );

    expect(host.querySelector('[data-fa-note-id="jsx-1"]')).not.toBeNull();
    expect(host.textContent).toContain("Authored as a child");

    unmount();
  });

  it("renders a child note with no id at all", () => {
    // `id` is optional so this is not a breaking change: notes written before
    // this existed keep working, they simply are not addressable.
    const { host, unmount } = mount(
      <ArtBoard>
        <ArtBoard.Note value="Legacy note" />
      </ArtBoard>,
    );

    expect(host.textContent).toContain("Legacy note");

    unmount();
  });

  it("renders both sources together", () => {
    const value: ArtBoardValue = {
      sections: [],
      notes: [{ id: "from-value", text: "From value" }],
    };

    const { host, unmount } = mount(
      <ArtBoard value={value}>
        <ArtBoard.Note id="from-children" value="From children" />
      </ArtBoard>,
    );

    expect(host.querySelectorAll("[data-fa-note-id]").length).toBe(2);

    unmount();
  });
});
