import { describe, expect, it } from "vitest";
import { sampleFor } from "./piano";

describe("piano", () => {
  it("usa a amostra mais próxima, sem esticar mais de 1,5 semitom", () => {
    expect(sampleFor(60)).toEqual({ name: "C4", rate: 1 });
    expect(sampleFor(70).name).toBe("A4"); // Si♭4: um semitom acima do Lá
    expect(sampleFor(70).rate).toBeCloseTo(2 ** (1 / 12));
    for (let m = 50; m <= 91; m++)
      expect(Math.abs(Math.log2(sampleFor(m).rate) * 12)).toBeLessThanOrEqual(1.5);
  });
});
