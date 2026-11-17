#!/usr/bin/env python3
"""Gera o arranjo de teste usado pelos testes (e2e/fixtures/arranjos/teste).

2 partes (Clarinete Sib 1 = madeira, Tuba Mib 1 = metal grave), 6 compassos 4/4 a 120 bpm,
ritornelo nos compassos 3–4: tocados 1 2 3 4 3 4 5 6 = 8 compassos = 16 s.
PDFs: um texto por página (clarinete 2 páginas, tuba 1), no lugar do PDF do MuseScore.
Áudio: tons puros (clarinete 880 Hz, tuba 110 Hz), um por tempo, gerados com numpy + ffmpeg.
Os arquivos gerados ficam no git; rode de novo só se mudar este script:
  python3 e2e/fixtures/make_fixture.py
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent / "arranjos"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from publicar import split_parts, measure_lengths, time_signatures  # noqa: E402

SR = 44100
BEAT = 0.5  # s (120 bpm)
PARTS = [("Clarinete Sib 1", "Cl. 1", 880.0, "E", 5, -2), ("Tuba Mib 1", "Tba. 1", 110.0, "C", 4, -21)]
PLAYED = [0, 1, 2, 3, 2, 3, 4, 5]
MARKS = {0: "A", 4: "B"}


def note(step, octave):
    return f"<note><pitch><step>{step}</step><octave>{octave}</octave></pitch><duration>1</duration><type>quarter</type></note>"


def score_xml():
    plist, parts = [], []
    for i, (name, abbr, _, step, octv, semi) in enumerate(PARTS, 1):
        plist.append(f'<score-part id="P{i}"><part-name>{name}</part-name><part-abbreviation>{abbr}</part-abbreviation></score-part>')
        ms = []
        for m in range(6):
            attrs = ""
            if m == 0:
                attrs = (f"<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>"
                         f"<clef><sign>G</sign><line>2</line></clef><transpose><diatonic>0</diatonic><chromatic>{semi}</chromatic></transpose></attributes>")
            direc = ""
            if i == 1 and m in MARKS:
                direc = f'<direction placement="above"><direction-type><rehearsal>{MARKS[m]}</rehearsal></direction-type></direction>'
            if i == 1 and m == 0:
                direc += '<direction><sound tempo="120"/></direction>'
            left = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>' if m == 2 else ""
            right = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>' if m == 3 else ""
            ms.append(f'<measure number="{m + 1}">{left}{attrs}{direc}{note(step, octv) * 4}{right}</measure>')
        parts.append(f'<part id="P{i}">{"".join(ms)}</part>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>Teste</work-title></work>'
            f'<part-list>{"".join(plist)}</part-list>{"".join(parts)}</score-partwise>\n')


def tone(freq, seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    per = int(BEAT * SR)
    env = np.minimum(1, np.minimum(np.arange(per) / 400, (per - np.arange(per)) / 2000)).astype(np.float32)
    for b in range(n // per):
        s = b * per
        out[s:s + per] = 0.3 * np.sin(2 * np.pi * freq * t[s:s + per]) * env
    return out


def mp3(sig, path):
    pcm = (np.clip(sig, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-codec:a", "libmp3lame", "-b:a", "64k", str(path)], input=pcm, check=True)


def pdf(pages, path):
    """PDF mínimo (A4, uma linha de texto por página) no lugar do PDF do MuseScore."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for text in pages:
        stream = f"BT /F1 24 Tf 72 760 Td ({text}) Tj ET".encode()
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream.decode()}\nendstream")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {len(objs)} 0 R "
                    "/Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(f"{len(objs)} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offs).encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    path.write_bytes(out)


def make_pdfs(d):
    """clarinete com 2 páginas, tuba com 1 (para conferir a conta de páginas e cópias)"""
    (d / "pdf").mkdir(exist_ok=True)
    pdf(["Clarinete Sib 1 - pagina 1", "Clarinete Sib 1 - pagina 2"], d / "pdf" / "clarinete-sib-1.pdf")
    pdf(["Tuba Mib 1 - pagina 1"], d / "pdf" / "tuba-mib-1.pdf")


def main():
    d = ROOT / "teste"
    (d / "audio").mkdir(parents=True, exist_ok=True)
    (d / "score.musicxml").write_text(score_xml())
    root, first, parts = split_parts(d / "score.musicxml", d / "parts")
    dur = len(PLAYED) * 4 * BEAT
    sigs = [tone(f, dur) for (_, _, f, *_) in PARTS]
    for p, s, other in zip(parts, sigs, reversed(sigs)):
        mp3(s, d / "audio" / f"{p['id']}.mp3")
        mp3(other, d / "audio" / f"sem-{p['id']}.mp3")
    make_pdfs(d)
    mq = measure_lengths(first)
    sigs_ts = time_signatures(first)
    timeline = [{"m": m, "t": int(k * 2000), "end": int((k + 1) * 2000), "beats": 4} for k, m in enumerate(PLAYED)]
    grid = [[1] * 6 for _ in parts]
    meta = {"id": "teste", "title": "Arranjo de Teste", "subtitle": "Fixture dos testes", "hue": [200, 230],
            "tempo": 120, "time": "4/4", "measures": len(mq), "duration": dur, "marks": [{"m": m, "label": l} for m, l in MARKS.items()],
            "parts": parts, "timeline": timeline, "grid": grid, "version": "fixture1"}
    assert sigs_ts[0] == (4, 4)
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    # um segundo arranjo só no índice/busca (reaproveita os arquivos do primeiro)
    d2 = ROOT / "outro"
    d2.mkdir(exist_ok=True)
    meta2 = dict(meta, id="outro", title="Marcha Grave", subtitle="Só para testar a busca", hue=[30, 320])
    meta2["parts"] = [parts[1]]
    (d2 / "meta.json").write_text(json.dumps(meta2, ensure_ascii=False, indent=1))
    index = [{k: m[k] for k in ("id", "title", "subtitle", "hue", "tempo", "time", "measures", "duration", "version")} | {"nparts": len(m["parts"])}
             for m in (meta, meta2)]
    (ROOT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print("ok:", [p["id"] for p in parts])


if __name__ == "__main__":
    main()
