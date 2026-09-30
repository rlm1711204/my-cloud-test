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

/** Downscale and re-encode an image file as JPEG. Returns a Blob. */
async function normaliseImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
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

async function openPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Extract the text layer of a PDF. Returns "" for scanned PDFs with no text layer. */
export async function pdfText(file, onProgress) {
  const doc = await openPdf(file);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Reading PDF page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
  }
  return pages.join("\n");
}

/** Render PDF pages to images (for scanned PDFs without a text layer). */
async function pdfPagesAsImages(file, onProgress) {
  const doc = await openPdf(file);
  const blobs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Rendering scanned page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
    blobs.push(await new Promise((r) => canvas.toBlob(r, "image/png")));
  }
  return blobs;
}

/** On-device OCR with Tesseract (used when no Claude key is set). */
export async function ocrImages(images, onProgress) {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading the text scanner (first time takes a few seconds)…");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(`Scanning text… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    const texts = [];
    for (const img of images) texts.push((await worker.recognize(img)).data.text);
    return texts.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** Offline path: get plain text out of any mix of images and PDFs. */
export async function filesToText(files, onProgress) {
  const parts = [];
  for (const f of files) {
    if (isPdf(f)) {
      const text = await pdfText(f, onProgress);
      if (text.replace(/\s/g, "").length > 50) parts.push(text);
      else parts.push(await ocrImages(await pdfPagesAsImages(f, onProgress), onProgress));
    } else if (isImage(f)) {
      parts.push(await ocrImages([await normaliseImage(f)], onProgress));
    }
  }
  return parts.join("\n\n");
}
