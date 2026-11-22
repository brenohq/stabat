import { describe, expect, it } from "vitest";
import { CELLS, MEASURE, beatsOf, cellById, fitsAt } from "./cells";
import { EXERCISE_LENGTH, eventsOf, generateExercise, type Exercise } from "./measure";
import { calibrate, cellOutcomes, firstIssue, judge, onsetsOf, tendency, windowsFor } from "./judge";
import {
  canIntroduce,
  freshMemory,
  gradeExercise,
  introduce,
  levelOf,
  nextExercise,
  normalize,
  pool,
  statOf,
} from "./scheduler";

/** sorteio previsível (LCG) */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const ex = (ids: string[][]): Exercise => {
  const cells = ids.flatMap((m, mi) => {
    let on = mi * MEASURE;
    return m.map((id) => {
      const cell = cellById(id);
      const p = { cell, on };
      on += beatsOf(cell) * 4;
      return p;
    });
  });
  return { cells, events: eventsOf(cells) };
};

describe("células", () => {
  it("cada célula ocupa tempos inteiros e cabe num compasso", () => {
    for (const c of CELLS) {
      expect(Number.isInteger(beatsOf(c))).toBe(true);
      expect(fitsAt(c, 0)).toBe(true);
    }
  });
  it("o último nível é o das semicolcheias", () => {
    const last = CELLS.filter((c) => c.level === 5);
    expect(last.length).toBeGreaterThan(0);
    expect(last.every((c) => c.durs.includes(1))).toBe(true);
    expect(CELLS.filter((c) => c.level < 5).every((c) => !c.durs.includes(1))).toBe(true);
  });
});

describe("sorteio", () => {
  const all = CELLS.map((cell) => ({ cell, weight: 1 }));
  it("sempre dois compassos inteiros, células sem atravessar o compasso, mínima só no 1 ou no 3", () => {
    const random = seeded(7);
    for (let i = 0; i < 300; i++) {
      const e = generateExercise(all, { random });
      const total = e.events.reduce((a, x) => a + x.dur, 0);
      expect(total).toBe(EXERCISE_LENGTH);
      for (const p of e.cells) {
        const beat = (p.on % MEASURE) / 4;
        expect(fitsAt(p.cell, beat)).toBe(true);
      }
      expect(e.events.filter((x) => !x.rest).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("põe a célula obrigatória e não repete o anterior", () => {
    const random = seeded(3);
    const must = cellById("syn");
    let prev: Exercise | undefined;
    for (let i = 0; i < 50; i++) {
      const e = generateExercise(all, { must, prevKey: prev?.cells.map((p) => p.cell.id).join(","), random });
      expect(e.cells.some((p) => p.cell.id === "syn")).toBe(true);
      if (prev) expect(e.cells.map((p) => p.cell.id)).not.toEqual(prev.cells.map((p) => p.cell.id));
      prev = e;
    }
  });
});

describe("julgamento", () => {
  it("nível 1 mais folgado, nível 2 um pouco menos, do 3 em diante ±130 ms", () => {
    expect(windowsFor([0, 1, 2], 1)).toEqual({ good: 0.22, perfect: 0.11 });
    expect(windowsFor([0, 1, 2], 2).good).toBeCloseTo(0.17);
    for (const l of [3, 4, 5] as const) expect(windowsFor([0, 1, 2], l).good).toBeCloseTo(0.13);
    // nem no nível 1 as janelas de notas vizinhas se encostam (semínimas a 120: 0,5 s)
    expect(2 * windowsFor([0, 0.5], 1).good).toBeLessThan(0.5);
  });

  it("janela de ±130 ms, menor quando as notas são próximas", () => {
    expect(windowsFor([0, 1, 2]).good).toBeCloseTo(0.13);
    // semicolcheias a 60: 250 ms entre notas → 112,5 ms
    const w = windowsFor([0, 0.25, 0.5]);
    expect(w.good).toBeCloseTo(0.1125);
    expect(w.perfect).toBeCloseTo(0.1125 * 0.45);
    expect(2 * w.good).toBeLessThan(0.25);
  });

  it("perfeito, bom, faltou e toque a mais", () => {
    const w = { good: 0.13, perfect: 0.06 };
    const j = judge([0, 1, 2], [0.02, 1.1, 2.5], w);
    expect(j.notes.map((n) => n.grade)).toEqual(["perfect", "good", "miss"]);
    expect(j.notes[1]!.offset).toBeCloseTo(0.1);
    expect(j.extras).toEqual([2]);
    expect(j.ok).toBe(false);
  });

  it("na borda da janela ainda vale; dois toques numa nota: o mais perto casa, o outro sobra", () => {
    const w = { good: 0.13, perfect: 0.06 };
    expect(judge([1], [1.13], w).ok).toBe(true);
    expect(judge([1], [1.131], w).ok).toBe(false);
    const j = judge([1], [0.92, 0.99], w);
    expect(j.notes[0]!.tap).toBe(1);
    expect(j.extras).toEqual([0]);
  });

  it("um toque não serve para duas notas; o par mais próximo vence", () => {
    const w = { good: 0.11, perfect: 0.05 };
    const j = judge([0, 0.25], [0.12, 0.2], w);
    expect(j.notes[0]!.grade).toBe("miss"); // 0,12 está fora da janela da 1ª
    expect(j.notes[1]!.tap).toBe(1);
    expect(j.extras).toEqual([0]);
  });

  it("toque na pausa: compasso errado, célula da pausa errada, dica certa", () => {
    const e = ex([["q", "rq", "h"], ["w"]]);
    const on = onsetsOf(e, 60); // 0, 2, 4
    expect(on).toEqual([0, 2, 4]);
    const taps = [0, 1.01, 2, 4];
    const j = judge(on, taps, windowsFor(on));
    expect(j.ok).toBe(false);
    expect(cellOutcomes(e, j, taps, 60)).toEqual([true, false, true, true]);
    expect(firstIssue(e, j, taps, 60)).toEqual({ kind: "extra", rest: true, measure: 1, beat: 2 });
  });

  it("nota que faltou: diz qual, em que compasso e tempo", () => {
    const e = ex([["w"], ["q", "q", "q", "q"]]);
    const on = onsetsOf(e, 60);
    const taps = [0, 4, 5, 7];
    const j = judge(on, taps, windowsFor(on));
    expect(firstIssue(e, j, taps, 60)).toEqual({ kind: "miss", note: 4, measure: 2, beat: 3 });
  });

  it("tendência: mediana dos desvios", () => {
    expect(tendency([-0.05, -0.04, -0.06, -0.05, 0.01, -0.05, -0.04, -0.05])).toBe("early");
    expect(tendency([0.05, 0.04, 0.06, 0.05, -0.01, 0.05, 0.04, 0.05])).toBe("late");
    expect(tendency([0.01, -0.01, 0, 0.02, -0.02, 0, 0.01, -0.01])).toBe(null);
    expect(tendency([-0.1, -0.1])).toBe(null);
  });

  it("ajuste do atraso: mediana, ignora toques longe dos cliques", () => {
    const clicks = [0, 0.75, 1.5, 2.25, 3];
    const r = calibrate([0.05, 0.79, 1.56, 2.3, 3.04, 5], clicks);
    expect(r.used).toBe(5);
    expect(r.offsetMs).toBeCloseTo(50);
  });
});

describe("progressão", () => {
  it("começa no nível 1 com semínima, mínima e semibreve", () => {
    const m = freshMemory();
    expect(pool(m).map((c) => c.id)).toEqual(["q", "h", "w"]);
    expect(levelOf(m)).toBe(1);
    expect(canIntroduce(m)).toBe(false);
  });

  it("normaliza lixo e completa memória parcial", () => {
    expect(normalize("x")).toEqual(freshMemory());
    const m = normalize({ v: 1, introduced: 99, cells: { q: { box: 9, seen: 1, ok: 1, last: 0 } } });
    expect(m.introduced).toBe(CELLS.length);
    expect(statOf(m, "q").box).toBe(5);
    expect(statOf(m, "sse").box).toBe(1);
  });

  it("acerto sobe a caixa, erro volta para a 1; célula nova depois de 8 de 10 com tudo firme", () => {
    let m = freshMemory();
    const random = seeded(11);
    for (let i = 0; i < 10; i++) {
      const e = nextExercise(m, { random });
      m = gradeExercise(
        m,
        e,
        e.cells.map(() => true),
        0,
      );
    }
    expect(pool(m).every((c) => statOf(m, c.id).box >= 2)).toBe(true);
    expect(canIntroduce(m)).toBe(true);
    const { memory, cell } = introduce(m);
    expect(cell.id).toBe("hd");
    expect(canIntroduce(memory)).toBe(false);
    // a célula nova aparece nos próximos exercícios
    const e = nextExercise(memory, { random });
    expect(e.cells.some((p) => p.cell.id === "hd")).toBe(true);
    const wrong = gradeExercise(
      memory,
      e,
      e.cells.map((p) => p.cell.id !== "hd"),
      0,
    );
    expect(statOf(wrong, "hd").box).toBe(1);
    expect(wrong.recent.at(-1)).toBe(false);
  });

  it("aquecimento: só células firmes (e a semínima)", () => {
    const m = normalize({
      v: 1,
      introduced: 7,
      cells: Object.fromEntries(
        CELLS.map((c) => [c.id, { box: ["q", "h", "ee"].includes(c.id) ? 4 : 1, seen: 5, ok: 5, last: 0 }]),
      ),
      tick: 20,
      recent: [],
      best: 0,
      lastPlayed: 1,
    });
    const random = seeded(5);
    for (let i = 0; i < 30; i++) {
      const e = nextExercise(m, { warmup: true, random });
      for (const p of e.cells) expect(["q", "h", "ee"]).toContain(p.cell.id);
    }
  });
});
