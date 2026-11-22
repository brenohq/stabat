/**
 * Sons curtos dos jogos, sintetizados no Web Audio (nada para baixar). O AudioContext nasce no
 * primeiro som, que sempre vem de um toque, então o navegador deixa tocar.
 */
import { ignoreSilentSwitch, releaseSilentSwitch } from "./silentSwitch";

let ctx: AudioContext | null = null;

/** o AudioContext dos sons curtos (nasce no primeiro toque); o piano dos estudos usa o mesmo */
export function audio(): AudioContext | null {
  try {
    ignoreSilentSwitch(); // iPhone: tocar mesmo com a chave de silencioso (dentro do toque)
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** um tom com ataque rápido e queda longa, entre marimba e sino */
export function tone(
  freq: number,
  { when = 0, dur = 0.9, gain = 0.22, type = "triangle" as OscillatorType } = {},
): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(a.destination);
  const main = a.createOscillator();
  main.type = type;
  main.frequency.value = freq;
  main.connect(out);
  const octave = a.createOscillator();
  octave.frequency.value = freq * 2;
  const soft = a.createGain();
  soft.gain.value = 0.25;
  octave.connect(soft).connect(out);
  for (const o of [main, octave]) {
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** arpejo de metais (dó-mi-sol-dó) para sequências e nível novo */
export function fanfare(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, { when: i * 0.09, dur: 0.5, gain: 0.14, type: "sawtooth" }),
  );
}

/** toque grave e curto do erro: avisa sem assustar */
export function thud(): void {
  tone(150, { dur: 0.18, gain: 0.18, type: "sine" });
}

/** clique do metrônomo (o primeiro tempo do compasso mais agudo); `at` = hora do AudioContext
 *  (agendado com precisão; padrão: agora). Devolve o oscilador, para poder cancelar. */
export function click(accent = false, at?: number): OscillatorNode | null {
  const a = audio();
  if (!a) return null;
  const t = at ?? a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(accent ? 0.32 : 0.22, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  out.connect(a.destination);
  const o = a.createOscillator();
  o.type = "square";
  o.frequency.value = accent ? 1760 : 1320;
  o.connect(out);
  o.start(t);
  o.stop(t + 0.06);
  return o;
}

/** som do toque no "Bate o ritmo": bloco de madeira curto, mais grave que o metrônomo */
export function woodblock(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.3, t + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  out.connect(a.destination);
  for (const [type, f] of [
    ["sine", 880],
    ["triangle", 1760],
  ] as const) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }
}

/** ao sair do jogo: solta o <audio> mudo do iPhone antigo (some da tela de bloqueio) */
export function stopSfx(): void {
  releaseSilentSwitch();
}
