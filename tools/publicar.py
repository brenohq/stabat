#!/usr/bin/env python3
"""Publica arranjos do MuseScore no site stabat.

Para cada arranjo listado em tools/arranjos.json:
  1. exporta a grade em MusicXML e as posições dos compassos (.mpos, já com ritornelos);
  2. gera uma partitura por parte (--score-parts), copia para ela a configuração de som
     (Muse Sounds) do original e exporta o áudio de cada parte em WAV;
  3. mistura no Python: um MP3 mono por parte (com o mesmo ganho para todos, para manter
     o equilíbrio original) e um MP3 "banda sem a parte" para a página de estudo;
  4. separa as partes do MusicXML e grava arranjos/<id>/meta.json e arranjos/index.json.

Uso:
  python3 tools/publicar.py            # todos (pula o áudio se o .mscz não mudou)
  python3 tools/publicar.py apt chuva  # só alguns
  python3 tools/publicar.py --forcar   # refaz o áudio mesmo sem mudança
"""
import argparse, base64, copy, hashlib, io, json, os, re, shutil, subprocess, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "arranjos"
CACHE = ROOT / "tools" / ".cache"
SCORES = Path.home() / "Documents" / "MuseScore4" / "Scores"
MSCORE_CANDIDATES = [Path.home() / ".local/opt/musescore/MuseScore-Studio.AppImage", Path("/usr/bin/mscore4portable"), Path("/usr/bin/mscore")]
SR = 44100
MP3_PARTE = "80k"
MP3_BANDA = "96k"


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


def render_parts_audio(mscz, work):
    """Exporta um WAV por parte usando Muse Sounds. Devolve [(nome, wav_path)] na ordem da grade."""
    raw = run_mscore(["--score-parts", str(mscz)], cwd=work, capture=True)
    data = json.loads(raw[raw.index(b"{"):])
    names = data["parts"]
    with zipfile.ZipFile(mscz) as z:
        audio = json.loads(z.read("audiosettings.json"))
    job, out = [], []
    for i, (name, b64) in enumerate(zip(names, data["partsBin"])):
        src = zipfile.ZipFile(io.BytesIO(base64.b64decode(b64)))
        mscx_name = next(n for n in src.namelist() if n.endswith(".mscx") and "/" not in n)
        mscx = src.read(mscx_name).decode()
        part_id = re.search(r'<Part id="(\d+)"', mscx).group(1)
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
        wav = work / f"parte{i:02d}.wav"
        job.append({"in": pm.name, "out": wav.name})
        out.append((name, wav))
    (work / "job.json").write_text(json.dumps(job, indent=1))
    log(f"   renderizando {len(job)} partes com Muse Sounds…")
    run_mscore(["-j", "job.json"], cwd=work)
    missing = [w.name for _, w in out if not w.exists()]
    if missing:
        sys.exit(f"MuseScore não gerou: {missing}")
    return out


def build_audio(parts_wav, dest, slugs):
    sigs = [read_wav_mono(w) for _, w in parts_wav]
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


def time_signatures(part):
    sigs, cur = [], (4, 4)
    for m in part.findall("measure"):
        t = m.find("attributes/time")
        if t is not None:
            cur = (int(t.findtext("beats")), int(t.findtext("beat-type")))
        sigs.append(cur)
    return sigs


# ---------------------------------------------------------------- principal

def publish(cfg, force):
    aid = cfg["id"]
    src = SCORES / cfg["arquivo"]
    log(f"== {aid}: {src.name}")
    work = CACHE / aid
    work.mkdir(parents=True, exist_ok=True)
    mscz = work / "fonte.mscz"
    shutil.copyfile(src, mscz)
    digest = sha(mscz)
    dest = OUT / aid
    dest.mkdir(parents=True, exist_ok=True)

    run_mscore(["-o", "score.musicxml", "fonte.mscz"], cwd=work)
    run_mscore(["-o", "score.mpos", "fonte.mscz"], cwd=work)
    shutil.copyfile(work / "score.musicxml", dest / "score.musicxml")
    root, first, parts = split_parts(work / "score.musicxml", dest / "parts")
    slugs = [p["id"] for p in parts]

    stamp = work / "audio.sha"
    meta_old = json.loads((dest / "meta.json").read_text()) if (dest / "meta.json").exists() else {}
    if not force and stamp.exists() and stamp.read_text() == digest and (dest / "audio").exists() and meta_old.get("duration"):
        log("   áudio em dia (partitura não mudou)")
        duration = meta_old["duration"]
    else:
        wavs = render_parts_audio(mscz, work)
        names = [n for n, _ in wavs]
        if [slug(n) for n in names] != slugs:
            sys.exit(f"ordem das partes difere entre MusicXML e MuseScore: {names}")
        duration = build_audio(wavs, dest / "audio", slugs)
        for _, w in wavs:
            w.unlink()
        stamp.write_text(digest)

    sigs = time_signatures(first)
    mq = measure_lengths(first)
    timeline = parse_mpos(work / "score.mpos", len(mq), mq, sigs, duration)
    tempo = next((float(s.get("tempo")) for s in root.iter("sound") if s.get("tempo")), 120.0)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--forcar", action="store_true")
    a = ap.parse_args()
    conf = json.loads((ROOT / "tools" / "arranjos.json").read_text())
    for c in conf:
        if not a.ids or c["id"] in a.ids:
            publish(c, a.forcar)
    # índice com todos os arranjos já publicados, na ordem do arquivo de configuração
    index = []
    for c in conf:
        mp = OUT / c["id"] / "meta.json"
        if mp.exists():
            m = json.loads(mp.read_text())
            index.append({k: m[k] for k in ("id", "title", "subtitle", "hue", "tempo", "time", "measures", "duration", "version")} | {"nparts": len(m["parts"])})
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    log(f"índice: {len(index)} arranjos")


if __name__ == "__main__":
    main()
