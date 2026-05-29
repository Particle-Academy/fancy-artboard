// Self-contained per-piece export. Clones the live DOM node with computed
// styles baked in, inlines @font-face / <img> / inline-style background-image
// urls as data URIs, then emits either a PNG (foreignObject -> canvas at 3x)
// or a standalone HTML document. Independent of viewport zoom.
//
// Rebuilt clean from the dirty reference's `dcExport` — no host coupling.

export type ExportKind = "png" | "html";

const toDataURL = (url: string): Promise<string> =>
  fetch(url)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise<string>((res) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => res(url);
          fr.readAsDataURL(b);
        }),
    )
    .catch(() => url);

// Collect @font-face rules across all stylesheets. Cross-origin sheets throw
// SecurityError on .cssRules — fall back to fetching the CSS text directly and
// regex-extracting the blocks. @import / nested groups are walked.
async function collectFontCss(): Promise<string> {
  const fontRules: Array<{ css: string; base: string }> = [];
  const pending: Array<Promise<void>> = [];
  const seen = new Set<string>();

  const scrapeCss = (href: string) => {
    if (seen.has(href)) return;
    seen.add(href);
    pending.push(
      fetch(href)
        .then((r) => r.text())
        .then((css) => {
          for (const m of css.match(/@font-face\s*{[^}]*}/g) || [])
            fontRules.push({ css: m, base: href });
          for (const m of css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g))
            scrapeCss(new URL(m[1], href).href);
        })
        .catch(() => {}),
    );
  };

  const walk = (rules: CSSRuleList, base: string) => {
    for (const r of Array.from(rules)) {
      if (r.type === CSSRule.FONT_FACE_RULE) {
        fontRules.push({ css: r.cssText, base });
      } else if (r.type === CSSRule.IMPORT_RULE && (r as CSSImportRule).styleSheet) {
        const sheet = (r as CSSImportRule).styleSheet as CSSStyleSheet;
        const ibase = sheet.href || base;
        try {
          walk(sheet.cssRules, ibase);
        } catch {
          scrapeCss(ibase);
        }
      } else if ((r as CSSGroupingRule).cssRules) {
        walk((r as CSSGroupingRule).cssRules, base);
      }
    }
  };

  for (const ss of Array.from(document.styleSheets)) {
    const base = ss.href || location.href;
    try {
      walk(ss.cssRules, base);
    } catch {
      if (ss.href) scrapeCss(ss.href);
    }
  }
  while (pending.length) await pending.shift();

  return (
    await Promise.all(
      fontRules.map(async (rule) => {
        let out = rule.css;
        const re = /url\((['"]?)([^'")]+)\1\)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(rule.css))) {
          if (m[2].indexOf("data:") === 0) continue;
          let abs: string;
          try {
            abs = new URL(m[2], rule.base).href;
          } catch {
            continue;
          }
          out = out.split(m[0]).join('url("' + (await toDataURL(abs)) + '")');
        }
        return out;
      }),
    )
  ).join("\n");
}

// Deep clone with every computed style baked into an inline style attribute,
// canvases rasterized to <img>, scripts/comments dropped.
function cloneStyled(src: Node): Node {
  if (src.nodeType === 8 || (src.nodeType === 1 && (src as Element).tagName === "SCRIPT"))
    return document.createTextNode("");
  const dst = src.cloneNode(false);
  if (src.nodeType === 1) {
    const el = src as Element;
    const cs = getComputedStyle(el);
    let txt = "";
    for (let i = 0; i < cs.length; i++) txt += cs[i] + ":" + cs.getPropertyValue(cs[i]) + ";";
    (dst as Element).setAttribute("style", txt + "animation:none;transition:none;");
    if (el.tagName === "CANVAS") {
      try {
        const im = document.createElement("img");
        im.src = (el as HTMLCanvasElement).toDataURL();
        im.setAttribute("style", txt);
        return im;
      } catch {
        /* tainted canvas — fall through to the styled clone */
      }
    }
  }
  for (let c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
  return dst;
}

const triggerDownload = (blob: Blob | null, name: string, ext: string) => {
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name + "." + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/**
 * Export a piece's content DOM node as a PNG or standalone HTML file.
 * @param node  the live element to capture (the piece content host)
 * @param w     natural width in px (artboard width)
 * @param h     natural height in px (artboard height)
 * @param name  download filename (sans extension)
 * @param kind  "png" | "html"
 */
export async function exportPiece(
  node: HTMLElement,
  w: number,
  h: number,
  name: string,
  kind: ExportKind,
): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* fonts API may be unavailable */
  }
  const fontCss = await collectFontCss();

  const clone = cloneStyled(node) as HTMLElement;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  // Flush w x h rect — drop the frame's own shadow/radius.
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";

  const jobs: Array<Promise<void>> = [];
  clone.querySelectorAll("img").forEach((el) => {
    const s = el.getAttribute("src");
    if (s && s.indexOf("data:") !== 0)
      jobs.push(toDataURL((el as HTMLImageElement).src).then((d) => el.setAttribute("src", d)));
  });
  [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
    const bg = el.style.backgroundImage;
    if (!bg) return;
    const re = /url\(["']?([^"')]+)["']?\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bg))) {
      const tok = m[0];
      const url = m[1];
      if (url.indexOf("data:") === 0) continue;
      jobs.push(
        toDataURL(url).then((d) => {
          el.style.backgroundImage = el.style.backgroundImage.split(tok).join('url("' + d + '")');
        }),
      );
    }
  });
  await Promise.all(jobs);

  const xml = new XMLSerializer().serializeToString(clone);

  if (kind === "html") {
    const html =
      '<!doctype html><html><head><meta charset="utf-8"><title>' +
      name +
      "</title>" +
      (fontCss ? "<style>" + fontCss + "</style>" : "") +
      '</head><body style="margin:0">' +
      xml +
      "</body></html>";
    triggerDownload(new Blob([html], { type: "text/html" }), name, "html");
    return;
  }

  // PNG — the SVG's own width/height is the output resolution; viewBox maps the
  // w x h foreignObject onto the px*w x px*h canvas so the browser renders the
  // HTML at full resolution (not an upscaled 1x bitmap).
  const px = 3;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w * px +
    '" height="' +
    h * px +
    '" viewBox="0 0 ' +
    w +
    " " +
    h +
    '"><foreignObject width="' +
    w +
    '" height="' +
    h +
    '">' +
    (fontCss ? "<style><![CDATA[" + fontCss + "]]></style>" : "") +
    xml +
    "</foreignObject></svg>";
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("svg load failed"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const cv = document.createElement("canvas");
  cv.width = w * px;
  cv.height = h * px;
  cv.getContext("2d")?.drawImage(img, 0, 0);
  await new Promise<void>((res) => {
    cv.toBlob((blob) => {
      triggerDownload(blob, name, "png");
      res();
    }, "image/png");
  });
}

/** Sanitize a label/id into a safe download filename stem. */
export function exportName(label: string | undefined, id: string): string {
  return String(label || id || "artpiece").replace(/[^\w\s.-]+/g, "_");
}
