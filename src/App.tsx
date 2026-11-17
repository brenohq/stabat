import { BrowserRouter, Route, Routes } from "react-router";
import { ArrangementPage } from "./pages/ArrangementPage";
import { CalendarPage } from "./pages/CalendarPage";
import { HomePage } from "./pages/HomePage";
import { NotFound } from "./pages/NotFound";
import { PartPage } from "./pages/PartPage";

/** Endereços: /  ·  /calendario  ·  /:arranjo  ·  /:arranjo/:parte  (ex.: /apt/trompete-sib-1)
 *  ·  /:arranjo/:parte/smells (escondida) */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/:arranjoId" element={<ArrangementPage />} />
        <Route path="/:arranjoId/:parteId" element={<PartPage />} />
        {/* escondida: só pela URL, para revisar notas fora da extensão */}
        <Route path="/:arranjoId/:parteId/smells" element={<PartPage smells />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
