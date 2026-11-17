import { Link } from "react-router";
import { useAsync } from "../hooks/useAsync";
import { assetUrl } from "../lib/data";
import { shortName } from "../lib/parts";
import {
  pitchName,
  smellRange,
  smellReport,
  writtenPitches,
  type SmellRange,
  type SmellReport,
} from "../lib/smells";
import type { ArrangementMeta, Part } from "../lib/types";

const RED = "text-[#b01f1f]";

/** contadores de smells não resolvidos: a parte aberta e cada parte do arranjo (só desktop) */
export function SmellPanel({
  meta,
  part,
  range,
  report,
  onMeasure,
}: {
  meta: ArrangementMeta;
  part: Part;
  range: SmellRange;
  report: SmellReport | null;
  onMeasure: (m: number) => void;
}) {
  const all = useAsync(
    () =>
      Promise.all(
        meta.parts.map(async (p) => {
          const r = await fetch(assetUrl(meta, `parts/${p.id}.musicxml`));
          if (!r.ok) throw new Error(`Não foi possível ler ${p.name}`);
          return { part: p, report: smellReport(writtenPitches(await r.text()), smellRange(p.name)) };
        }),
      ),
    [meta.id, meta.version],
  );
  const count = (r: SmellReport) => r.high + r.low;
  const total = all.status === "ok" ? all.data.reduce((s, x) => s + count(x.report), 0) : null;
  const pending = all.status === "ok" ? all.data.filter((x) => count(x.report) > 0).length : null;

  return (
    <aside
      data-testid="smell-panel"
      className="sticky top-4 max-h-[calc(100vh-var(--barh,150px)-32px)] overflow-auto rounded-[14px] border border-line bg-surface p-4 shadow-card"
    >
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">Smells não resolvidos</div>
      <div className="mt-2 flex items-baseline gap-2">
        <b
          data-testid="smell-panel-count"
          className={`font-display text-5xl leading-none ${report && count(report) === 0 ? "text-[#2f7d55]" : RED}`}
        >
          {report ? count(report) : "…"}
        </b>
        <span className="text-sm text-muted">nesta parte</span>
      </div>
      <div data-testid="smell-panel-range" className="mt-1.5 text-[13px] text-muted">
        Extensão: {pitchName(range.low)} a {pitchName(range.high)} (escrito)
      </div>
      {report && count(report) > 0 && (
        <>
          <div className="mt-1 text-[13px] text-muted">
            {report.high} acima · {report.low} abaixo
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {report.measures.map((m) => (
              <button
                key={m}
                type="button"
                title={`Ir ao compasso ${m + 1}`}
                onClick={() => onMeasure(m)}
                className={`cursor-pointer rounded-md border border-[#d62828]/40 bg-[#d62828]/[0.07] px-1.5 text-[13px] font-semibold ${RED}`}
              >
                c. {m + 1}
              </button>
            ))}
          </div>
        </>
      )}
      {report && count(report) === 0 && (
        <div className="mt-1 text-[13px] text-[#2f7d55]">Tudo dentro. 👌</div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-baseline justify-between text-[13px]">
          <b>No arranjo</b>
          {total !== null && (
            <span data-testid="smell-panel-total" className="text-muted">
              {total} em {pending} {pending === 1 ? "parte" : "partes"}
            </span>
          )}
        </div>
        {all.status === "loading" && <p className="mt-2 text-[13px] text-muted">Contando…</p>}
        {all.status === "error" && <p className="mt-2 text-[13px] text-red-700">{all.error.message}</p>}
        {all.status === "ok" && (
          <ul className="mt-1.5 text-[13px]">
            {all.data.map(({ part: p, report: r }) => {
              const n = count(r);
              const here = p.id === part.id;
              return (
                <li key={p.id}>
                  <Link
                    to={`/${meta.id}/${p.id}/smells`}
                    aria-current={here ? "page" : undefined}
                    className={`-mx-2 flex items-center justify-between rounded-md px-2 py-[3px] hover:bg-surface-2 ${
                      here ? "bg-accent-soft font-semibold" : ""
                    } ${n === 0 ? "text-muted" : ""}`}
                  >
                    {shortName(p.name)}
                    <span
                      className={`min-w-6 rounded-full px-1.5 text-center text-xs font-semibold ${
                        n ? "bg-[#d62828] text-white" : "text-[#2f7d55]"
                      }`}
                    >
                      {n || "✓"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
