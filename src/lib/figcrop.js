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

/**
 * A photo or page made ready to read: turned by `rotate` degrees (a multiple of 90) clockwise, then cut to `box` (on the
 * turned picture; null = all of it), at most `max` pixels on its longest side. Resolves a JPEG Blob.
 */
export async function cropToBlob(blob, box, { rotate = 0, max = 2400, quality = 0.9 } = {}) {
  const b = box ? normBox(box) : [0, 0, 1000, 1000];
  if (!b) throw new Error("The crop box is too small.");
  const { img, url } = await loadImage(blob);
  try {
    const turn = (((Math.round(rotate / 90) % 4) + 4) % 4) * 90;
    const [W, H] = turn % 180 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight];
    const sx = (b[1] / 1000) * W;
    const sy = (b[0] / 1000) * H;
    const sw = ((b[3] - b[1]) / 1000) * W;
    const sh = ((b[2] - b[0]) / 1000) * H;
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    // Work in the turned picture's coordinates: scale, move the box to the origin, then turn the original into place.
    g.scale(k, k);
    g.translate(-sx, -sy);
    g.translate(W / 2, H / 2);
    g.rotate((turn * Math.PI) / 180);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const out = await new Promise((ok, bad) => c.toBlob((x) => (x ? ok(x) : bad(new Error("Couldn't make the picture."))), "image/jpeg", quality));
    c.width = c.height = 0;
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
