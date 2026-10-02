// Turning uploads (photos, screenshots, PDFs) into something Claude or the offline filter can read.

const MAX_IMAGE_EDGE = 2000; // px — keeps phone photos well under Claude's per-image size limit
const MAX_PDF_BYTES = 30 * 1024 * 1024;

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Pixel size of an image without decoding it at full resolution. */
function imageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => (URL.revokeObjectURL(url), resolve({ w: img.naturalWidth, h: img.naturalHeight }));
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error(`${file.name}: this image format isn't supported. Use JPG or PNG.`)));
    img.src = url;
  });
}

/** Canvas -> Blob, then shrink the canvas to 0×0 so the phone frees its memory straight away. */
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => {
      canvas.width = canvas.height = 0;
      resolve(blob);
    }, type, quality),
  );
}

/**
 * Downscale and re-encode an image as JPEG. The photo is decoded straight at the reduced size, so a
 * 50-megapixel camera photo never sits in memory at full resolution (the cause of "low memory" on phones).
 */
async function normaliseImage(file) {
  const { w, h } = await imageSize(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasToBlob(canvas, "image/jpeg", 0.88);
}

export const isPdf = (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
export const isImage = (file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|gif)$/i.test(file.name);

/** Prepare files for Claude (base64 image/document blocks). */
export async function filesToSources(files) {
  const out = [];
  for (const f of files) {
    if (isPdf(f)) {
      if (f.size > MAX_PDF_BYTES) throw new Error(`${f.name} is larger than 30 MB. Split it into smaller PDFs.`);
      out.push({ kind: "pdf", name: f.name, data: await blobToBase64(f) });
    } else if (isImage(f)) {
      const jpeg = await normaliseImage(f);
      out.push({ kind: "image", name: f.name, mediaType: "image/jpeg", data: await blobToBase64(jpeg) });
    } else {
      throw new Error(`${f.name}: only images (JPG/PNG/screenshots) and PDFs are supported.`);
    }
  }
  return out;
}

/** Scanned PDFs: at most this many pages are sent as pictures to AI services that can't read PDFs. */
const MAX_SCANNED_PAGES = 8;

/**
 * For AI services that take text and pictures but not PDFs: the PDF's text, or (scanned PDF) its pages as
 * JPEG pictures. `data` is the base64 PDF from filesToSources. Resolves {text, images: base64[]}.
 */
export async function pdfForChat(data, onProgress) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const doc = await openPdf({ arrayBuffer: async () => bytes.buffer });
  try {
    const text = await pdfDocText(doc, onProgress);
    if (text.replace(/\s/g, "").length > 50) return { text, images: [] };
    const images = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_SCANNED_PAGES); i++) {
      onProgress?.(`Preparing scanned page ${i} of ${Math.min(doc.numPages, MAX_SCANNED_PAGES)}…`);
      const png = await renderPage(doc, i);
      images.push(await blobToBase64(await normaliseImage(png)));
    }
    return { text: "", images };
  } finally {
    await doc.loadingTask.destroy();
  }
}

async function openPdf(file) {
  // The "legacy" build includes polyfills: the modern build needs very new browser features
  // (e.g. Math.sumPrecise) that many phone browsers lack, and then silently fails to read text.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Extract the text layer of a PDF. Returns "" for scanned PDFs with no text layer. */
async function pdfDocText(doc, onProgress) {
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Reading PDF page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
    page.cleanup();
  }
  return pages.join("\n");
}

/** Render one PDF page to a PNG no larger than MAX_IMAGE_EDGE (for scanned PDFs without a text layer). */
async function renderPage(doc, i) {
  const page = await doc.getPage(i);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2, MAX_IMAGE_EDGE / Math.max(base.width, base.height)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  page.cleanup();
  return canvasToBlob(canvas, "image/png");
}

let ocrWorker = null;
let ocrProgress = null; // progress callback of the scan in flight
async function getOcrWorker(onProgress) {
  if (ocrWorker) return ocrWorker;
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading the text scanner (first time takes a few seconds)…");
  ocrWorker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") ocrProgress?.(`Scanning text… ${Math.round(m.progress * 100)}%`);
    },
  });
  return ocrWorker;
}

/** On-device OCR (free mode). One image at a time; the scanner is shut down afterwards to free memory. */
async function ocr(blob, onProgress) {
  const worker = await getOcrWorker(onProgress);
  ocrProgress = onProgress;
  return (await worker.recognize(blob)).data.text;
}

async function closeOcr() {
  const w = ocrWorker;
  ocrWorker = null;
  await w?.terminate();
}

/** Free-mode path: get plain text out of any mix of images and PDFs, one page in memory at a time. */
export async function filesToText(files, onProgress) {
  const parts = [];
  try {
    for (const f of files) {
      if (isPdf(f)) {
        const doc = await openPdf(f);
        const text = await pdfDocText(doc, onProgress);
        if (text.replace(/\s/g, "").length > 50) parts.push(text);
        else {
          for (let i = 1; i <= doc.numPages; i++) {
            onProgress?.(`Scanning page ${i} of ${doc.numPages}…`);
            parts.push(await ocr(await renderPage(doc, i), onProgress));
          }
        }
        await doc.loadingTask.destroy(); // frees the parsed PDF and its worker memory
      } else if (isImage(f)) {
        parts.push(await ocr(await normaliseImage(f), onProgress));
      }
    }
  } finally {
    await closeOcr();
  }
  return parts.join("\n\n");
}
