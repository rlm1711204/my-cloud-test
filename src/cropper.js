// The crop tool, shared by every part: a picture with a box you drag (or resize from a corner) over the part you want.
// open() resolves the box [ymin, xmin, ymax, xmax] on a 0–1000 scale of the picture, or null if closed.
import { normBox } from "./lib/figcrop.js";

export function createCropper({ $, esc, openOverlay }) {
  let cur = null; // {box, url, resolve}

  function open(blob, box, { title = "Crop", hint = "Drag the box over the part you want. Drag a corner to resize." } = {}) {
    finish(null);
    const url = URL.createObjectURL(blob);
    const b = normBox(box) || [40, 40, 960, 960];
    return new Promise((resolve) => {
      cur = { box: [...b], url, resolve };
      openOverlay(
        `<div class="sheet-bar"><h3>✂️ ${esc(title)}</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
        <p class="muted small">${esc(hint)}</p>
        <div class="cropper" id="cropTool"><img src="${url}" alt="Picture to crop" draggable="false" />
          <div class="crop-box"><span class="h" data-h="tl"></span><span class="h" data-h="tr"></span><span class="h" data-h="bl"></span><span class="h" data-h="br"></span></div></div>
        <div class="row wrap">
          <button class="btn primary" type="button" data-action="crop-save">✓ Use this</button>
          <button class="btn" type="button" data-action="crop-all">Whole picture</button>
        </div>`,
        { tall: true },
      );
      wire();
    });
  }

  function wire() {
    const root = $("#cropTool");
    if (!root) return;
    const boxEl = root.querySelector(".crop-box");
    const show = () => {
      const [y0, x0, y1, x1] = cur.box;
      Object.assign(boxEl.style, { left: `${x0 / 10}%`, top: `${y0 / 10}%`, width: `${(x1 - x0) / 10}%`, height: `${(y1 - y0) / 10}%` });
    };
    show();
    let drag = null;
    root.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".crop-box") || !cur) return;
      e.preventDefault();
      const r = root.getBoundingClientRect();
      drag = { mode: e.target.dataset.h || "move", x: e.clientX, y: e.clientY, start: [...cur.box], w: r.width, h: r.height };
      root.setPointerCapture?.(e.pointerId);
    });
    root.addEventListener("pointermove", (e) => {
      if (!drag || !cur) return;
      const dx = ((e.clientX - drag.x) / drag.w) * 1000;
      const dy = ((e.clientY - drag.y) / drag.h) * 1000;
      let [y0, x0, y1, x1] = drag.start;
      const clamp = (v) => Math.min(1000, Math.max(0, v));
      if (drag.mode === "move") {
        const w = x1 - x0;
        const h = y1 - y0;
        x0 = Math.min(1000 - w, Math.max(0, x0 + dx));
        y0 = Math.min(1000 - h, Math.max(0, y0 + dy));
        [x1, y1] = [x0 + w, y0 + h];
      } else {
        if (drag.mode.includes("l")) x0 = clamp(Math.min(x0 + dx, x1 - 40));
        if (drag.mode.includes("r")) x1 = clamp(Math.max(x1 + dx, x0 + 40));
        if (drag.mode.includes("t")) y0 = clamp(Math.min(y0 + dy, y1 - 40));
        if (drag.mode.includes("b")) y1 = clamp(Math.max(y1 + dy, y0 + 40));
      }
      cur.box = [y0, x0, y1, x1];
      show();
    });
    const end = () => (drag = null);
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
  }

  function finish(box) {
    const c = cur;
    if (!c) return;
    cur = null;
    URL.revokeObjectURL(c.url);
    c.resolve(box);
  }

  return {
    open,
    isOpen: () => Boolean(cur),
    actions: {
      "crop-save": () => finish(cur?.box ?? null),
      "crop-all": () => finish([0, 0, 1000, 1000]),
    },
    onCloseOverlay: () => finish(null),
  };
}
