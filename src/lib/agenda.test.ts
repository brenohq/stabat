import { describe, expect, it } from "vitest";
import { falta, partesDaData, separar, type Evento } from "./agenda";

const ensaio: Evento = { quando: "2026-11-20T19:00", titulo: "Ensaio na Praça" };
const concerto: Evento = { quando: "2026-12-05T20:00", titulo: "Concerto Natalino" };
const em = (s: string) => new Date(`${s}-03:00`);

describe("agenda", () => {
  it("ordena próximos e passados", () => {
    const antes = separar([concerto, ensaio], em("2026-11-17T10:00"));
    expect(antes.proximos.map((e) => e.titulo)).toEqual(["Ensaio na Praça", "Concerto Natalino"]);
    expect(antes.passados).toEqual([]);

    const depois = separar([ensaio, concerto], em("2026-12-10T10:00"));
    expect(depois.proximos).toEqual([]);
    expect(depois.passados.map((e) => e.titulo)).toEqual(["Concerto Natalino", "Ensaio na Praça"]);
  });

  it("o compromisso continua em 'próximos' enquanto está acontecendo", () => {
    expect(separar([ensaio], em("2026-11-20T20:30")).proximos).toHaveLength(1);
    expect(separar([ensaio], em("2026-11-20T22:30")).passados).toHaveLength(1);
  });

  it("formata a data no horário de Brasília", () => {
    expect(partesDaData(ensaio.quando)).toEqual({
      dia: "20",
      mes: "nov",
      semana: "sexta-feira",
      hora: "19h",
    });
    expect(partesDaData(concerto.quando)).toMatchObject({
      dia: "5",
      mes: "dez",
      semana: "sábado",
      hora: "20h",
    });
    expect(partesDaData("2026-12-05T20:30").hora).toBe("20h30");
  });

  it("conta os dias que faltam pelo calendário, não por 24 horas", () => {
    expect(falta(ensaio.quando, em("2026-11-17T23:50"))).toBe("faltam 3 dias");
    expect(falta(ensaio.quando, em("2026-11-19T08:00"))).toBe("amanhã");
    expect(falta(ensaio.quando, em("2026-11-20T08:00"))).toBe("hoje");
  });
});
