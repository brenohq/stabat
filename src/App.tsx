import { BrowserRouter, Route, Routes } from "react-router";
import { CollectionScope } from "./hooks/useCollection";
import { QUARTETO } from "./lib/collections";
import { ArrangementPage } from "./pages/ArrangementPage";
import { CalendarPage } from "./pages/CalendarPage";
import { GamesPage } from "./pages/GamesPage";
import { HomePage } from "./pages/HomePage";
import { LessonPage } from "./pages/LessonPage";
import { NoteGamePage } from "./pages/NoteGamePage";
import { NotFound } from "./pages/NotFound";
import { PartPage } from "./pages/PartPage";
import { RhythmGamePage } from "./pages/RhythmGamePage";
import { StudiesPage } from "./pages/StudiesPage";

/** Endereços: /  ·  /estudos  ·  /estudos/:licao  ·  /calendario  ·  /jogos  ·  /jogos/que-nota  ·  /jogos/ritmo  ·  /:arranjo  ·  /:arranjo/:parte  (ex.: /apt/trompete-sib-1)
 *  ·  /:arranjo/:parte/smells (escondida)
 *  ·  /quarteto (escondida: repertório do quarteto, com as mesmas páginas de arranjo e parte embaixo) */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/estudos" element={<StudiesPage />} />
        <Route path="/estudos/:licaoId" element={<LessonPage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/jogos" element={<GamesPage />} />
        <Route path="/jogos/que-nota" element={<NoteGamePage />} />
        <Route path="/jogos/ritmo" element={<RhythmGamePage />} />
        <Route path="/:arranjoId" element={<ArrangementPage />} />
        <Route path="/:arranjoId/:parteId" element={<PartPage />} />
        {/* escondida: só pela URL, para revisar notas fora da extensão */}
        <Route path="/:arranjoId/:parteId/smells" element={<PartPage smells />} />
        {/* escondida: só pela URL, nenhum menu leva até aqui (e vercel.json manda os robôs não indexarem) */}
        <Route path="/quarteto" element={<CollectionScope collection={QUARTETO} />}>
          <Route index element={<HomePage />} />
          <Route path=":arranjoId" element={<ArrangementPage />} />
          <Route path=":arranjoId/:parteId" element={<PartPage />} />
          <Route path=":arranjoId/:parteId/smells" element={<PartPage smells />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
