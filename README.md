# stabat

Site da banda para estudar os arranjos em casa:
- ouvir a banda inteira;
- ligar e desligar instrumentos;
- clicar num compasso para tocar dali;
- praticar a própria parte com a banda mais baixa de fundo, metrônomo, contagem, trecho repetido e velocidade reduzida.

Feito com Vite, React, TypeScript e Tailwind. Publicado pelo Vercel em https://stabat.com.br.

## Desenvolvimento

```sh
asdf install          # Node e Python nas versões de .tool-versions
npm ci
pip install -r tools/requirements.txt
npm run dev           # http://localhost:5173
npm run verify        # tudo: tipos, lint, testes, build e testes no navegador
```

Mais detalhes de arquitetura e testes estão em [CLAUDE.md](CLAUDE.md).

## Publicar um arranjo novo

1. Termine o arranjo no MuseScore Studio, com os sons Muse Sounds configurados no Mixer. O arquivo fica em `~/Documents/MuseScore4/Scores/`.
2. Acrescente uma linha em `tools/arranjos.json`:
   ```json
   {"id": "nome-curto", "arquivo": "Nome - Banda.mscz", "titulo": "Nome", "subtitulo": "Autor", "cor": [200, 230]}
   ```
3. `npm run publicar -- nome-curto` gera o MusicXML, as posições dos compassos e um MP3 por parte em `public/arranjos/nome-curto/`.
4. `npm run verify`, depois commit e push. O Vercel publica e o GitHub Actions testa.

Endereços: `/nome-curto` (arranjo) e `/nome-curto/trompete-sib-1` (parte).

## Créditos

- Partitura desenhada com [Verovio](https://www.verovio.org).
- Velocidade sem mudar a afinação com [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (MPL-2.0).
- Áudio gerado com Muse Sounds no MuseScore Studio.
