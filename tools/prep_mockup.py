"""Gera dados p/ os protótipos: partes separadas em MusicXML + meta.json por arranjo."""
import json, copy, re, sys, pathlib
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent / "mockups" / "data"
TITLES = {"apt": ("APT.", "Rosé & Bruno Mars"), "chuva": ("Chuva de Arroz", "Luan Santana"),
          "colores-24": ("De Colores", "Tradicional · versão 2/4"), "colores-34": ("De Colores", "Tradicional · versão 3/4"),
          "dbgt": ("Dragon Ball GT", "Tema de abertura")}

def slug(s):
    s = s.lower()
    for a, b in [("á","a"),("ã","a"),("é","e"),("í","i"),("ó","o"),("ô","o"),("ú","u"),("ç","c")]: s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

index = []
for d in sorted(ROOT.iterdir()):
    if not d.is_dir(): continue
    tree = ET.parse(d / "score.musicxml"); root = tree.getroot()
    plist = root.find("part-list")
    sparts = plist.findall("score-part"); parts = root.findall("part")
    names = [sp.findtext("part-name") for sp in sparts]
    first = parts[0]; measures = first.findall("measure")
    beats, btype = 4, 4
    for m in measures:
        t = m.find("attributes/time")
        if t is not None: beats, btype = int(t.findtext("beats")), int(t.findtext("beat-type")); break
    tempo = None
    for s in root.iter("sound"):
        if s.get("tempo"): tempo = float(s.get("tempo")); break
    tempo = tempo or 120
    marks = []
    for i, m in enumerate(measures):
        for r in m.iter("rehearsal"): marks.append({"m": i, "label": r.text})
    # atividade: parte x compasso (1 = toca)
    grid = []
    for p in parts:
        grid.append([1 if any(n.find("rest") is None for n in m.findall("note")) else 0 for m in p.findall("measure")])
    (d / "parts").mkdir(exist_ok=True)
    plist_meta = []
    for i, (sp, p) in enumerate(zip(sparts, parts)):
        r2 = copy.deepcopy(root)
        pl2 = r2.find("part-list")
        for x in list(pl2): pl2.remove(x)
        pl2.append(copy.deepcopy(sp))
        for x in r2.findall("part"): r2.remove(x)
        p2 = copy.deepcopy(p); r2.append(p2)
        # garante rehearsal marks/tempo (só existem na 1ª parte)
        if i > 0:
            for mi, (m0, m2) in enumerate(zip(first.findall("measure"), p2.findall("measure"))):
                for dr in m0.findall("direction"):
                    if dr.find(".//rehearsal") is not None or dr.find("sound[@tempo]") is not None:
                        m2.insert(0, copy.deepcopy(dr))
        ps = slug(names[i])
        ET.ElementTree(r2).write(d / "parts" / f"{ps}.musicxml", encoding="UTF-8", xml_declaration=True)
        plist_meta.append({"id": ps, "name": names[i], "index": i})
    title, sub = TITLES.get(d.name, (d.name, ""))
    secs = len(measures) * beats * (4 / btype) / tempo * 60 if btype == 4 else len(measures) * beats / 2 / tempo * 60
    meta = {"id": d.name, "title": title, "subtitle": sub, "tempo": tempo, "time": f"{beats}/{btype}",
            "measures": len(measures), "duration": round(secs), "marks": marks, "parts": plist_meta, "grid": grid}
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False))
    index.append({k: meta[k] for k in ("id", "title", "subtitle", "tempo", "time", "measures", "duration")} | {"nparts": len(names)})
    print(d.name, title, len(measures), tempo, f"{beats}/{btype}", marks)
(ROOT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
