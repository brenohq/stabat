import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ArrangementPage } from "./pages/ArrangementPage";
import { CalendarPage } from "./pages/CalendarPage";
import { HomePage } from "./pages/HomePage";
import { NoteGamePage } from "./pages/NoteGamePage";
import { NotFound } from "./pages/NotFound";
import { PartPage } from "./pages/PartPage";

/** Endereços: /  ·  /calendario  ·  /jogos/que-nota  ·  /:arranjo  ·  /:arranjo/:parte  (ex.: /apt/trompete-sib-1)
 *  ·  /:arranjo/:parte/smells (escondida) */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/jogos" element={<Navigate to="/jogos/que-nota" replace />} />
        <Route path="/jogos/que-nota" element={<NoteGamePage />} />
        <Route path="/:arranjoId" element={<ArrangementPage />} />
        <Route path="/:arranjoId/:parteId" element={<PartPage />} />
        {/* escondida: só pela URL, para revisar notas fora da extensão */}
        <Route path="/:arranjoId/:parteId/smells" element={<PartPage smells />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
