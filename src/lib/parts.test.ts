import { describe, expect, it } from "vitest";
import { byFamily, familyOf, instrumentOf, sectionAt, shortName } from "./parts";
import { matches } from "./format";

describe("partes", () => {
  it("família: saxhorn é metal, sax alto é madeira", () => {
    expect(familyOf("Sax Alto Mib 1")).toBe("wood");
    expect(familyOf("Saxhorn Mib 1")).toBe("brass-hi");
    expect(familyOf("Sousafone Sib 2")).toBe("brass-lo");
  });
  it("nome curto", () => {
    expect(shortName("Trompete Sib 1")).toBe("Trompete 1");
    expect(shortName("Tuba Mib 2")).toBe("Tuba 2");
  });
  it("agrupa por família mantendo a ordem", () => {
    const g = byFamily([
      { id: "a", name: "Clarinete Sib 1", index: 0 },
      { id: "b", name: "Trompete Sib 1", index: 1 },
      { id: "c", name: "Sax Alto Mib 1", index: 2 },
    ]);
    expect(g.map(([f, ps]) => [f, ps.map((p) => p.id)])).toEqual([
      ["wood", ["a", "c"]],
      ["brass-hi", ["b"]],
    ]);
  });
  it("letra de ensaio vigente", () => {
    const marks = [
      { m: 4, label: "A" },
      { m: 12, label: "B" },
    ];
    expect(sectionAt(marks, 0)).toBeNull();
    expect(sectionAt(marks, 12)).toBe("B");
  });
  it("busca sem acento e em qualquer ordem", () => {
    expect(matches("colores", "De Colores Tradicional")).toBe(true);
    expect(matches("arroz luan", "Chuva de Arroz Luan Santana")).toBe(true);
    expect(matches("mae", "Mãe")).toBe(true);
    expect(matches("xyz", "APT.")).toBe(false);
  });
});

describe("instrumentOf", () => {
  it("acha o instrumento de cada parte da banda", () => {
    expect(instrumentOf("Clarinete Sib 1")).toBe("clarinet");
    expect(instrumentOf("Sax Alto Mib 2")).toBe("sax");
    expect(instrumentOf("Sax Tenor Sib 1")).toBe("sax");
    expect(instrumentOf("Saxhorn Mib 1")).toBe("saxhorn");
    expect(instrumentOf("Trompete Sib 1")).toBe("trumpet");
    expect(instrumentOf("Trombone Sib 2")).toBe("trombone");
    expect(instrumentOf("Bombardino Dó")).toBe("euphonium");
    expect(instrumentOf("Tuba Mib 1")).toBe("tuba");
    expect(instrumentOf("Sousafone Sib 1")).toBe("sousaphone");
  });
  it("instrumento sem ícone", () => {
    expect(instrumentOf("Flauta 1")).toBeNull();
  });
});
