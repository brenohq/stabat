/**
 * No iPhone, o Web Audio respeita a chave de silencioso (categoria "ambient").
 * Para tocar mesmo com a chave ligada, pedimos a categoria "playback":
 * - iOS 17+ (Safari 16.4+): `navigator.audioSession.type = "playback"`;
 * - antes disso: um <audio> mudo em loop enquanto toca muda a sessão para
 *   "playback" (o truque usado por bibliotecas como unmute-ios-audio).
 * Tem de ser chamado dentro do gesto do usuário (o clique no play).
 */

interface AudioSession {
  type: string;
}

/** WAV de 0,1 s de silêncio (8 kHz, 8 bits, mono) */
function silentWav(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const s = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  s(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  s(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  s(36, "data");
  v.setUint32(40, n, true);
  b.fill(128, 44); // 8 bits sem sinal: 128 = silêncio
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

let el: HTMLAudioElement | null = null;

function session(): AudioSession | undefined {
  return (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Chame no play (dentro do gesto). */
export function ignoreSilentSwitch(): void {
  if (typeof navigator === "undefined") return;
  const s = session();
  if (s) {
    try {
      // o Afinador pede "play-and-record" (microfone): não derrubar
      if (s.type !== "playback" && s.type !== "play-and-record") s.type = "playback";
    } catch {
      /* navegador recusou: segue sem */
    }
    return;
  }
  if (!isIOS()) return;
  el ??= Object.assign(document.createElement("audio"), {
    src: silentWav(),
    loop: true,
    preload: "auto",
  });
  el.setAttribute("playsinline", "");
  el.setAttribute("x-webkit-airplay", "deny");
  void el.play().catch(() => {});
}

/** Chame no pause: solta o <audio> mudo (some dos controles da tela de bloqueio). */
export function releaseSilentSwitch(): void {
  el?.pause();
}
