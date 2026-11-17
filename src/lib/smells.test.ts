import { describe, expect, it } from "vitest";
import { isSmell, pitchName, smellRange, smellReport, writtenPitches } from "./smells";

describe("smells", () => {
  it("Sol5 e Dó4 ainda estão dentro; um semitom além já está fora", () => {
    expect(isSmell(79)).toBe(false);
    expect(isSmell(60)).toBe(false);
    expect(isSmell(80)).toBe(true);
    expect(isSmell(59)).toBe(true);
  });
  it("extensão por instrumento", () => {
    const sax = smellRange("Sax Alto Mib 1");
    expect(smellRange("Sax Tenor Sib 2")).toEqual(sax);
    expect([isSmell(84, sax), isSmell(85, sax), isSmell(59, sax)]).toEqual([false, true, true]);
    const cl = smellRange("Clarinete Sib 1");
    expect([isSmell(83, cl), isSmell(84, cl)]).toEqual([false, true]);
    // Saxhorn é metal: regra geral, mesmo começando com "Sax"
    const sh = smellRange("Saxhorn Mib 1");
    expect([isSmell(79, sh), isSmell(80, sh)]).toEqual([false, true]);
    expect(smellRange("Trompete Sib 1")).toEqual(sh);
  });
  it("conta agudas e graves e lista os compassos sem repetir", () => {
    const r = smellReport([
      { m: 4, pitch: 81 },
      { m: 4, pitch: 83 },
      { m: 1, pitch: 55 },
      { m: 2, pitch: 70 },
    ]);
    // no sax, Lá5 e Si5 estão dentro
    expect(smellReport([{ m: 4, pitch: 83 }], smellRange("Sax Alto Mib 1")).measures).toEqual([]);
    expect(r).toEqual({ high: 2, low: 1, measures: [1, 4] });
  });
  it("nome da nota", () => {
    expect(pitchName(60)).toBe("Dó4");
    expect(pitchName(79)).toBe("Sol5");
    expect(pitchName(70)).toBe("Si♭4");
  });
  it("lê as alturas escritas do MusicXML, por compasso, ignorando pausas", () => {
    const xml = `<part id="P1">
      <measure number="1"><attributes><transpose><chromatic>-2</chromatic></transpose></attributes>
        <note><pitch><step>A</step><octave>5</octave></pitch><duration>1</duration></note>
        <note><rest/><duration>1</duration></note>
        <note><chord/><pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch></note>
      </measure>
      <measure number="2"><note default-x="10"><pitch><step>G</step><alter>1</alter><octave>5</octave></pitch></note></measure>
    </part>`;
    expect(writtenPitches(xml)).toEqual([
      { m: 0, pitch: 81 },
      { m: 0, pitch: 58 },
      { m: 1, pitch: 80 },
    ]);
  });
});
