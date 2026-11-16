# stabat

Site da banda para estudar os arranjos em casa: ouvir a banda inteira, ligar e desligar instrumentos, clicar num compasso para tocar dali e praticar a própria parte com a banda mais baixa de fundo.

Publicado com GitHub Pages em **https://stabat.com.br**.

## Como publicar um arranjo novo

1. Termine o arranjo no MuseScore Studio. O arquivo deve estar em `~/Documents/MuseScore4/Scores/`, com os sons Muse Sounds configurados no Mixer.
2. Acrescente uma linha em `tools/arranjos.json`:
   ```json
   {"id": "nome-curto", "arquivo": "Nome - Banda.mscz", "titulo": "Nome", "subtitulo": "Autor", "cor": [200, 230]}
   ```
   `id` vira o endereço (`arranjo.html?id=nome-curto`); `cor` são dois matizes (0–360) do degradê do cartão.
3. Gere os arquivos do site:
   ```sh
   python3 tools/publicar.py nome-curto
   ```
   O script só refaz o áudio quando o `.mscz` mudou (use `--forcar` para refazer sempre).
4. Confira localmente (`python3 -m http.server` na pasta e abra http://localhost:8000) e publique:
   ```sh
   git add -A && git commit -m "Publica Nome" && git push
   ```

Para tirar um arranjo do site, apague a linha de `tools/arranjos.json` e a pasta `arranjos/<id>/` e rode `python3 tools/publicar.py` de novo para refazer o índice.

## Como funciona

- `tools/publicar.py` usa o MuseScore pela linha de comando:
  - exporta a grade em MusicXML e as posições dos compassos (`.mpos`, já com ritornelos e casas);
  - gera uma partitura por parte, copia a configuração de som do original e exporta o áudio de cada parte com Muse Sounds;
  - grava um MP3 por parte (`audio/<parte>.mp3`) e um "banda sem a parte" (`audio/sem-<parte>.mp3`), todos com o mesmo ganho para manter o equilíbrio original;
  - separa as partes do MusicXML e escreve `meta.json` (partes, letras de ensaio, linha do tempo dos compassos tocados) e `arranjos/index.json`.
- No navegador (`assets/app.js`):
  - a partitura é desenhada com [Verovio](https://www.verovio.org);
  - o áudio é mixado com Web Audio (um volume por parte);
  - a velocidade muda sem alterar a afinação com [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (MPL-2.0, em `assets/vendor/`);
  - o metrônomo e a contagem são sintetizados a partir da linha do tempo dos compassos.
- A parte escolhida pelo músico fica salva no navegador (`localStorage`, chave `stabat.myPart`).

Requisitos para publicar: MuseScore Studio 4 (AppImage em `~/.local/opt/musescore/`), Muse Sounds instalados, `ffmpeg`, Python 3 com `numpy`.
