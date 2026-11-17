import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl, fetchBytes } from "../lib/data";
import { mergePdfs } from "../lib/pdf";
import { FAMILY_LABEL, byFamily } from "../lib/parts";
import { MAX_COPIES, clampCopies, initialCopies, printJob, totalCopies } from "../lib/print";
import { printCopies } from "../lib/storage";
import type { ArrangementMeta } from "../lib/types";
import { downloadPdf, printPdf } from "../print/output";
import { FAMILY_COLOR } from "./familyColor";
import { CloseIcon, DownloadIcon, PrinterIcon } from "./icons";
import { Button } from "./ui";

function Check({
  checked,
  mixed,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className="m-0 size-4 flex-none cursor-pointer accent-accent"
    />
  );
}

const stepBtn =
  "grid size-7 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-base leading-none hover:border-muted disabled:cursor-default disabled:opacity-40 disabled:hover:border-line";

/** Modal "Imprimir partes": escolhe as partes e as cópias de cada uma; junta os PDFs do MuseScore
 *  num só (cópias da mesma parte em sequência, na ordem da grade) e imprime ou baixa. */
export function PrintDialog({
  meta,
  open,
  onClose,
}: {
  meta: ArrangementMeta;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(() => new Set(meta.parts.map((p) => p.id)));
  const [copies, setCopies] = useState(() => initialCopies(meta.parts, printCopies.get()));
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => byFamily(meta.parts), [meta]);
  const job = printJob(meta.parts, selected, copies);
  const total = totalCopies(job);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // toda vez que abre: todas as partes marcadas, cópias como da última vez
      setSelected(new Set(meta.parts.map((p) => p.id)));
      setCopies(initialCopies(meta.parts, printCopies.get()));
      setError(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, meta]);

  const toggle = (ids: string[], on: boolean) => {
    const n = new Set(selected);
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
    setSelected(n);
  };
  const setCount = (id: string, value: number) => {
    const v = clampCopies(value);
    setCopies((c) => ({ ...c, [id]: v }));
    if (v > 0) printCopies.set({ ...printCopies.get(), [id]: v });
  };

  const run = async (kind: "print" | "download") => {
    setBusy(kind);
    setError(null);
    try {
      const sources = await Promise.all(
        job.map(async (j) => ({
          bytes: await fetchBytes(assetUrl(meta, `pdf/${j.id}.pdf`)),
          copies: j.copies,
        })),
      );
      const pdf = await mergePdfs(sources);
      if (kind === "print") printPdf(pdf);
      else downloadPdf(pdf, `${meta.title} - partes.pdf`);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Não foi possível montar o PDF. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // clique fora fecha
      aria-labelledby="print-title"
      data-testid="print-dialog"
      className="m-auto max-h-[min(720px,calc(100vh-48px))] w-[440px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[16px] border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/40 open:flex open:flex-col"
    >
      <header className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
        <div className="flex-1">
          <h2 id="print-title" className="text-xl">
            Imprimir partes
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {meta.title} · o mesmo PDF do MuseScore, em A4. As cópias de cada parte saem juntas.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1.5 grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <CloseIcon className="size-4.5" />
        </button>
      </header>

      <div className="flex items-center justify-between px-5 pt-2.5 pb-1 text-[13px]">
        <span className="text-muted">Partes e cópias</span>
        <span className="text-accent [&_button]:cursor-pointer [&_button]:px-1">
          <button
            type="button"
            onClick={() =>
              toggle(
                meta.parts.map((p) => p.id),
                true,
              )
            }
          >
            todas
          </button>
          <button
            type="button"
            onClick={() =>
              toggle(
                meta.parts.map((p) => p.id),
                false,
              )
            }
          >
            nenhuma
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2" data-testid="print-parts">
        {groups.map(([f, ps]) => {
          const ids = ps.map((p) => p.id);
          const n = ids.filter((id) => selected.has(id)).length;
          return (
            <section key={f} data-family={f} className="mt-1.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold select-none">
                <Check
                  checked={n === ids.length}
                  mixed={n > 0 && n < ids.length}
                  onChange={(v) => toggle(ids, v)}
                  label={`Marcar ${FAMILY_LABEL[f].toLowerCase()}`}
                />
                <i className={`inline-block size-2 flex-none rounded-[2px] ${FAMILY_COLOR[f]}`} />
                {FAMILY_LABEL[f]}
              </label>
              {ps.map((p) => {
                const on = selected.has(p.id);
                const c = copies[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    data-part={p.id}
                    className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-9 hover:bg-surface-2"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                      <Check checked={on} onChange={(v) => toggle([p.id], v)} label={p.name} />
                      <span className={`truncate ${on ? "" : "text-muted"}`}>{p.name}</span>
                    </label>
                    <div className={`flex items-center gap-1 ${on ? "" : "opacity-40"}`}>
                      <button
                        type="button"
                        className={stepBtn}
                        disabled={!on || c <= 1}
                        onClick={() => setCount(p.id, c - 1)}
                        aria-label={`Menos uma cópia de ${p.name}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_COPIES}
                        value={c || ""}
                        disabled={!on}
                        onChange={(e) => setCount(p.id, e.target.valueAsNumber)}
                        onBlur={() => c === 0 && setCount(p.id, 1)}
                        onFocus={(e) => e.target.select()}
                        aria-label={`Cópias de ${p.name}`}
                        className="h-7 w-10 [appearance:textfield] rounded-lg border border-line bg-surface text-center text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        className={stepBtn}
                        disabled={!on || c >= MAX_COPIES}
                        onClick={() => setCount(p.id, c + 1)}
                        aria-label={`Mais uma cópia de ${p.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <span className="mr-auto text-[13px] text-muted" data-testid="print-total">
          {total === 0
            ? "Nenhuma parte marcada"
            : `${total} ${total === 1 ? "cópia" : "cópias"} · ${job.length} ${job.length === 1 ? "parte" : "partes"}`}
        </span>
        {error && <span className="w-full text-xs text-red-700">{error}</span>}
        <Button onClick={() => void run("download")} disabled={total === 0 || !!busy}>
          <DownloadIcon /> {busy === "download" ? "Montando…" : "Baixar PDF"}
        </Button>
        <Button primary onClick={() => void run("print")} disabled={total === 0 || !!busy}>
          <PrinterIcon /> {busy === "print" ? "Montando…" : "Imprimir"}
        </Button>
      </footer>
    </dialog>
  );
}
