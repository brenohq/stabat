"""Testes do script de publicação (sem MuseScore): usa o arranjo de teste de e2e/fixtures."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import publicar  # noqa: E402

FIXTURE = ROOT / "e2e" / "fixtures" / "arranjos" / "teste" / "score.musicxml"

# posições como o MuseScore exporta (.mpos): 6 compassos, ritornelo em 3–4
MPOS = """<?xml version="1.0" encoding="UTF-8"?>
<score><elements>{els}</elements><events>{evs}</events></score>"""


class TestPublicar(unittest.TestCase):
    def test_slug(self):
        self.assertEqual(publicar.slug("Trompete Sib 1"), "trompete-sib-1")
        self.assertEqual(publicar.slug("Saxhorn Mib 2"), "saxhorn-mib-2")
        self.assertEqual(publicar.slug("Bombardino Dó"), "bombardino-do")

    def test_split_parts_copia_ensaio_e_andamento(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, first, parts = publicar.split_parts(FIXTURE, Path(tmp))
            self.assertEqual([p["id"] for p in parts], ["clarinete-sib-1", "tuba-mib-1"])
            tuba = (Path(tmp) / "tuba-mib-1.musicxml").read_text()
            self.assertIn("<rehearsal>A</rehearsal>", tuba)
            self.assertIn('tempo="120"', tuba)
            self.assertNotIn("Clarinete", tuba)

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
