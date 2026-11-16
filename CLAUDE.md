# stabat — guia para agentes

Site da banda (stabat.com.br) para estudar arranjos em casa. A interface é em **português do Brasil**; textos novos também.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | servidor local (http://localhost:5173) com os arranjos reais |
| `npm run verify` | **rode antes de dizer que terminou**: tipos, lint, Prettier, Vitest, testes Python, build e Playwright |
| `npm test` / `npm run test:watch` | só os testes unitários (Vitest, `src/**/*.test.ts`) |
| `npm run e2e` | só os testes de navegador (Playwright) |
| `npx playwright test -g "trecho"` | um teste pelo nome |
| `npm run shots` | capturas de todas as telas (desktop e celular) em `.shots/*.png`: **abra e olhe** depois de mudar o visual |
| `npm run format` | corrige a formatação (Prettier) |
| `npm run publicar -- <id>` | gera um arranjo a partir do MuseScore (ver abaixo) |

Versões travadas em `.tool-versions` (asdf): Node e Python. Dependência Python: `tools/requirements.txt`.

## Arquitetura

- **Vite + React 19 + TypeScript estrito + Tailwind v4 + React Router 7**. Site estático no GitHub Pages.
- Rotas (`src/App.tsx`): `/` repertório · `/:arranjoId` arranjo · `/:arranjoId/:parteId` parte (ex.: `/apt/trompete-sib-1`). O build copia `index.html` para `404.html` para os endereços limpos funcionarem no Pages.
- `src/lib/`: **lógica pura e testada**. Nada de DOM aqui.
  - `timeline.ts`: ritornelos: compasso da partitura ↔ tempo do áudio, ocorrência mais próxima, trecho a..b, tempos do metrônomo.
  - `mix.ts`: volumes (parte: 85% minha parte / 15% banda; arranjo: ligado/solo).
  - `parts.ts`, `format.ts`, `storage.ts` (localStorage), `data.ts` (fetch), `types.ts` (formato do `meta.json`).
- `src/audio/engine.ts`: `Engine`, um motor Web Audio imperativo: uma parte por AudioBuffer, volume por parte, metrônomo/contagem sintetizados, loop sem emenda (segmentos agendados), velocidade sem mudar a afinação via SoundTouch (`public/vendor/soundtouch-processor.js`, MPL-2.0). Tem um `AnalyserNode` e `level()` para os testes saberem se há som.
- `src/score/`: `scoreView.ts` (Verovio → SVG, destaque do compasso, notas soando, pautas apagadas, trecho) e `sizing.ts` (escala por largura × zoom, espaçamento justo no celular).
- `src/components/`, `src/pages/`, `src/hooks/`: React. A posição de execução muda a cada quadro e **não** passa pelo estado do React: o `Score` assina o motor e mexe no SVG direto; os componentes leem valores primitivos com `useEngineValue`.
- Dados publicados em `public/arranjos/<id>/`: `meta.json`, `score.musicxml`, `parts/<parte>.musicxml`, `audio/<parte>.mp3`, `audio/sem-<parte>.mp3` (banda sem a parte). Índice: `public/arranjos/index.json`.

## Testes e validação autônoma

- **Arranjo de teste** em `e2e/fixtures/arranjos/teste`: 2 partes, 6 compassos, ritornelo em 3–4, tons puros, gerado por `e2e/fixtures/make_fixture.py`. Os testes usam ele: são rápidos e dão sempre o mesmo resultado. O `vite --mode e2e` (`.env.e2e`) serve esses dados em `/__fixtures__/`.
- Projetos do Playwright: `fixture` (desktop), `mobile` (Pixel 7), `real` (fumaça com os arranjos publicados), `shots` (só com `SHOTS=1`).
- Com `VITE_DEBUG=1` (dev e testes) a página expõe `window.__stabat.page = { engine, timeline, meta, view }`. `e2e/helpers.ts` lê dali: posição, tocando, volumes (`gains()`), nível de som (`level()`), loop.
- Local usa o Chrome do sistema (`channel: "chrome"`); o CI usa o Chromium do Playwright.
- Testes do script Python: `tools/tests/` (unittest, sem MuseScore).

## Preferências do usuário (não regredir)

- Metrônomo **ligado por padrão** em todas as páginas.
- A parte escolhida ("Trompete Sib 1") fica em `localStorage` (`stabat.myPart`) sempre que o músico escolhe/abre uma parte, e o valor salvo é o padrão nos outros seletores.
- Mixer: famílias (Madeiras / Metais agudos / Metais graves) em grupos recolhíveis, fechados por padrão.
- Página da parte: volume inicial 85% minha parte / 15% banda; no celular o nome do instrumento só no 1º sistema e mais compassos por linha.
- Barra de controles **fixa no rodapé** nas páginas de arranjo e parte; zoom (lupa −/+) logo à direita do play; sem fresta embaixo.
- Home: cartões clicáveis por inteiro; busca em largura total; "Qual é a sua parte?" com borda amarela pulsando enquanto não há parte.
- Identidade visual: azul-marinho `#1f2a44`, dourado `#a8761c`, papel de partitura, Fraunces (títulos) + Inter. Pode evoluir, mas é o norte.

## Armadilhas conhecidas

- **Verovio**: use `expandNever: true` (os ritornelos vêm do MuseScore; a expansão do Verovio é inconsistente entre grade e parte). O SVG traz CSS próprio com seletores de ID (`#id rect { stroke }`) que vence classes, e CSS sem camada que vence as camadas do Tailwind: estilize retângulos sobrepostos com `style` direto e mantenha o CSS da partitura **fora** de `@layer`. Clique em área vazia não acerta nada no SVG; por isso cada compasso tem um `rect.measure-hit` invisível.
- A MIDI do Verovio dá altura escrita (instrumentos transpositores); não usamos MIDI do Verovio para som.
- **Áudio**: o CLI do MuseScore ignora mute/solo do `audiosettings.json`. Por isso `tools/publicar.py` gera uma partitura por parte (`--score-parts`), copia a configuração de som (Muse Sounds) daquela parte e exporta com um job (`-j`). A soma das partes ≈ a mistura do MuseScore (sem normalização por arquivo).
- O motor usa `sampleRate: 32000` no arranjo (18 partes decodificadas pesam no celular).

## Publicar um arranjo

1. `.mscz` em `~/Documents/MuseScore4/Scores/` com Muse Sounds no Mixer.
2. Linha em `tools/arranjos.json` (`id`, `arquivo`, `titulo`, `subtitulo`, `cor`).
3. `npm run publicar -- <id>` (precisa de MuseScore AppImage em `~/.local/opt/musescore/`, ffmpeg, numpy). Só refaz o áudio se o `.mscz` mudou (`--forcar` para sempre).
4. `npm run verify` (o projeto `real` toca cada arranjo publicado), commit e push. O GitHub Actions testa, faz o build e publica.

## Deploy

`.github/workflows/ci.yml`: em todo push/PR roda `npm run verify`. Na `main`, faz o build com `STABAT_BASE` (variável do repositório; padrão `/stabat/` enquanto o site está em brenohq.github.io/stabat) e publica no Pages. Com o domínio próprio: arquivo `public/CNAME` com `stabat.com.br`, variável `STABAT_BASE=/` e domínio configurado no Pages.

Commits: use o e-mail noreply do GitHub já configurado no repositório (não o e-mail de trabalho global).
