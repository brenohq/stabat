/** Calendário da banda. Para adicionar um compromisso, acrescente uma linha em AGENDA. */

export type Evento = {
  /** data e hora no horário de Brasília, "AAAA-MM-DDTHH:MM" */
  quando: string;
  titulo: string;
  local?: string;
};

export const AGENDA: Evento[] = [
  { quando: "2026-11-20T19:00", titulo: "Ensaio na Praça" },
  { quando: "2026-12-01T19:00", titulo: "Concerto Natalino" },
];

const FUSO = "America/Sao_Paulo";
/** quanto tempo depois do início o compromisso ainda conta como "próximo" */
const DURACAO_MS = 3 * 60 * 60 * 1000;

/** "2026-11-20T19:00" (Brasília, sem horário de verão desde 2019) → instante */
export function instante(quando: string): Date {
  return new Date(`${quando}:00-03:00`);
}

/** separa em próximos (do mais perto ao mais longe) e passados (do mais recente ao mais antigo) */
export function separar(eventos: Evento[], agora: Date): { proximos: Evento[]; passados: Evento[] } {
  const ordem = [...eventos].sort((a, b) => instante(a.quando).getTime() - instante(b.quando).getTime());
  const fim = (e: Evento) => instante(e.quando).getTime() + DURACAO_MS;
  return {
    proximos: ordem.filter((e) => fim(e) > agora.getTime()),
    passados: ordem.filter((e) => fim(e) <= agora.getTime()).reverse(),
  };
}

function parte(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, ...opts }).format(d);
}

/** pedaços da data para o cartão: { dia: "20", mes: "nov", semana: "sexta-feira", hora: "19h" } */
export function partesDaData(quando: string): { dia: string; mes: string; semana: string; hora: string } {
  const d = instante(quando);
  const [h, m] = parte(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).split(":");
  return {
    dia: parte(d, { day: "numeric" }),
    mes: parte(d, { month: "short" }).replace(".", ""),
    semana: parte(d, { weekday: "long" }),
    hora: m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`,
  };
}

/** "faltam 3 dias", "amanhã", "hoje" (dias de calendário em Brasília) */
export function falta(quando: string, agora: Date): string {
  // en-CA formata como "2026-11-20": o dia de calendário em Brasília, à meia-noite UTC
  const dia = (d: Date) => Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d));
  const dias = Math.round((dia(instante(quando)) - dia(agora)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `faltam ${dias} dias`;
}
