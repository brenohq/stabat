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

- **Vite + React 19 + TypeScript estrito + Tailwind v4 + React Router 7**. Site estático no **Vercel**.
- Rotas (`src/App.tsx`): `/` repertório · `/estudos` catálogo de lições · `/estudos/:licaoId` lição (`escalas-maiores`/`escalas-menores` com `?escala=fa-maior`, e `escala-cromatica`) · `/calendario` agenda da banda · `/jogos/que-nota` jogo de leitura (`/jogos` redireciona) · `/jogos/ritmo` jogo de ritmo · `/:arranjoId` arranjo · `/:arranjoId/:parteId` parte (ex.: `/apt/trompete-sib-1`) · `/quarteto` (+ `/quarteto/:arranjoId/:parteId`) repertório do quarteto, **escondido** (sem link em menu nenhum; `X-Robots-Tag: noindex` no `vercel.json`). No Vercel, `vercel.json` reescreve tudo (menos `arranjos/`, `vendor/`, `assets/`, `og/`, `audio/`) para `index.html`.
- **Coleções** (`src/lib/collections.ts`): `BANDA` e `QUARTETO`, cada uma com prefixo de rota, pasta de dados (`arranjos/` ou `arranjos/quarteto/`), textos e a sua própria "minha parte" (`stabat.myPart` / `stabat.quarteto.myPart`). As páginas leem a coleção com `useCollection()` (contexto posto por `CollectionScope` na rota `/quarteto`); links sempre com `href(col, ...)` (menos o logo "stabat" do topo, que sempre leva a `/`), dados com `fetchIndex/fetchMeta/assetUrl(col, ...)`.
- `src/lib/`: **lógica pura e testada**. Nada de DOM aqui.
  - `timeline.ts`: ritornelos: compasso da partitura ↔ tempo do áudio, ocorrência mais próxima, trecho a..b, tempos do metrônomo.
  - `mix.ts`: volumes (parte: 90% minha parte / 10% banda; arranjo: ligado/solo) e `arrangementFiles`: o que o arranjo baixa (banda toda = `tutti.mp3`; sem uma parte = `sem-<parte>.mp3`; uma parte = `<parte>.mp3`; outras combinações = as partes ligadas).
  - `agenda.ts`: **compromissos do Calendário da Banda** (lista `AGENDA`, horário de Brasília); para marcar um ensaio/show, acrescente uma linha ali. Passado/próximo e "faltam N dias" são calculados na hora.
  - `print.ts` (partes e cópias da impressão) e `pdf.ts` (junta os PDFs com pdf-lib, carregada só ao imprimir).
  - `studies/`: **lições da página Estudos** (`lessons.ts`: catálogo; 7 escalas por lição, uma por nota natural, e a lição cromática), `scales.ts` (escala de uma oitava soletrada, armadura na clave de sol, sobe e desce, `placeScale` = a oitava que cabe na extensão do instrumento, `chromaticNotes`) e `notes.ts` (nota escrita, passo na pauta como no jogo, "soa como").
  - `fingering/`: digitação **pela nota escrita** (as partes estão todas em clave de sol e transpostas): `tables.ts` (pistões para os 5 metais de pistão, vara derivada dos pistões, sax, clarinete, flauta doce barroca; `KEYS` = o que cada diagrama desenha), `instruments.ts` (os 10 instrumentos dos estudos, transposição, **extensão** = o que a cromática mostra, parte da banda → instrumento) e `describe.ts` (em palavras e o que muda da nota anterior). As tabelas são buscadas pela altura (Lá♯ = Si♭); clarinete e flauta doce conferidos no Woodwind Fingering Guide. Testes garantem que toda nota da extensão de todo instrumento tem digitação e que toda escala cabe em todo instrumento.
  - `games/rhythm/`: **"Bate o ritmo"**. `cells.ts` (13 células rítmicas em semicolcheias, negativo = pausa, em 5 níveis: semínimas e mínimas, pausas, colcheias, ponto e contratempo, semicolcheias; onde cada uma pode começar), `measure.ts` (sorteia **dois compassos 4/4** com peso; célula nova obrigatória até ser vista 3 vezes), `judge.ts` (casa toques com ataques, par mais próximo primeiro; janela "bom" ±130 ms, nunca mais que 45% da distância até a nota vizinha; "perfeito" = 45% dela; toque na pausa = toque a mais; dica do primeiro problema; tendência cedo/tarde; mediana do ajuste do atraso) e `scheduler.ts` (caixas 0–5 **por célula**, célula nova com todas firmes e 8 dos últimos 10, aquecimento depois de 7 dias). Puro, com o sorteio injetado.
  - `games/notes.ts` (as 22 notas do "Que nota é essa?", Fá3–Fá6, 3 níveis, na ordem de apresentação) e `games/scheduler.ts` (repetição espaçada: caixas 0–5 por nota, sorteio com peso, nota nova só com todas firmes e 8 das últimas 10, aquecimento depois de 7 dias, modo calmo). Puro, com o sorteio injetado.
  - `parts.ts`, `format.ts`, `storage.ts` (localStorage), `data.ts` (fetch), `types.ts` (formato do `meta.json`).
- `src/audio/engine.ts`: `Engine`, um motor Web Audio imperativo. Recebe as fontes com `setTracks([{url, gain}])` (via `useTracks`) e **só baixa o áudio no primeiro play** (`waiting` até chegar; o anel do play mostra o progresso). Trocar para outros arquivos tocando baixa só o que falta, segue com a mistura anterior e emenda sem parar; o que sai da mistura é solto da memória. Um AudioBuffer por fonte, volume por fonte, metrônomo/contagem sintetizados, loop sem emenda (segmentos agendados), velocidade sem mudar a afinação via SoundTouch (`public/vendor/soundtouch-processor.js`, MPL-2.0). Tem um `AnalyserNode` e `level()` para os testes saberem se há som.
- `src/audio/sfx.ts`: sons curtos dos jogos (tom da nota, arpejo, toque de erro, clique do metrônomo agendável, bloco de madeira do toque), sintetizados no Web Audio.
- `src/audio/rhythmClock.ts`: relógio do "Bate o ritmo". Cliques agendados no AudioContext; o toque (`pointerdown` + `event.timeStamp`) vira hora do áudio menos `outputLatency` e menos o ajuste do aparelho (`stabat.games.rhythmLatency`, medido tocando junto com 8 cliques).
- `src/components/fingering/FingeringDiagram.tsx`: os 5 diagramas de digitação (pistões, vara, sax, clarinete, flauta doce) em SVG próprio, grande ou `mini` (sob cada nota da pauta). `src/components/studies/StudyStaff.tsx`: notas no `NoteStaff` (armadura ou acidente na nota) com os botões embaixo, numa **moldura fixa** (`frameFor`: lugar para a maior armadura, mesma altura e colunas em todas as escalas da lição, para a pauta não pular ao trocar de escala). `NoteDetail` (diagrama grande + leitura) e `StudyControls` (play, metrônomo, andamento) servem às duas lições; `useStudySession` junta nota da vez, piano e tocador. `src/hooks/useScalePlayer.ts` toca a escala (clique do metrônomo do `sfx` + piano); `usePiano.ts` deixa uma nota soando por vez; `useStudyInstrument.ts` lembra o instrumento.
- `src/audio/piano.ts`: piano dos estudos com amostras gravadas em `public/audio/piano/` (Salamander Grand Piano, CC-BY 3.0, ver `LICENSE.txt`), uma a cada terça menor de Ré♯3 a Fá♯6 (cobre Mi3–Fá6, a extensão escrita dos estudos); notas do meio = amostra vizinha com a velocidade ajustada.
- `src/components/games/bravura.ts`: glifos da Bravura copiados do Verovio (clave, semibreve, acidentes, cabeças, pausas, bandeirolas, ponto, clave de percussão, o "4"). `RhythmStaff.tsx`: pauta de uma linha do "Bate o ritmo", um compasso por linha, notas espaçadas pelo tempo, régua dos tempos (1 e 2 e…) com os toques, cursor. `GameCard.tsx`: topo dos jogos (nível, progresso, seguidas), `Overlay` e fim de rodada, usados pelos dois jogos.
- `src/components/games/NoteStaff.tsx`: pauta em SVG próprio (sem Verovio) com os glifos da Bravura (clave E050, semibreve E0A2) copiados do SVG do Verovio; o furo da semibreve é vazado, então `fill` colore só a parte preta.
- `src/score/`: `scoreView.ts` (Verovio → SVG, destaque do compasso, notas soando, pautas apagadas, trecho) e `sizing.ts` (escala por largura × zoom, espaçamento justo no celular).
- `src/components/`, `src/pages/`, `src/hooks/`: React. A posição de execução muda a cada quadro e **não** passa pelo estado do React: o `Score` assina o motor e mexe no SVG direto; os componentes leem valores primitivos com `useEngineValue`.
- Dados publicados em `public/arranjos/<id>/`: `meta.json`, `score.musicxml`, `parts/<parte>.musicxml`, `audio/<parte>.mp3`, `audio/sem-<parte>.mp3` (banda sem a parte), `audio/tutti.mp3` (banda toda; o arranjo começa por ele), `pdf/<parte>.pdf` (PDF da parte gerado pelo MuseScore, para imprimir). Índice: `public/arranjos/index.json`. O `meta.json` traz o tamanho de cada MP3 (`audio`), mostrado ao lado do tempo antes do play.
- Cache: arquivos de `arranjos/` (mp3, musicxml, pdf) são `immutable` por 1 ano no `vercel.json`; por isso **sempre** peça com `assetUrl` (que põe `?v=<versão>`).

## Testes e validação autônoma

- **Arranjo de teste** em `e2e/fixtures/arranjos/teste`: 2 partes, 6 compassos, ritornelo em 3–4, tons puros, gerado por `e2e/fixtures/make_fixture.py` (que também cria `arranjos/quarteto/natal`, com links simbólicos para os arquivos do teste). Os testes usam ele: são rápidos e dão sempre o mesmo resultado. O `vite --mode e2e` (`.env.e2e`) serve esses dados em `/__fixtures__/`.
- Projetos do Playwright: `fixture` (desktop), `mobile` (Pixel 7), `real` (fumaça com os arranjos publicados), `shots` (só com `SHOTS=1`).
- Com `VITE_DEBUG=1` (dev e testes) a página expõe `window.__stabat.page = { engine, timeline, meta, view }` (e o jogo, `window.__stabat.game.state()`: fase, nota da vez, respostas; no "Bate o ritmo" também `tapAt(segundos)` e `finish()`, para tocar em tempos exatos sem depender do relógio real). `e2e/helpers.ts` lê dali: posição, tocando, volumes (`gains()`), nível de som (`level()`), loop.
- Local usa o Chrome do sistema (`channel: "chrome"`); o CI usa o Chromium do Playwright.
- Testes do script Python: `tools/tests/` (unittest, sem MuseScore).

## Preferências do usuário (não regredir)

- Metrônomo **ligado por padrão** em todas as páginas.
- A parte escolhida ("Trompete Sib 1") fica em `localStorage` (`stabat.myPart`) sempre que o músico escolhe/abre uma parte, e o valor salvo é o padrão nos outros seletores.
- Mixer: famílias (Madeiras / Metais agudos / Metais graves) em grupos recolhíveis, fechados por padrão, menos a família da parte do músico, que sempre abre aberta (o "você" aparece de cara).
- Grade do arranjo: a pauta da parte do músico tem faixa azul suave com borda à esquerda (o dourado é do compasso atual).
- Página da parte: volume inicial 90% minha parte / 10% banda; no celular o nome do instrumento só no 1º sistema e mais compassos por linha.
- Barra de controles **fixa no rodapé** nas páginas de arranjo e parte; zoom (lupa −/+) logo à direita do play; sem fresta embaixo.
- Home: cartões clicáveis por inteiro; busca em largura total; "Qual é a sua parte?" com borda amarela pulsando enquanto não há parte.
- Imprimir partes (só no computador, página do arranjo): modal com todas as partes marcadas; cópias por parte lembradas em `stabat.printCopies` (1 na primeira vez); só frente (sem página em branco entre partes); sem a grade. O PDF é o do MuseScore, sem relayout.
- Topo: menu hambúrguer à direita, **nesta ordem**: "Calendário da Banda" (sempre o primeiro), "Estudos" e o grupo recolhível "Jogos" (aberto quando se está num jogo) → "Que nota é essa?", "Bate o ritmo".
- "Que nota é essa?": 7 botões (4+3 no celular) com Dó Ré Mi + letra (C D E), uma cor por nota (borda de baixo do botão; ao acertar, colore só a parte preta da semibreve), toca a nota ao acertar (mudo lembrado em `stabat.games.sound`). Memória em `stabat.games.queNota`. Sem cronômetro na tela; rodadas de 10.
- "Bate o ritmo": pauta de **uma linha** (percussão), sempre **dois compassos 4/4**; o metrônomo conta **4, 3, 2, 1** (número grande na pauta) e segue tocando (metrônomo ligado por padrão); o jogo **nunca toca o ritmo antes** (é leitura); cursor andando só no **nível 1**; andamento escolhido pelo músico (− / +, 40–120, **padrão 60**, lembrado em `stabat.games.rhythmBpm`, também na tela de entrada e na final); só o ataque conta (mínima = um toque). Resultado: notas verdes/vermelhas, toques na régua, "cedo"/"tarde" e uma frase ("Faltou a 2ª nota (compasso 1, tempo 3)"). Memória em `stabat.games.rhythm`; rodadas de 10, estrelas como no jogo de notas.
- Estudos (para os novatos da banda): guia de digitação **esquemático**, no estilo das tabelas dos métodos (desenhos realistas foram testados e descartados). Escala pela nota escrita, uma oitava, sete escalas por lição (Dó a Si), menor só a natural, armadura de clave, só a digitação principal; a escala Cromática mostra toda a extensão do instrumento, de semitom em semitom, com as **duas grafias das alteradas lado a lado** (Lá♯ / Si♭, `chromaticPitches`), lupa −/+ (alturas por linha, `stabat.studies.chromaticPerRow`) e as **cores do "Que nota é essa?"** (`NOTE_COLORS`: barra sob cada nome, nota da vez acesa na cor da letra; `ChromaticStaff`). Barra de compasso depois de cada altura (uma semibreve por compasso; o par Lá♯/Si♭ fica junto) e barra final no fim; **todos os compassos com a mesma largura** (a do par com acidentes + respiro, `chromaticLayout.ts`), a natural no meio. Lupa padrão: 8 alturas por linha no computador, 4 no celular. Trocar de escala não pode mexer a pauta. **Nada de dourado no guia**: apertado = azul-marinho cheio, solto = vazado, chaves não usadas bem claras para situar a mão; o que muda da nota anterior vai em texto cinza (só no painel lateral). **Padrão visual de todos os estudos** (escalas, cromática e os próximos), num só `StudyStaff` + `StudyBoard` (em `LessonPage`): uma semibreve por compasso, compassos de largura igual com barra e barra final; cores do "Que nota é essa?" (barra na cor da letra sob cada nome, nota da vez acesa na cor dela, nome colorido); lupa −/+ (compassos por linha, `stabat.studies.perRow`; padrão 8 no computador, 4 no celular); nota da vez ao lado no computador (lg) e presa no topo, com **altura fixa**, no celular, onde tocar no diagrama abre a digitação ampliada (`FingeringDialog`). No celular a pauta mostra só o nome das notas. Instrumento: o escolhido em `stabat.studies.instrument`; sem escolha, o da "minha parte"; sem parte, a flauta doce. Vara: a mão marca a posição numa régua curta e a vara anda junto. **Som: piano, na altura escrita** (o mesmo para todos os instrumentos; o "soa como" fica só no texto), e cada nota soa o tempo inteiro em que está ativa (até a próxima ou parar).
- Identidade visual: azul-marinho `#1f2a44`, dourado `#a8761c`, papel de partitura, Fraunces (títulos) + Inter. Pode evoluir, mas é o norte.

## Armadilhas conhecidas

- **Verovio**: use `expandNever: true` (os ritornelos vêm do MuseScore; a expansão do Verovio é inconsistente entre grade e parte). O SVG traz CSS próprio com seletores de ID (`#id rect { stroke }`) que vence classes, e CSS sem camada que vence as camadas do Tailwind: estilize retângulos sobrepostos com `style` direto e mantenha o CSS da partitura **fora** de `@layer`. Clique em área vazia não acerta nada no SVG; por isso cada compasso tem um `rect.measure-hit` invisível.
- A MIDI do Verovio dá altura escrita (instrumentos transpositores); não usamos MIDI do Verovio para som.
- **Áudio**: o CLI do MuseScore ignora mute/solo do `audiosettings.json`. Por isso `tools/publicar.py` gera uma partitura por parte (`--score-parts`), copia a configuração de som (Muse Sounds) daquela parte e exporta com um job (`-j`). A soma das partes ≈ a mistura do MuseScore (sem normalização por arquivo).
- O motor usa `sampleRate: 32000` no arranjo (18 partes decodificadas pesam no celular).

## Publicar um arranjo

1. `.mscz` em `~/Documents/MuseScore4/Scores/banda/` com Muse Sounds no Mixer.
2. Linha em `tools/arranjos.json` (`id`, `arquivo`, `titulo`, `subtitulo`, `cor`).
   - Arranjo longo (medley de 4+ min): `"taxa": 22050` na linha. Os MP3 saem a 22050 Hz (64k/80k) e o site decodifica nessa taxa (`sampleRate` no `meta.json`), em vez de 32 kHz: ~30% menos memória no celular. Mudar a taxa só refaz a mistura (sem renderizar de novo).
   - **Quarteto**: `.mscz` em `Scores/quarteto/`, linha em `tools/quarteto.json` e `npm run publicar -- --quarteto <id>` (dados em `public/arranjos/quarteto/`, cache em `tools/.cache/quarteto/`). Enquanto não há nada publicado, `public/arranjos/quarteto/index.json` é `[]` e a página mostra "Em breve".
3. `npm run publicar -- <id>` (precisa de MuseScore AppImage em `~/.local/opt/musescore/`, ffmpeg, numpy). Se o `.mscz` não mudou, não mexe no áudio. Se mudou, renderiza no Muse Sounds **só as partes que mudaram** (impressão digital = `.mscx` da parte + som dela; áudio sem perdas guardado em `tools/.cache/<id>/partes/*.flac`, ~140 MB por arranjo) e refaz a mistura com todas (MP3 de cada parte e "sem a parte"). Também exporta o PDF de cada parte (`pdf/`), refeito só quando o `.mscz` muda. `--forcar` renderiza todas de novo (ex.: depois de atualizar o MuseScore ou o Muse Sounds).
4. `npm run verify` (o projeto `real` toca cada arranjo publicado), commit e push. O Vercel publica; o GitHub Actions testa.

## Links compartilhados (WhatsApp etc.)

- Os robôs de pré-visualização não rodam JavaScript. Para uma página ter miniatura própria: imagem 1200×630 em `public/og/`, uma entrada em `SHARE_PAGES` (`src/lib/share.ts`) e uma reescrita no `vercel.json` (antes da genérica) para o HTML que o build gera (`dist/<file>`).
- A home usa as tags do próprio `index.html` e `public/og/home.png`. As imagens saem de `npm run og`: `tools/og/render.mjs` ("Que nota é essa?", usa a clave e a semibreve de `bravura.ts`), `tools/og/ritmo.mjs` ("Bate o ritmo") e `tools/og/home.mjs` (leque com as capas dos 5 primeiros arranjos do `index.json`; rode de novo quando o repertório mudar).
- O WhatsApp guarda a miniatura de cada link por um tempo: para testar uma imagem nova, mande o link com `?v=2` no fim.

## Deploy

- **Vercel** (projeto ligado ao repositório): cada push na `main` publica em produção (https://stabat.com.br, https://stabat-two.vercel.app); cada PR/branch ganha um link de pré-visualização. Configuração em `vercel.json` (build, reescrita para o app, cache).
- **GitHub Actions** (`.github/workflows/ci.yml`): só verificação (`npm run verify`) em todo push/PR. Não publica nada.
- O Vercel não espera o CI: rode `npm run verify` antes do push na `main`.

Commits: use o e-mail noreply do GitHub já configurado no repositório (não o e-mail de trabalho global).
