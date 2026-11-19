#!/usr/bin/env python3
"""Publica arranjos do MuseScore no site stabat.

Para cada arranjo listado em tools/arranjos.json:
  1. exporta a grade em MusicXML e as posições dos compassos (.mpos, já com ritornelos);
  2. gera uma partitura por parte (--score-parts), copia para ela a configuração de som
     (Muse Sounds) do original e exporta o áudio em WAV, mas **só das partes que mudaram**:
     cada parte tem uma impressão digital (o .mscx dela + o som dela) e o áudio sem perdas
     (FLAC) fica guardado em tools/.cache/<id>/partes/;
  3. mistura no Python, com todas as partes (as novas e as guardadas): um MP3 mono por parte
     (com o mesmo ganho para todos, para manter o equilíbrio original) e um MP3 "banda sem a
     parte" para a página de estudo;
  4. separa as partes do MusicXML e grava arranjos/<id>/meta.json e arranjos/index.json;
  5. exporta o PDF de cada parte (o mesmo de "Exportar → Partes" do MuseScore) em
     arranjos/<id>/pdf/<parte>.pdf, para o botão "Imprimir partes".

O quarteto (página escondida stabat.com.br/quarteto) é uma coleção à parte: configuração em
tools/quarteto.json, partituras em Scores/quarteto/, dados em arranjos/quarteto/<id>/ e
áudio guardado em tools/.cache/quarteto/<id>/.

Uso:
  python3 tools/publicar.py            # todos (pula o áudio se o .mscz não mudou)
  python3 tools/publicar.py --quarteto noite-feliz  # um arranjo do quarteto
  python3 tools/publicar.py apt chuva  # só alguns
  python3 tools/publicar.py --forcar   # renderiza o áudio de todas as partes de novo
                                       # (ex.: depois de atualizar o MuseScore ou o Muse Sounds)
"""
import argparse, base64, copy, hashlib, io, json, os, re, shutil, subprocess, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "arranjos"
CACHE = ROOT / "tools" / ".cache"
SCORES = Path.home() / "Documents" / "MuseScore4" / "Scores"
# coleções: configuração, pasta das partituras, pasta publicada e cache de áudio
COLLECTIONS = {
    "banda": {"conf": ROOT / "tools" / "arranjos.json", "scores": SCORES, "out": OUT, "cache": CACHE},
    "quarteto": {"conf": ROOT / "tools" / "quarteto.json", "scores": SCORES / "quarteto", "out": OUT / "quarteto", "cache": CACHE / "quarteto"},
}
MSCORE_CANDIDATES = [Path.home() / ".local/opt/musescore/MuseScore-Studio.AppImage", Path("/usr/bin/mscore4portable"), Path("/usr/bin/mscore")]
SR = 44100
MP3_PARTE = "80k"
MP3_BANDA = "96k"
# mude quando o jeito de renderizar mudar: invalida o áudio guardado de todas as partes
RENDER_VERSION = 1


def log(*a):
    print(*a, flush=True)


def mscore():
    for c in MSCORE_CANDIDATES:
        if c.exists():
            return str(c)
    sys.exit("MuseScore não encontrado")


def run_mscore(args, cwd, capture=False):
    env = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    r = subprocess.run([mscore(), *args], cwd=cwd, env=env, stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=3600)
    return r.stdout if capture else None


def slug(s):
    s = s.lower()
    for a, b in [("á", "a"), ("à", "a"), ("â", "a"), ("ã", "a"), ("é", "e"), ("ê", "e"), ("í", "i"), ("ó", "o"), ("ô", "o"), ("õ", "o"), ("ú", "u"), ("ç", "c")]:
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ---------------------------------------------------------------- áudio

def read_wav_mono(path):
    """Decodifica qualquer WAV (o MuseScore grava float 32) para mono float32 a 44,1 kHz."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                       stdout=subprocess.PIPE, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").copy()


def encode_mp3(signal, path, bitrate):
    pcm = (np.clip(signal, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-codec:a", "libmp3lame", "-b:a", bitrate, str(path)], input=pcm, check=True)


def part_hash(mscx: bytes, tracks) -> str:
    """Impressão digital do áudio de uma parte: as notas (o .mscx da parte, que já traz andamentos
    e ritornelos) e a configuração de som (Muse Sounds) dela."""
    h = hashlib.sha256()
    h.update(f"v{RENDER_VERSION}/{SR}\n".encode())
    h.update(mscx)
    h.update(json.dumps(tracks, sort_keys=True).encode())
    return h.hexdigest()


def changed_parts(hashes, cached, have):
    """Partes a renderizar: as novas, as que mudaram e as sem áudio guardado.
    hashes/cached: {slug: hash} (atual / da última renderização); have: slugs com FLAC."""
    return [sl for sl, h in hashes.items() if cached.get(sl) != h or sl not in have]


def prepare_parts(mscz, work):
    """Uma partitura por parte (com o som só daquela parte). Devolve, na ordem da grade,
    [{"name", "mscz", "hash"}]."""
    raw = run_mscore(["--score-parts", str(mscz)], cwd=work, capture=True)
    data = json.loads(raw[raw.index(b"{"):])
    with zipfile.ZipFile(mscz) as z:
        audio = json.loads(z.read("audiosettings.json"))
    out = []
    for i, (name, b64) in enumerate(zip(data["parts"], data["partsBin"])):
        src = zipfile.ZipFile(io.BytesIO(base64.b64decode(b64)))
        mscx_name = next(n for n in src.namelist() if n.endswith(".mscx") and "/" not in n)
        mscx = src.read(mscx_name)
        part_id = re.search(r'<Part id="(\d+)"', mscx.decode()).group(1)
        a = copy.deepcopy(audio)
        a["tracks"] = [t for t in audio["tracks"] if t.get("partId") == part_id]
        if not a["tracks"]:
            log(f"   ! sem configuração de som para {name} (partId {part_id})")
        pm = work / f"parte{i:02d}.mscz"
        with zipfile.ZipFile(pm, "w", zipfile.ZIP_DEFLATED) as dst:
            for n in src.namelist():
                if n != "audiosettings.json":
                    dst.writestr(n, src.read(n))
            dst.writestr("audiosettings.json", json.dumps(a, indent=4))
        out.append({"name": name, "mscz": pm, "hash": part_hash(mscx, a["tracks"])})
    return out


def render_parts(parts, work, store):
    """Renderiza com Muse Sounds só as partes pedidas ([(slug, mscz)]) e guarda cada uma em
    store/<slug>.flac (sem perdas, mono, 24 bits)."""
    job = [{"in": pm.name, "out": f"{sl}.wav"} for sl, pm in parts]
    (work / "job.json").write_text(json.dumps(job, indent=1))
    run_mscore(["-j", "job.json"], cwd=work)
    missing = [j["out"] for j in job if not (work / j["out"]).exists()]
    if missing:
        sys.exit(f"MuseScore não gerou: {missing}")
    store.mkdir(parents=True, exist_ok=True)
    for sl, _ in parts:
        wav = work / f"{sl}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", str(SR),
                        "-sample_fmt", "s32", "-bits_per_raw_sample", "24", str(store / f"{sl}.flac")], check=True)
        wav.unlink()


def build_audio(sources, dest, slugs):
    sigs = [read_wav_mono(w) for w in sources]
    n = max(len(s) for s in sigs)
    sigs = [np.pad(s, (0, n - len(s))) for s in sigs]
    total = np.sum(sigs, axis=0)
    peak = float(np.max(np.abs(total))) or 1.0
    gain = 0.89 / peak  # ~ -1 dBFS no tutti; mesmo ganho em todos os arquivos
    log(f"   pico do tutti {20*np.log10(peak):+.1f} dB → ganho {20*np.log10(gain):+.1f} dB")
    dest.mkdir(parents=True, exist_ok=True)
    for f in dest.glob("*.mp3"):
        f.unlink()
    for s, sl in zip(sigs, slugs):
        encode_mp3(s * gain, dest / f"{sl}.mp3", MP3_PARTE)
        encode_mp3((total - s) * gain, dest / f"sem-{sl}.mp3", MP3_BANDA)
    return n / SR


# ---------------------------------------------------------------- partitura

def measure_lengths(part):
    """Duração real de cada compasso em semínimas (considera anacruse)."""
    out, div = [], 1
    for m in part.findall("measure"):
        d = m.find("attributes/divisions")
        if d is not None:
            div = int(d.text)
        pos = mx = 0
        for el in m:
            if el.tag == "note":
                if el.find("chord") is None:
                    dur = el.find("duration")
                    pos += int(dur.text) if dur is not None else 0
            elif el.tag == "backup":
                pos -= int(el.find("duration").text)
            elif el.tag == "forward":
                pos += int(el.find("duration").text)
            mx = max(mx, pos)
        out.append(mx / div)
    return out


# ordem dos filhos de <barline> no MusicXML
BARLINE_ORDER = ["bar-style", "footnote", "level", "wavy-line", "segno", "coda", "fermata", "ending", "repeat"]


def copy_endings(m0, m2):
    """Chaves de volta (1ª/2ª) só vêm na 1ª pauta: copia para o compasso m2 de outra parte."""
    for b0 in m0.findall("barline"):
        endings = b0.findall("ending")
        if not endings:
            continue
        loc = b0.get("location", "right")
        b2 = next((b for b in m2.findall("barline") if b.get("location", "right") == loc), None)
        if b2 is None:
            b2 = ET.Element("barline", {"location": loc})
            if loc == "left":  # depois de <print>/<attributes>, antes das notas
                idx = next((k for k, el in enumerate(m2) if el.tag not in ("print", "attributes")), len(m2))
                m2.insert(idx, b2)
            else:
                m2.append(b2)
        if b2.find("ending") is not None:
            continue
        for e in endings:
            e2 = copy.deepcopy(e)
            pos = BARLINE_ORDER.index("ending")
            idx = next((k for k, el in enumerate(b2) if el.tag in BARLINE_ORDER[pos + 1 :]), len(b2))
            b2.insert(idx, e2)


def split_parts(score_xml, dest):
    tree = ET.parse(score_xml)
    root = tree.getroot()
    sparts = root.find("part-list").findall("score-part")
    parts = root.findall("part")
    first = parts[0]
    dest.mkdir(parents=True, exist_ok=True)
    for f in dest.glob("*.musicxml"):
        f.unlink()
    out = []
    for i, (sp, p) in enumerate(zip(sparts, parts)):
        r2 = copy.deepcopy(root)
        pl2 = r2.find("part-list")
        for x in list(pl2):
            pl2.remove(x)
        pl2.append(copy.deepcopy(sp))
        for x in r2.findall("part"):
            r2.remove(x)
        p2 = copy.deepcopy(p)
        r2.append(p2)
        if i > 0:  # letras de ensaio e andamento só existem na 1ª pauta
            for m0, m2 in zip(first.findall("measure"), p2.findall("measure")):
                for dr in m0.findall("direction"):
                    if dr.find(".//rehearsal") is not None or dr.find("sound[@tempo]") is not None:
                        m2.insert(0, copy.deepcopy(dr))
                copy_endings(m0, m2)
        name = sp.findtext("part-name")
        sl = slug(name)
        ET.ElementTree(r2).write(dest / f"{sl}.musicxml", encoding="UTF-8", xml_declaration=True)
        out.append({"id": sl, "name": name, "index": i})
    return root, first, out


def parse_mpos(path, nmeasures, measure_q, sigs, duration):
    ev = [(int(e.get("elid")), int(e.get("position"))) for e in ET.parse(path).getroot().iter("event")]
    ev.sort(key=lambda x: x[1])
    timeline = []
    for k, (m, t) in enumerate(ev):
        if k + 1 < len(ev):
            end = ev[k + 1][1]
        else:  # último compasso: estima pela duração em semínimas e o andamento do anterior
            if k > 0:
                pm, pt = ev[k - 1]
                qms = (t - pt) / max(measure_q[pm], 0.25)
            else:
                qms = 500
            end = min(int(duration * 1000), int(t + qms * measure_q[m]))
        num, den = sigs[m]
        beats = max(1, round(measure_q[m] / (4 / den)))
        if den == 8 and num % 3 == 0 and num > 3:  # 6/8, 9/8, 12/8: pulso na semínima pontuada
            beats = max(1, round(measure_q[m] / 1.5))
        timeline.append({"m": m, "t": t, "end": end, "beats": beats})
    assert max(x["m"] for x in timeline) < nmeasures
    return timeline


def initial_tempo(part, default=120.0):
    """Andamento inicial: no 1º compasso com andamento, vale a última marca (como no MuseScore, em que
    "Andante" e "♩ = 90" no mesmo ponto tocam a 90)."""
    for m in part.findall("measure"):
        tempos = [float(s.get("tempo")) for s in m.iter("sound") if s.get("tempo")]
        if tempos:
            return tempos[-1]
    return default


def time_signatures(part):
    sigs, cur = [], (4, 4)
    for m in part.findall("measure"):
        t = m.find("attributes/time")
        if t is not None:
            cur = (int(t.findtext("beats")), int(t.findtext("beat-type")))
        sigs.append(cur)
    return sigs


# ---------------------------------------------------------------- PDF

def pdf_targets(files, slugs):
    """Arquivos que o MuseScore gerou ("Trompete Sib 1.pdf") → {slug: arquivo}, na ordem da grade.
    Falha se faltar ou sobrar parte."""
    by_slug = {slug(Path(f).stem): f for f in files}
    if sorted(by_slug) != sorted(slugs):
        sys.exit(f"PDFs das partes não batem com a grade: {sorted(by_slug)} ≠ {sorted(slugs)}")
    return {sl: by_slug[sl] for sl in slugs}


def export_pdfs(digest, work, dest, slugs, force):
    """PDF de cada parte, com o layout das partes do MuseScore. Só refaz se o .mscz mudou
    (o PDF leva a data de criação: refazer sempre mudaria os arquivos a cada publicação)."""
    stamp = work / "pdf.sha"
    out = dest / "pdf"
    have = {f.stem for f in out.glob("*.pdf")}
    if not force and stamp.exists() and stamp.read_text() == digest and have == set(slugs):
        log("   PDFs em dia")
        return
    tmp = work / "pdf"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir()
    (work / "pdf-job.json").write_text(json.dumps([{"in": "fonte.mscz", "out": [["pdf/", ".pdf"]]}]))
    run_mscore(["-j", "pdf-job.json"], cwd=work)
    targets = pdf_targets([f.name for f in tmp.glob("*.pdf")], slugs)
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for sl, f in targets.items():
        shutil.move(tmp / f, out / f"{sl}.pdf")
    tmp.rmdir()
    stamp.write_text(digest)
    log(f"   PDFs: {len(targets)} partes")


# ---------------------------------------------------------------- principal

def update_audio(mscz, digest, work, dest, slugs, force):
    """Renderiza só as partes que mudaram e refaz a mistura com todas. Devolve a duração (s)."""
    stamp = work / "audio.sha"
    meta_old = json.loads((dest / "meta.json").read_text()) if (dest / "meta.json").exists() else {}
    audio_ok = (dest / "audio").exists() and meta_old.get("duration")
    if not force and audio_ok and stamp.exists() and stamp.read_text() == digest:
        log("   áudio em dia (partitura não mudou)")
        return meta_old["duration"]

    parts = prepare_parts(mscz, work)
    names = [p["name"] for p in parts]
    if [slug(n) for n in names] != slugs:
        sys.exit(f"ordem das partes difere entre MusicXML e MuseScore: {names}")
    store = work / "partes"
    index_path = store / "partes.json"
    cached = {} if force or not index_path.exists() else json.loads(index_path.read_text())
    hashes = {sl: p["hash"] for sl, p in zip(slugs, parts)}
    have = {f.stem for f in store.glob("*.flac")}
    todo = changed_parts(hashes, cached, have)

    if todo:
        nomes = ", ".join(n for sl, n in zip(slugs, names) if sl in todo)
        log(f"   renderizando {len(todo)} de {len(slugs)} partes com Muse Sounds: {nomes}")
        render_parts([(sl, p["mscz"]) for sl, p in zip(slugs, parts) if sl in todo], work, store)
    else:
        log("   nenhuma parte mudou de som (só layout/texto)")
    for p in parts:
        p["mscz"].unlink()
    for f in store.glob("*.flac"):  # partes que saíram do arranjo
        if f.stem not in hashes:
            f.unlink()
    index_path.write_text(json.dumps(hashes, indent=1))

    if todo or not audio_ok:
        log("   mixando a banda inteira (MP3 de cada parte e \"sem a parte\")")
        duration = build_audio([store / f"{sl}.flac" for sl in slugs], dest / "audio", slugs)
    else:
        duration = meta_old["duration"]
    stamp.write_text(digest)
    return duration


def publish(cfg, force, col=COLLECTIONS["banda"]):
    aid = cfg["id"]
    src = col["scores"] / cfg["arquivo"]
    log(f"== {aid}: {src.name}")
    work = col["cache"] / aid
    work.mkdir(parents=True, exist_ok=True)
    mscz = work / "fonte.mscz"
    shutil.copyfile(src, mscz)
    digest = sha(mscz)
    dest = col["out"] / aid
    dest.mkdir(parents=True, exist_ok=True)

    run_mscore(["-o", "score.musicxml", "fonte.mscz"], cwd=work)
    run_mscore(["-o", "score.mpos", "fonte.mscz"], cwd=work)
    shutil.copyfile(work / "score.musicxml", dest / "score.musicxml")
    root, first, parts = split_parts(work / "score.musicxml", dest / "parts")
    slugs = [p["id"] for p in parts]

    duration = update_audio(mscz, digest, work, dest, slugs, force)
    export_pdfs(digest, work, dest, slugs, force)
    sigs = time_signatures(first)
    mq = measure_lengths(first)
    timeline = parse_mpos(work / "score.mpos", len(mq), mq, sigs, duration)
    tempo = initial_tempo(first)
    marks = [{"m": i, "label": r.text} for i, m in enumerate(first.findall("measure")) for r in m.iter("rehearsal")]
    grid = [[1 if any(n.find("rest") is None for n in m.findall("note")) else 0 for m in p.findall("measure")] for p in root.findall("part")]
    num, den = sigs[0]
    meta = {
        "id": aid, "title": cfg["titulo"], "subtitle": cfg.get("subtitulo", ""), "hue": cfg.get("cor"),
        "tempo": round(tempo), "time": f"{num}/{den}", "measures": len(mq), "duration": round(duration, 3),
        "marks": marks, "parts": parts, "timeline": timeline, "grid": grid, "version": digest[:10],
    }
    (dest / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    log(f"   ok: {len(parts)} partes, {len(mq)} compassos, {len(timeline)} compassos tocados, {duration:.1f}s")
    return meta


def check_ids(conf, col):
    """Um arranjo da banda não pode se chamar como a pasta de outra coleção (arranjos/quarteto/)."""
    if col["out"] != OUT:
        return
    reserved = {c["out"].name for c in COLLECTIONS.values() if c["out"].parent == OUT}
    bad = [c["id"] for c in conf if c["id"] in reserved]
    if bad:
        sys.exit(f"id reservado para outra coleção: {', '.join(bad)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--quarteto", action="store_true", help="publica arranjos do quarteto (tools/quarteto.json)")
    a = ap.parse_args()
    col = COLLECTIONS["quarteto" if a.quarteto else "banda"]
    conf = json.loads(col["conf"].read_text())
    check_ids(conf, col)
    for c in conf:
        if not a.ids or c["id"] in a.ids:
            publish(c, a.forcar, col)
    # índice com todos os arranjos já publicados, na ordem do arquivo de configuração
    index = []
    for c in conf:
        mp = col["out"] / c["id"] / "meta.json"
        if mp.exists():
            m = json.loads(mp.read_text())
            index.append({k: m[k] for k in ("id", "title", "subtitle", "hue", "tempo", "time", "measures", "duration", "version")} | {"nparts": len(m["parts"])})
    col["out"].mkdir(parents=True, exist_ok=True)
    (col["out"] / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    log(f"índice: {len(index)} arranjos")


if __name__ == "__main__":
    main()
