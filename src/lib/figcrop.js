// Cutting a figure out of a page picture. Boxes use the convention AI vision models are trained on:
// [ymin, xmin, ymax, xmax], each 0–1000 of the page's height / width. Browser-only (canvas).
import { cleanImage } from "./svgsafe.js";

/** A box made sensible: numbers, in range, in order, not tiny. Returns null if it can't be. */
export function normBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  let [y0, x0, y1, x1] = box.map((v) => Math.min(1000, Math.max(0, Number(v))));
  if (![y0, x0, y1, x1].every(Number.isFinite)) return null;
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 - y0 < 15 || x1 - x0 < 15) return null;
  return [y0, x0, y1, x1];
}

/** Grow a box by `pad` (0–1000 units) on every side, so labels at the edge of the figure are kept. */
export const padBox = (box, pad = 25) => [Math.max(0, box[0] - pad), Math.max(0, box[1] - pad), Math.min(1000, box[2] + pad), Math.min(1000, box[3] + pad)];

const loadImage = (blob) =>
  new Promise((ok, bad) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => ok({ img, url });
    img.onerror = () => (URL.revokeObjectURL(url), bad(new Error("That picture couldn't be opened.")));
    img.src = url;
  });

/** Crop `box` out of a page picture and make it small enough to keep: a JPEG data URL, or throws. */
export async function cropFigure(blob, box) {
  const b = normBox(box);
  if (!b) throw new Error("The figure's box is too small.");
  const { img, url } = await loadImage(blob);
  try {
    const sx = (b[1] / 1000) * img.naturalWidth;
    const sy = (b[0] / 1000) * img.naturalHeight;
    const sw = ((b[3] - b[1]) / 1000) * img.naturalWidth;
    const sh = ((b[2] - b[0]) / 1000) * img.naturalHeight;
    for (const [max, q] of [[720, 0.7], [600, 0.62], [480, 0.55], [380, 0.5]]) {
      const k = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(sw * k));
      c.height = Math.max(1, Math.round(sh * k));
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      c.width = c.height = 0;
      if (cleanImage(data)) return data;
    }
    throw new Error("That figure is too detailed to keep — make the box smaller.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
