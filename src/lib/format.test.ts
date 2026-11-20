import { describe, expect, it } from "vitest";
import { fmtSize, fmtTime } from "./format";

describe("formatos", () => {
  it("tempo", () => {
    expect(fmtTime(75.4)).toBe("1:15");
  });

  it("tamanho de download em MB, com vírgula", () => {
    expect(fmtSize(1_396_000)).toBe("1,4 MB");
    expect(fmtSize(2_000_000)).toBe("2 MB");
    expect(fmtSize(21_480_000)).toBe("21 MB");
  });
});
