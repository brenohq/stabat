import { describe, expect, it } from "vitest";
import { BANDA, QUARTETO, href } from "./collections";

describe("href", () => {
  it("banda fica na raiz", () => {
    expect(href(BANDA)).toBe("/");
    expect(href(BANDA, "apt")).toBe("/apt");
    expect(href(BANDA, "apt", "trompete-sib-1", "smells")).toBe("/apt/trompete-sib-1/smells");
  });
  it("quarteto fica em /quarteto", () => {
    expect(href(QUARTETO)).toBe("/quarteto");
    expect(href(QUARTETO, "noite-feliz")).toBe("/quarteto/noite-feliz");
    expect(href(QUARTETO, "noite-feliz", "trombone")).toBe("/quarteto/noite-feliz/trombone");
  });
  it("cada coleção lembra a sua própria parte", () => {
    expect(BANDA.myPartKey).not.toBe(QUARTETO.myPartKey);
  });
});
