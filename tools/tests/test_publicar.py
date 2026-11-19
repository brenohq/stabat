"""Testes do script de publicação (sem MuseScore): usa o arranjo de teste de e2e/fixtures."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import publicar  # noqa: E402

def json_load(path):
    return json.loads(Path(path).read_text())


FIXTURE = ROOT / "e2e" / "fixtures" / "arranjos" / "teste" / "score.musicxml"

# posições como o MuseScore exporta (.mpos): 6 compassos, ritornelo em 3–4
MPOS = """<?xml version="1.0" encoding="UTF-8"?>
<score><elements>{els}</elements><events>{evs}</events></score>"""


class TestPublicar(unittest.TestCase):
    def test_slug(self):
        self.assertEqual(publicar.slug("Trompete Sib 1"), "trompete-sib-1")
        self.assertEqual(publicar.slug("Saxhorn Mib 2"), "saxhorn-mib-2")
        self.assertEqual(publicar.slug("Bombardino Dó"), "bombardino-do")

    def test_quarteto_tem_pastas_proprias(self):
        q = publicar.COLLECTIONS["quarteto"]
        self.assertEqual(q["out"], publicar.OUT / "quarteto")
        self.assertEqual(q["cache"], publicar.CACHE / "quarteto")
        self.assertEqual(q["scores"], publicar.SCORES / "quarteto")
        for c in publicar.COLLECTIONS.values():
            for cfg in json_load(c["conf"]):
                self.assertTrue({"id", "arquivo", "titulo"} <= cfg.keys(), cfg)

    def test_id_da_banda_nao_pode_ser_quarteto(self):
        banda, quarteto = publicar.COLLECTIONS["banda"], publicar.COLLECTIONS["quarteto"]
        with self.assertRaises(SystemExit):
            publicar.check_ids([{"id": "quarteto"}], banda)
        publicar.check_ids([{"id": "apt"}], banda)
        publicar.check_ids([{"id": "quarteto"}], quarteto)  # dentro do quarteto, tanto faz

    def test_part_hash_muda_com_notas_ou_som(self):
        tracks = [{"partId": "3", "out": {"volumeDb": 0}}]
        h = publicar.part_hash(b"<pitch>62</pitch>", tracks)
        self.assertEqual(h, publicar.part_hash(b"<pitch>62</pitch>", copy.deepcopy(tracks)))
        self.assertNotEqual(h, publicar.part_hash(b"<pitch>50</pitch>", tracks))
        self.assertNotEqual(h, publicar.part_hash(b"<pitch>62</pitch>", [{"partId": "3", "out": {"volumeDb": -3}}]))

    def test_taxa_muda_carimbo_e_versao(self):
        d = "ab" * 32
        self.assertEqual(publicar.audio_stamp(d, None), d)
        self.assertEqual(publicar.version(d, None), d[:10])
        self.assertNotEqual(publicar.audio_stamp(d, 22050), d)
        self.assertNotEqual(publicar.version(d, 22050), d[:10])
        self.assertEqual(len(publicar.version(d, 22050)), 10)

    def test_changed_parts_so_o_que_mudou(self):
        hashes = {"clarinete-sib-1": "a", "tuba-mib-1": "b", "trompete-sib-1": "c"}
        cached = {"clarinete-sib-1": "a", "tuba-mib-1": "velho"}
        have = {"clarinete-sib-1", "tuba-mib-1"}
        # tuba mudou; trompete é nova
        self.assertEqual(publicar.changed_parts(hashes, cached, have), ["tuba-mib-1", "trompete-sib-1"])
        # nada mudou
        self.assertEqual(publicar.changed_parts(cached | {"tuba-mib-1": "velho"}, cached, have), [])
        # sem o FLAC guardado, renderiza de novo
        self.assertEqual(publicar.changed_parts({"clarinete-sib-1": "a"}, cached, set()), ["clarinete-sib-1"])

    def test_pdf_targets_na_ordem_da_grade(self):
        files = ["Tuba Mib 1.pdf", "Clarinete Sib 1.pdf"]
        self.assertEqual(publicar.pdf_targets(files, ["clarinete-sib-1", "tuba-mib-1"]),
                         {"clarinete-sib-1": "Clarinete Sib 1.pdf", "tuba-mib-1": "Tuba Mib 1.pdf"})
        with self.assertRaises(SystemExit):
            publicar.pdf_targets(files, ["clarinete-sib-1"])

    def test_split_parts_copia_ensaio_e_andamento(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, first, parts = publicar.split_parts(FIXTURE, Path(tmp))
            self.assertEqual([p["id"] for p in parts], ["clarinete-sib-1", "tuba-mib-1"])
            tuba = (Path(tmp) / "tuba-mib-1.musicxml").read_text()
            self.assertIn("<rehearsal>A</rehearsal>", tuba)
            self.assertIn('tempo="120"', tuba)
            self.assertNotIn("Clarinete", tuba)

    def test_initial_tempo_vale_a_ultima_marca_do_ponto(self):
        ET = publicar.ET
        part = ET.fromstring(
            '<part><measure><direction><sound tempo="92"/></direction>'
            '<direction><sound tempo="90"/></direction></measure>'
            '<measure><direction><sound tempo="60"/></direction></measure></part>'
        )
        self.assertEqual(publicar.initial_tempo(part), 90)
        self.assertEqual(publicar.initial_tempo(ET.fromstring("<part><measure/></part>")), 120)

    def test_copia_chaves_de_volta(self):
        ET = publicar.ET
        m0 = ET.fromstring(
            '<measure><barline location="left"><ending number="1" type="start">1.</ending></barline>'
            '<note/><barline location="right"><bar-style>light-heavy</bar-style>'
            '<ending number="1" type="stop"/><repeat direction="backward"/></barline></measure>'
        )
        m2 = ET.fromstring(
            '<measure><attributes/><note/><barline location="right"><bar-style>light-heavy</bar-style>'
            '<repeat direction="backward"/></barline></measure>'
        )
        publicar.copy_endings(m0, m2)
        self.assertEqual([el.tag for el in m2], ["attributes", "barline", "note", "barline"])
        self.assertEqual(m2[1].find("ending").get("type"), "start")
        self.assertEqual([el.tag for el in m2[3]], ["bar-style", "ending", "repeat"])
        publicar.copy_endings(m0, m2)  # não duplica
        self.assertEqual(len(m2.findall(".//ending")), 2)

    def test_duracao_dos_compassos_e_formula(self):
        _, first, _ = publicar.split_parts(FIXTURE, Path(tempfile.mkdtemp()))
        self.assertEqual(publicar.measure_lengths(first), [4.0] * 6)
        self.assertEqual(publicar.time_signatures(first)[0], (4, 4))

    def test_parse_mpos_com_ritornelo(self):
        played = [0, 1, 2, 3, 2, 3, 4, 5]
        els = "".join(f'<element id="{i}" x="0" y="0" sx="1" sy="1" page="0"/>' for i in range(6))
        evs = "".join(f'<event elid="{m}" position="{k * 2000}"/>' for k, m in enumerate(played))
        with tempfile.NamedTemporaryFile("w", suffix=".mpos", delete=False) as f:
            f.write(MPOS.format(els=els, evs=evs))
        tl = publicar.parse_mpos(f.name, 6, [4.0] * 6, [(4, 4)] * 6, 16.0)
        self.assertEqual([e["m"] for e in tl], played)
        self.assertEqual(tl[3], {"m": 3, "t": 6000, "end": 8000, "beats": 4})
        self.assertEqual(tl[-1]["end"], 16000)  # último compasso estimado pelo andamento do anterior

    def test_pulso_composto_6_8(self):
        evs = '<event elid="0" position="0"/><event elid="1" position="1500"/>'
        with tempfile.NamedTemporaryFile("w", suffix=".mpos", delete=False) as f:
            f.write(MPOS.format(els="", evs=evs))
        tl = publicar.parse_mpos(f.name, 2, [3.0, 3.0], [(6, 8)] * 2, 3.0)
        self.assertEqual(tl[0]["beats"], 2)


if __name__ == "__main__":
    unittest.main()
