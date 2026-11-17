import { TopBar } from "../components/TopBar";
import { AGENDA, falta, partesDaData, separar, type Evento } from "../lib/agenda";

function EventoCard({ e, agora, passado }: { e: Evento; agora: Date; passado?: boolean }) {
  const d = partesDaData(e.quando);
  return (
    <li
      data-testid="evento"
      className={`flex items-stretch overflow-hidden rounded-[14px] border border-line bg-surface shadow-card ${
        passado ? "opacity-60" : ""
      }`}
    >
      <time
        dateTime={`${e.quando}-03:00`}
        className={`flex w-[76px] flex-none flex-col items-center justify-center py-3 ${
          passado ? "bg-surface-2 text-muted" : "bg-navy text-[#f3eee4]"
        }`}
      >
        <span className="font-display text-[32px] leading-none font-semibold">{d.dia}</span>
        <span className="mt-1 text-xs font-semibold tracking-wider uppercase opacity-80">{d.mes}</span>
      </time>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3">
        <h3 className="text-lg leading-snug">{e.titulo}</h3>
        <p className="text-[13px] text-muted">
          {d.semana.charAt(0).toUpperCase() + d.semana.slice(1)} · {d.hora}
          {e.local && <> · {e.local}</>}
        </p>
      </div>
      {!passado && (
        <div className="flex flex-none items-center pr-3 sm:pr-4">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-accent">
            {falta(e.quando, agora)}
          </span>
        </div>
      )}
    </li>
  );
}

export function CalendarPage() {
  const agora = new Date();
  const { proximos, passados } = separar(AGENDA, agora);
  return (
    <>
      <TopBar />
      <div className="bg-navy px-4 pt-6 pb-10 text-[#f3eee4]">
        <div className="mx-auto max-w-[720px] px-4">
          <h1 className="text-[clamp(26px,5vw,38px)]">Calendário da Banda</h1>
          <p className="mt-2 opacity-75">Ensaios e apresentações. Horários de Brasília.</p>
        </div>
      </div>
      <main className="mx-auto mt-7 mb-16 max-w-[720px] px-4">
        <h2 className="mb-3.5 text-xl">Próximos compromissos</h2>
        {proximos.length ? (
          <ul className="flex flex-col gap-3">
            {proximos.map((e) => (
              <EventoCard key={e.quando} e={e} agora={agora} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nenhum compromisso marcado por enquanto.</p>
        )}
        {passados.length > 0 && (
          <>
            <h2 className="mt-10 mb-3.5 text-xl">Já aconteceram</h2>
            <ul className="flex flex-col gap-3">
              {passados.map((e) => (
                <EventoCard key={e.quando} e={e} agora={agora} passado />
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
