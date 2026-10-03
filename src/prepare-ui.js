// The crop step: after a photo is taken or photos / PDFs are picked (any part, any Add screen), show them before they
// are read. Each photo can be cropped, turned or left out; each PDF page can be cropped or left out. Untouched files go
// on unchanged (a PDF keeps its text); a cropped photo or page goes on as a JPEG of just that part.
import { isImage, isPdf, openPdfPages } from "./lib/extract.js";
import { cropToBlob } from "./lib/figcrop.js";

const MAX_THUMB_PAGES = 40; // pages shown (and croppable) per PDF; later pages are read as they are
const FULL = [0, 0, 1000, 1000];
const isFull = (b) => !b || b.every((v, i) => Math.abs(v - FULL[i]) < 2);

export function createPrepare({ esc, plural, toast, openOverlay, closeOverlay, cropper, settings, setSkip }) {
  let prep = null; // {items, resolve, loading, cropping, busy}

  /** Show the crop step; resolves the files to read, or null if cancelled. Skipped when turned off in Settings. */
  async function prepareFiles(files) {
    if (!files.length || settings().cropStep === false) return files;
    if (!files.some((f) => isImage(f) || isPdf(f))) return files;
    finish(null);
    const me = { items: [], loading: true, cropping: false, busy: null };
    const done = new Promise((resolve) => (me.resolve = resolve));
    prep = me;
    for (const file of files) {
      if (isPdf(file)) me.items.push({ kind: "pdf", file, pages: [], count: 0 });
      else if (isImage(file)) me.items.push({ kind: "image", file, thumb: URL.createObjectURL(file), rot: 0, box: null, cropThumb: null, removed: false });
      else me.items.push({ kind: "other", file });
    }
    show();
    for (const it of me.items.filter((x) => x.kind === "pdf")) {
      try {
        it.pdf = await openPdfPages(it.file);
        it.count = it.pdf.count;
        for (let n = 1; n <= Math.min(it.count, MAX_THUMB_PAGES); n++) {
          if (prep !== me) return done; // closed meanwhile
          it.pages.push({ n, thumb: URL.createObjectURL(await it.pdf.picture(n, 320)), include: true, box: null, cropThumb: null });
          if (n === 1 || n % 4 === 0) show();
        }
      } catch {
        it.failed = true; // can't preview: read as it is
      }
    }
    if (prep === me) {
      me.loading = false;
      show();
    }
    return done;
  }

  const count = () =>
    prep.items.reduce((n, it) => n + (it.kind === "image" ? (it.removed ? 0 : 1) : it.kind === "pdf" ? (it.failed || !it.count ? 1 : it.count - it.pages.filter((p) => !p.include).length) : 1), 0);

  function tile(src, cropped, rot, buttons, cls = "") {
    return `<figure class="prep-tile ${cls}"><div class="prep-pic"><img src="${src}" alt="" style="${rot ? `transform: rotate(${rot}deg)` : ""}" />${
      cropped ? `<span class="badge new">✂️ cropped</span>` : ""
    }</div><figcaption>${buttons}</figcaption></figure>`;
  }

  function show() {
    if (!prep || prep.cropping) return;
    const p = prep;
    const hasPdf = p.items.some((x) => x.kind === "pdf");
    const photos = p.items
      .map((it, i) =>
        it.kind === "image" && !it.removed
          ? tile(
              it.cropThumb || it.thumb,
              Boolean(it.box),
              it.cropThumb ? 0 : it.rot,
              `<button class="btn small" type="button" data-action="prep-crop" data-i="${i}">✂️ Crop</button>
               <button class="btn small" type="button" data-action="prep-rotate" data-i="${i}" aria-label="Turn">↻</button>
               <button class="btn small ghost" type="button" data-action="prep-remove" data-i="${i}" aria-label="Leave out">✕</button>`,
            )
          : "",
      )
      .join("");
    const others = p.items
      .map((it, i) => {
        if (it.kind === "other") return `<p class="prep-file">📎 ${esc(it.file.name)}</p>`;
        if (it.kind !== "pdf") return "";
        const head = `<p class="prep-file">📄 <b>${esc(it.file.name)}</b> <span class="muted small">${it.count ? plural(it.count, "page") : ""}</span></p>`;
        if (it.failed) return `${head}<p class="muted small">No preview — it will be read as it is.</p>`;
        return `${head}<div class="prep-grid">${it.pages
          .map((pg, k) =>
            tile(
              pg.cropThumb || pg.thumb,
              Boolean(pg.box),
              0,
              `<label class="prep-check"><input type="checkbox" data-prep-page="${i}:${k}" ${pg.include ? "checked" : ""} /> p.${pg.n}</label>
               <button class="btn small" type="button" data-action="prep-crop" data-i="${i}" data-k="${k}" aria-label="Crop page ${pg.n}">✂️</button>`,
              pg.include ? "" : "off",
            ),
          )
          .join("")}</div>${it.count > MAX_THUMB_PAGES ? `<p class="muted small">Pages ${MAX_THUMB_PAGES + 1}–${it.count} are read as they are.</p>` : ""}`;
      })
      .join("");
    const n = count();
    openOverlay(
      `<div class="sheet-bar"><h3>✂️ Crop before reading?</h3><button class="icon-btn" type="button" data-action="close" aria-label="Cancel">✕</button></div>
      <p class="muted small">Tap ✂️ to keep only the part you want read — one question, a paragraph, a table.${hasPdf ? " Untick PDF pages to skip them." : ""} Or just tap Read.</p>
      ${photos ? `<div class="prep-grid">${photos}</div>` : ""}
      ${others}
      ${p.loading ? `<p class="muted small">⏳ Preparing the page previews…</p>` : ""}
      ${p.busy ? `<p class="muted small">⏳ ${esc(p.busy)}</p>` : ""}
      <div class="stack prep-actions">
        <button class="btn primary block" type="button" data-action="prep-go" ${n && !p.busy ? "" : "disabled"}>✓ Read ${n === 1 ? "it" : hasPdf ? "these pages" : plural(n, "photo")}</button>
        <label class="toggle small"><input type="checkbox" data-prep-skip /> Don't show this step again (turn it back on in ⚙️ Settings)</label>
      </div>`,
      { tall: true },
    );
  }

  async function crop(i, k) {
    const it = prep?.items[i];
    if (!it || prep.cropping) return;
    const me = prep;
    const pg = it.kind === "pdf" ? it.pages[k] : null;
    try {
      me.busy = "Opening…";
      show();
      const pic = pg ? await it.pdf.picture(pg.n) : it.rot ? await cropToBlob(it.file, null, { rotate: it.rot }) : it.file;
      me.busy = null;
      me.cropping = true;
      const target = pg || it;
      const box = await cropper.open(pic, target.box || [30, 30, 970, 970], {
        title: pg ? `Crop page ${pg.n}` : "Crop the photo",
        hint: "Drag the box over the part you want read. Drag a corner to resize.",
      });
      me.cropping = false;
      if (prep !== me) return;
      if (box) {
        target.box = isFull(box) ? null : box;
        if (target.cropThumb) URL.revokeObjectURL(target.cropThumb);
        target.cropThumb = target.box ? URL.createObjectURL(await cropToBlob(pic, target.box, { max: 360, quality: 0.8 })) : null;
        if (pg) pg.include = true;
      }
    } catch (e) {
      me.cropping = false;
      me.busy = null;
      toast(e.message || String(e), 6000);
    }
    show();
  }

  /** The files to read: untouched files as they are; cropped / turned photos and pages as JPEGs. */
  async function build(p) {
    const out = [];
    const base = (f) => f.name.replace(/\.[^.]+$/, "") || "page";
    for (const it of p.items) {
      if (it.kind === "image") {
        if (it.removed) continue;
        out.push(it.box || it.rot ? new File([await cropToBlob(it.file, it.box, { rotate: it.rot })], `${base(it.file)}-crop.jpg`, { type: "image/jpeg" }) : it.file);
      } else if (it.kind === "pdf") {
        const changed = !it.failed && it.pages.some((pg) => !pg.include || pg.box);
        if (!changed) {
          out.push(it.file);
          continue;
        }
        // Every page in order: left out if unticked, cut if cropped (pages not previewed yet are kept whole).
        for (let n = 1; n <= it.count; n++) {
          const pg = it.pages[n - 1];
          if (pg && !pg.include) continue;
          p.busy = `Preparing page ${n} of ${it.count}…`;
          show();
          const pic = await it.pdf.picture(n);
          out.push(new File([pg?.box ? await cropToBlob(pic, pg.box) : pic], `${base(it.file)}-p${n}.jpg`, { type: "image/jpeg" }));
        }
      } else out.push(it.file);
    }
    return out;
  }

  function cleanup(p) {
    for (const it of p.items) {
      for (const u of [it.thumb, it.cropThumb, ...(it.pages || []).flatMap((pg) => [pg.thumb, pg.cropThumb])]) if (u) URL.revokeObjectURL(u);
      it.pdf?.close();
    }
  }

  function finish(files) {
    const p = prep;
    if (!p) return;
    prep = null;
    cleanup(p);
    p.resolve(files);
  }

  const actions = {
    "prep-crop": (el) => crop(Number(el.dataset.i), el.dataset.k == null ? undefined : Number(el.dataset.k)),
    "prep-rotate": (el) => {
      const it = prep?.items[Number(el.dataset.i)];
      if (!it) return;
      it.rot = (it.rot + 90) % 360;
      it.box = null; // a box drawn on the old way up no longer fits
      if (it.cropThumb) URL.revokeObjectURL(it.cropThumb);
      it.cropThumb = null;
      show();
    },
    "prep-remove": (el) => {
      const it = prep?.items[Number(el.dataset.i)];
      if (!it) return;
      it.removed = true;
      if (!count()) return cancel();
      show();
    },
    "prep-go": async () => {
      const p = prep;
      if (!p || p.busy) return;
      try {
        const files = await build(p);
        if (prep !== p) return;
        prep = null; // so closing the sheet doesn't cancel
        cleanup(p);
        closeOverlay();
        p.resolve(files);
      } catch (e) {
        p.busy = null;
        toast(e.message || String(e), 6000);
        show();
      }
    },
  };

  function cancel() {
    finish(null);
    closeOverlay();
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.prepPage != null && prep) {
      const [i, k] = t.dataset.prepPage.split(":").map(Number);
      const pg = prep.items[i]?.pages[k];
      if (pg) pg.include = t.checked;
      show();
      return true;
    }
    if (t.dataset.prepSkip != null) {
      setSkip(t.checked);
      return true;
    }
    return false;
  }

  return {
    prepareFiles,
    actions,
    onChange,
    onCloseOverlay: () => {
      if (prep && !prep.cropping) finish(null);
    },
    busy: () => Boolean(prep),
  };
}
