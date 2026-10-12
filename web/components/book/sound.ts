/**
 * The diary's sounds, synthesized with Web Audio so there is no file to ship.
 *
 * A page turn is a short burst of band-passed noise (paper rustle) with a soft
 * low thump where the leaf lands; the clasp is two small metallic ticks. The
 * AudioContext is created on the first call, which always comes from a click,
 * because browsers refuse to start audio before the visitor has interacted.
 * The mute choice lives in localStorage and every access is guarded, since
 * storage can be blocked or empty in private windows.
 */

const KEY = "diary-sound";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(KEY, muted ? "off" : "on");
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

function audio(): AudioContext | null {
  if (isMuted()) return null;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const length = Math.floor(c.sampleRate * 0.6);
  noise = c.createBuffer(1, length, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** A leaf turning: rustle in, then a soft landing. */
export function playPage(): void {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(1400, now);
  band.frequency.exponentialRampToValueAtTime(3600, now + 0.32);
  band.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
  src.connect(band).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + 0.55);

  const thump = c.createOscillator();
  const thumpGain = c.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(110, now + 0.36);
  thump.frequency.exponentialRampToValueAtTime(60, now + 0.5);
  thumpGain.gain.setValueAtTime(0.0001, now + 0.36);
  thumpGain.gain.exponentialRampToValueAtTime(0.06, now + 0.39);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  thump.connect(thumpGain).connect(c.destination);
  thump.start(now + 0.36);
  thump.stop(now + 0.6);
}

/** The brass clasp letting go. */
export function playClasp(): void {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  [0, 0.09].forEach((offset, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(i ? 1500 : 2100, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.05, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.09);
    osc.connect(gain).connect(c.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.12);
  });
}
