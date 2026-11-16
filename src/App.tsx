import { BrowserRouter, Route, Routes } from "react-router";
import { ArrangementPage } from "./pages/ArrangementPage";
import { HomePage } from "./pages/HomePage";
import { NotFound } from "./pages/NotFound";
import { PartPage } from "./pages/PartPage";

/** Endereços: /  ·  /:arranjo  ·  /:arranjo/:parte  (ex.: /apt/trompete-sib-1) */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:arranjoId" element={<ArrangementPage />} />
        <Route path="/:arranjoId/:parteId" element={<PartPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
