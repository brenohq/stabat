import indexJson from "../../../public/arranjos/index.json?raw";
import { describe, expect, it } from "vitest";
import { NOTES, noteById, placeOf } from "./notes";
import {
  canIntroduce,
  freshMemory,
  grade,
  introduce,
  isCalm,
  isMilestone,
  levelOf,
  needsWarmup,
  normalize,
  pickNext,
  stars,
  statOf,
  topConfusion,
  WARMUP_AFTER_MS,
  type Memory,
} from "./scheduler";

/** sorteio com semente: sempre o mesmo resultado */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sol = noteById("G4");
const withBoxes = (m: Memory, box: number, ids = NOTES.slice(0, m.introduced).map((n) => n.id)): Memory => ({
  ...m,
  notes: Object.fromEntries(
    Object.entries(m.notes).map(([id, s]) => [id, ids.includes(id) ? { ...s, box } : s]),
  ),
});

describe("notas do jogo", () => {
  it("22 notas, de Fá3 a Fá6, nos 3 níveis", () => {
    expect(NOTES).toHaveLength(22);
    expect(NOTES.filter((n) => n.level === 1).map((n) => n.name)).toEqual([
      "Sol",
      "Fá",
      "Lá",
      "Si",
      "Ré",
      "Mi",
      "Dó",
    ]);
    expect(Math.min(...NOTES.map((n) => n.step))).toBe(noteById("F3").step);
    expect(Math.max(...NOTES.map((n) => n.step))).toBe(noteById("F6").step);
    expect(noteById("A4").freq).toBeCloseTo(440);
    expect(noteById("C4").freq).toBeCloseTo(261.63, 1);
  });

  it("descreve onde a nota fica", () => {
    expect(placeOf(2)).toBe("na 2ª linha");
    expect(placeOf(1)).toBe("no 1º espaço");
    expect(placeOf(-1)).toBe("logo abaixo da pauta");
    expect(placeOf(-2)).toBe("na 1ª linha suplementar de baixo");
    expect(placeOf(-5)).toBe("abaixo da 2ª linha suplementar");
    expect(placeOf(14)).toBe("na 3ª linha suplementar de cima");
    expect(placeOf(15)).toBe("acima da 3ª linha suplementar");
  });

  it("nenhum arranjo publicado tem o endereço dos jogos ou do calendário", () => {
    const index = JSON.parse(indexJson) as { id: string }[];
    expect(index.map((a) => a.id)).not.toContain("jogos");
    expect(index.map((a) => a.id)).not.toContain("calendario");
  });
});

describe("caixas", () => {
  it("começa com Sol, Fá e Lá no nível 1", () => {
    const m = freshMemory();
    expect(m.introduced).toBe(3);
    expect(levelOf(m)).toBe(1);
    expect(statOf(m, "G4").box).toBe(1);
    expect(statOf(m, "B4").box).toBe(0);
  });

  it("acerto rápido sobe uma caixa; devagar, só até a 2; erro volta para a 1", () => {
    let m = freshMemory();
    m = grade(m, sol, sol.idx, 1000, 5);
    expect(statOf(m, "G4")).toMatchObject({ box: 2, seen: 1, ok: 1, last: 0 });
    m = grade(m, sol, sol.idx, 5000, 6);
    expect(statOf(m, "G4").box).toBe(2);
    m = grade(m, sol, sol.idx, 1000, 7);
    expect(statOf(m, "G4").box).toBe(3);
    m = grade(m, sol, 5, 1000, 8); // respondeu Lá
    expect(statOf(m, "G4").box).toBe(1);
    expect(m.confusions).toEqual({ "4>5": 1 });
    expect(m.recent).toEqual([true, true, true, false]);
    expect(m.tick).toBe(4);
    expect(m.lastPlayed).toBe(8);
  });

  it("não muta a memória recebida", () => {
    const m = freshMemory();
    grade(m, sol, 0, 100, 1);
    expect(m).toEqual(freshMemory());
  });
});

describe("notas novas", () => {
  it("só entra nota nova com todas firmes e 8 das últimas 10 certas", () => {
    let m = freshMemory();
    expect(canIntroduce(m)).toBe(false);
    m = { ...withBoxes(m, 2), recent: Array(10).fill(true) };
    expect(canIntroduce(m)).toBe(true);
    expect(canIntroduce({ ...m, recent: [...Array(7).fill(true), false, false, false] })).toBe(false);
    expect(canIntroduce({ ...m, notes: { ...m.notes, F4: { ...statOf(m, "F4"), box: 1 } } })).toBe(false);
  });

  it("apresenta na ordem da lista e muda de nível no Dó agudo", () => {
    let m: Memory = { ...freshMemory(), introduced: 7 };
    const r = introduce(m);
    expect(r.note.id).toBe("C5");
    expect(r.memory.introduced).toBe(8);
    expect(statOf(r.memory, "C5").box).toBe(1);
    expect(levelOf(r.memory)).toBe(2);
    m = { ...m, introduced: NOTES.length };
    expect(canIntroduce({ ...withBoxes(m, 5), recent: Array(10).fill(true) })).toBe(false);
  });
});

describe("sorteio", () => {
  it("não repete a nota anterior e só usa notas apresentadas", () => {
    const m = freshMemory();
    const rnd = seeded(1);
    let prev: string | undefined;
    for (let i = 0; i < 200; i++) {
      const n = pickNext(m, { prevId: prev, random: rnd });
      expect(["G4", "F4", "A4"]).toContain(n.id);
      expect(n.id).not.toBe(prev);
      prev = n.id;
    }
  });

  it("até quem domina tudo volta a ver o Sol central", () => {
    let m: Memory = withBoxes({ ...freshMemory(), introduced: NOTES.length }, 5);
    const rnd = seeded(7);
    let prev: string | undefined;
    let solCount = 0;
    for (let i = 0; i < 400; i++) {
      const n = pickNext(m, { prevId: prev, random: rnd });
      if (n.id === "G4") solCount++;
      m = grade(m, n, n.idx, 1000, i);
      prev = n.id;
    }
    expect(solCount).toBeGreaterThan(5);
  });

  it("nota errada volta logo", () => {
    let m: Memory = withBoxes({ ...freshMemory(), introduced: 7 }, 5);
    m = { ...m, tick: 50 };
    m = grade(m, sol, 0, 1000, 1);
    const rnd = seeded(3);
    const next = Array.from({ length: 4 }, () => pickNext(m, { random: rnd }).id);
    expect(next).toContain("G4");
  });

  it("no aquecimento só sorteia notas conhecidas", () => {
    let m: Memory = { ...freshMemory(), introduced: 7 };
    m = withBoxes(m, 4, ["G4", "A4"]);
    const rnd = seeded(5);
    for (let i = 0; i < 50; i++)
      expect(["G4", "A4"]).toContain(pickNext(m, { warmup: true, random: rnd }).id);
  });

  it("aquecimento depois de 7 dias sem jogar; nunca na primeira vez", () => {
    const m = { ...freshMemory(), lastPlayed: 1000 };
    expect(needsWarmup(m, 1000 + WARMUP_AFTER_MS + 1)).toBe(true);
    expect(needsWarmup(m, 1000 + WARMUP_AFTER_MS - 1)).toBe(false);
    expect(needsWarmup(freshMemory(), Date.now())).toBe(false);
  });

  it("modo calmo com 3 erros nas últimas 5", () => {
    expect(isCalm({ ...freshMemory(), recent: [true, false, true, false, false] })).toBe(true);
    expect(isCalm({ ...freshMemory(), recent: [true, false, true, true, false] })).toBe(false);
  });
});

describe("memória salva", () => {
  it("lixo vira memória nova", () => {
    expect(normalize(null)).toEqual(freshMemory());
    expect(normalize("x")).toEqual(freshMemory());
    expect(normalize({ v: 2 })).toEqual(freshMemory());
  });

  it("aproveita o que é válido e completa o resto", () => {
    const saved = { ...freshMemory(), introduced: 9, best: 12 } as Partial<Memory>;
    delete (saved.notes as Record<string, unknown>).C5;
    const m = normalize(JSON.parse(JSON.stringify(saved)));
    expect(m.introduced).toBe(9);
    expect(m.best).toBe(12);
    expect(statOf(m, "C5").box).toBe(1); // apresentada: pelo menos caixa 1
    expect(statOf(m, "F6").box).toBe(0);
  });
});

describe("rodada", () => {
  it("estrelas, troca mais comum e marcas de sequência", () => {
    expect([10, 9, 8, 7, 6, 0].map(stars)).toEqual([3, 3, 2, 2, 1, 1]);
    expect(topConfusion({})).toBeNull();
    expect(topConfusion({ "3>5": 2, "4>6": 1 })).toEqual([3, 5]);
    expect([4, 5, 10, 15, 20, 30, 50, 60, 75].map(isMilestone)).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
    ]);
  });
});
