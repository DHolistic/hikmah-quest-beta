/* ═══════════════════════════════════════════════════════════════
   HQUEST · SOUND ENGINE
   Web Audio API synthesis — no external files required.
   Organic tones: oud pluck, ney breath, frame drum, chime.
   ═══════════════════════════════════════════════════════════════ */

// Sound modes
export const SOUND_MODES = /** @type {const} */ ({
  FULL:    "full",
  MINIMAL: "minimal",
  SILENT:  "silent",
  HAPTIC:  "haptic",   // visual flash + device vibration only
});

const SOUND_KEY = "iq-sound-mode";

let _ctx = null;
let _mode = localStorage.getItem(SOUND_KEY) ?? SOUND_MODES.FULL;

export function getSoundMode()      { return _mode; }
export function setSoundMode(mode)  {
  _mode = mode;
  try { localStorage.setItem(SOUND_KEY, mode); } catch {}
}

// Lazy AudioContext — created on first user gesture
function ctx() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { _ctx = null; }
  }
  if (_ctx && _ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

// ── Utility: create a gain node that ramps to zero ───────────────────────
function makeDecay(ac, startGain, durationSec) {
  const g = ac.createGain();
  g.gain.setValueAtTime(startGain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationSec);
  return g;
}

// ── Oud-like pluck ────────────────────────────────────────────────────────
// Karplus-Strong approximation: buffer noise → lowpass → decay
function oudPluck(ac, freq = 329.6, vol = 0.35) {
  const bufLen   = Math.ceil(ac.sampleRate / freq);
  const buffer   = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data     = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop   = true;

  const lp = ac.createBiquadFilter();
  lp.type            = "lowpass";
  lp.frequency.value = freq * 2.5;

  const gain = makeDecay(ac, vol, 0.38);

  src.connect(lp);
  lp.connect(gain);
  gain.connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + 0.4);
}

// ── Ney breath (filtered white noise + sine shimmer) ──────────────────────
function neyBreath(ac, freq = 523.25, vol = 0.22) {
  const duration = 0.32;

  // Noise component
  const bufLen = Math.ceil(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type            = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value         = 4;

  const noiseGain = makeDecay(ac, vol * 0.6, duration);

  // Sine shimmer
  const osc  = ac.createOscillator();
  osc.type   = "sine";
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(freq * 0.96, ac.currentTime + duration);

  const sineGain = makeDecay(ac, vol * 0.5, duration);

  noiseSrc.connect(bp);
  bp.connect(noiseGain);
  noiseGain.connect(ac.destination);

  osc.connect(sineGain);
  sineGain.connect(ac.destination);

  noiseSrc.start();
  osc.start();
  noiseSrc.stop(ac.currentTime + duration);
  osc.stop(ac.currentTime + duration);
}

// ── Frame drum thump (low-mid percussive) ─────────────────────────────────
function frameDrum(ac, vol = 0.5) {
  const osc  = ac.createOscillator();
  osc.type   = "sine";
  osc.frequency.setValueAtTime(120, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, ac.currentTime + 0.18);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);

  // Add a click transient
  const click = ac.createOscillator();
  click.type  = "square";
  click.frequency.value = 800;
  const clickGain = ac.createGain();
  clickGain.gain.setValueAtTime(0.08, ac.currentTime);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.015);

  osc.connect(gain);
  gain.connect(ac.destination);
  click.connect(clickGain);
  clickGain.connect(ac.destination);

  osc.start();   click.start();
  osc.stop(ac.currentTime + 0.25);
  click.stop(ac.currentTime + 0.02);
}

// ── FM Bell chime ─────────────────────────────────────────────────────────
function fmChime(ac, freq = 880, vol = 0.3, duration = 0.55) {
  const carrier = ac.createOscillator();
  const modulator = ac.createOscillator();
  const modGain   = ac.createGain();
  const masterGain = ac.createGain();

  carrier.type    = "sine";
  modulator.type  = "sine";

  carrier.frequency.value   = freq;
  modulator.frequency.value = freq * 2.01;  // slight inharmonicity → bell-like

  modGain.gain.setValueAtTime(freq * 2.5, ac.currentTime);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.1, ac.currentTime + duration);

  masterGain.gain.setValueAtTime(vol, ac.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(masterGain);
  masterGain.connect(ac.destination);

  carrier.start();
  modulator.start();
  carrier.stop(ac.currentTime + duration);
  modulator.stop(ac.currentTime + duration);
}

// ── Haptic vibration ─────────────────────────────────────────────────────
function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/** Called on correct Q&A answer */
export function playCorrect() {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([30]); return; }
  const ac = ctx(); if (!ac) return;
  oudPluck(ac, 392.0, _mode === SOUND_MODES.MINIMAL ? 0.22 : 0.35);  // G4
}

/** Called on missed answer */
export function playMiss() {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([60, 30, 60]); return; }
  const ac = ctx(); if (!ac) return;
  neyBreath(ac, 261.6, _mode === SOUND_MODES.MINIMAL ? 0.12 : 0.2);  // C4 — lower, softer
}

/** Called on name-of-Allah bonus correct */
export function playBonus() {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([20, 10, 20]); return; }
  const ac = ctx(); if (!ac) return;
  fmChime(ac, 659.3, _mode === SOUND_MODES.MINIMAL ? 0.18 : 0.28, 0.45);  // E5
}

/** Called on consecutive correct streak (every 3) */
export function playStreak(streakCount) {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([20, 10, 30, 10, 20]); return; }
  const ac = ctx(); if (!ac) return;
  // Ascending chord — higher freq per streak tier
  const tiers   = [523.25, 659.3, 783.99, 880];  // C5 E5 G5 A5
  const tier    = Math.min(Math.floor((streakCount - 3) / 3), tiers.length - 1);
  const freq    = tiers[Math.max(0, tier)];
  const vol     = _mode === SOUND_MODES.MINIMAL ? 0.18 : 0.3;
  fmChime(ac, freq, vol, 0.6);
  setTimeout(() => fmChime(ac, freq * 1.5, vol * 0.5, 0.4), 120);
}

/** Called on Barakah card reveal */
export function playBarakah() {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([15, 15, 15]); return; }
  const ac = ctx(); if (!ac) return;
  const vol = _mode === SOUND_MODES.MINIMAL ? 0.16 : 0.26;
  // Gentle cascade: three ascending plucks
  oudPluck(ac, 329.6, vol);                              // E4
  setTimeout(() => oudPluck(ac, 392.0, vol * 0.85), 130); // G4
  setTimeout(() => fmChime(ac, 523.25, vol * 0.75, 0.5), 260); // C5 chime
}

/** Called on team turn switch */
export function playTurnSwitch() {
  if (_mode === SOUND_MODES.SILENT) return;
  if (_mode === SOUND_MODES.HAPTIC) { vibrate([10]); return; }
  const ac = ctx(); if (!ac) return;
  frameDrum(ac, _mode === SOUND_MODES.MINIMAL ? 0.28 : 0.42);
}

/** Prime AudioContext on first user gesture */
export function primeAudio() {
  ctx();  // creates + resumes
}
