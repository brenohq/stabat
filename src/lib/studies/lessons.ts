/**
 * Catálogo de lições da página Estudos. Cada lição vale para todos os instrumentos: as escalas
 * são pela nota escrita (cada músico treina com o próprio instrumento, lendo como na parte).
 * Para acrescentar uma escala, ponha a tônica aqui; os testes conferem que ela cabe na extensão de
 * todo instrumento e que toda nota tem digitação.
 */
import { makeScale, type Mode, type Scale } from "./scales";

interface LessonBase {
  /** slug da rota: /estudos/<id> */
  id: string;
  title: string;
  summary: string;
}
export interface ScaleLesson extends LessonBase {
  kind: "scales";
  mode: Mode;
  scales: Scale[];
}
/** todas as notas do instrumento, de semitom em semitom (a extensão vem do instrumento) */
export interface ChromaticLesson extends LessonBase {
  kind: "chromatic";
}
export type Lesson = ScaleLesson | ChromaticLesson;

// uma escala por nota natural, na ordem do Dó ao Si
const TONICS = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

const scales = (id: string, title: string, summary: string, mode: Mode): ScaleLesson => ({
  kind: "scales",
  id,
  title,
  summary,
  mode,
  scales: TONICS.map((t) => makeScale(t, mode)),
});

export const LESSONS: Lesson[] = [
  scales(
    "escalas-maiores",
    "Escalas Maiores",
    "As sete escalas maiores, de Dó a Si, uma oitava subindo e descendo, com a digitação de cada nota no seu instrumento.",
    "major",
  ),
  scales(
    "escalas-menores",
    "Escalas Menores",
    "As sete escalas menores naturais, de Dó a Si, uma oitava subindo e descendo. O som mais escuro das menores, nota por nota.",
    "minor",
  ),
  {
    kind: "chromatic",
    id: "escala-cromatica",
    title: "Escala Cromática",
    summary:
      "Todas as notas do seu instrumento, de semitom em semitom, na clave de sol, com a digitação de cada uma.",
  },
];

export const lessonById = (id: string | undefined) => LESSONS.find((l) => l.id === id);
