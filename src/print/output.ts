/** Saída do PDF montado: diálogo de impressão do navegador ou download. */

let frame: HTMLIFrameElement | null = null;

function blobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
}

/** Safari não imprime PDF dentro de iframe (sai em branco): lá o PDF abre numa aba nova. */
function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Android/.test(ua);
}

/** Abre o diálogo de impressão com o PDF (o leitor de PDF do navegador cuida da impressora). */
export function printPdf(bytes: Uint8Array): void {
  const url = blobUrl(bytes);
  if (isSafari()) {
    window.open(url, "_blank");
    return;
  }
  // o iframe anterior fica até a próxima impressão: tirá-lo com o diálogo aberto cancela a impressão
  if (frame) {
    URL.revokeObjectURL(frame.src);
    frame.remove();
  }
  frame = document.createElement("iframe");
  frame.dataset.testid = "print-frame";
  frame.title = "PDF para imprimir";
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  frame.onload = () => {
    const w = frame?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };
  frame.src = url;
  document.body.appendChild(frame);
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const url = blobUrl(bytes);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
