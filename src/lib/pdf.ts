/** Junta os PDFs das partes num só, cada parte repetida pelo número de cópias (cópias juntas). */
export async function mergePdfs(
  sources: { bytes: ArrayBuffer | Uint8Array; copies: number }[],
): Promise<Uint8Array> {
  // pdf-lib (~200 KB) só é baixada quando alguém imprime
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const { bytes, copies } of sources) {
    const src = await PDFDocument.load(bytes);
    for (let i = 0; i < copies; i++) {
      // uma página não pode entrar duas vezes no mesmo documento: copia de novo a cada cópia
      for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
    }
  }
  return out.save();
}
