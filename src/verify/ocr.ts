/**
 * OCR wrapper (Tesseract.js). Fault-tolerant: returns null when OCR is
 * unavailable so the pipeline can continue on manually entered fields.
 */
export async function ocrImage(filePath: string): Promise<string | null> {
  try {
    const mod = await import("tesseract.js");
    const worker = await mod.createWorker("eng");
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    const text = (data.text || "").trim();
    return text.length >= 10 ? text : null;
  } catch (e) {
    console.error("OCR unavailable:", (e as Error).message);
    return null;
  }
}
