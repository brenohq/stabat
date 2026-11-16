/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Connect, type Plugin } from "vite";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".musicxml": "application/xml",
  ".xml": "application/xml",
};

/** Serve e2e/fixtures em /__fixtures__/ (dev e preview) — dados pequenos e estáveis para os testes. */
function fixtures(base: string): Plugin {
  const root = resolve("e2e/fixtures");
  const prefix = `${base}__fixtures__/`;
  const mw: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? "").split("?")[0] ?? "";
    if (!url.startsWith(prefix)) return next();
    const file = normalize(join(root, decodeURIComponent(url.slice(prefix.length))));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
    createReadStream(file).pipe(res);
  };
  return {
    name: "stabat-fixtures",
    configureServer: (s) => void s.middlewares.use(mw),
    configurePreviewServer: (s) => void s.middlewares.use(mw),
  };
}

const base = "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), fixtures(base)],
  build: { chunkSizeWarningLimit: 8000 },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
