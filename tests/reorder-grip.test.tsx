// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
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

const value: ArtBoardValue = {
  sections: [
    {
      id: "s1",
      title: "Options",
      pieces: [
        { id: "a", label: "Option A", content: { kind: "image", src: "data:," } },
        { id: "b", label: "Option B", content: { kind: "image", src: "data:," } },
      ],
    },
  ],
};

/**
 * The reorder grip was a <span> carrying aria-label (axe aria-prohibited-attr,
 * lab run 601, K32): a name on a roleless span is ignored, and the only way to
 * reorder pieces was a pointer drag. It is now a named button that moves its
 * piece with the arrow keys.
 */
describe("reorder grip", () => {
  it("is a named button per piece", () => {
    const { host, unmount } = mount(<ArtBoard value={value} onChange={vi.fn()} />);
    const grips = [...host.querySelectorAll(".fa-grip")];

    expect(grips).toHaveLength(2);
    for (const g of grips) {
      expect(g.tagName).toBe("BUTTON");
      expect(g.getAttribute("type")).toBe("button");
    }
    expect(grips[0].getAttribute("aria-label")).toBe("Move Option A");
    unmount();
  });

  it("moves its piece with the arrow keys", () => {
    const onChange = vi.fn();
    const { host, unmount } = mount(<ArtBoard value={value} onChange={onChange} />);
    const grip = host.querySelector<HTMLElement>('[data-fa-piece="a"] .fa-grip')!;

    act(() => {
      grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    const next = onChange.mock.calls.at(-1)![0] as ArtBoardValue;
    expect(next.sections[0].pieces.map((p) => p.id)).toEqual(["b", "a"]);
    unmount();
  });

  it("does nothing past the end of the section", () => {
    const onChange = vi.fn();
    const { host, unmount } = mount(<ArtBoard value={value} onChange={onChange} />);
    const grip = host.querySelector<HTMLElement>('[data-fa-piece="a"] .fa-grip')!;

    act(() => {
      grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });

    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });
});
