/* ═══════════════════════════════════════════════════════════════
   ILM QUEST · ARABIC ENCOURAGEMENT
   Text-only praise on correct answers. No audio files needed —
   pairs with the synthesised oud/ney chime in sound.js.
   ═══════════════════════════════════════════════════════════════ */

export const ENCOURAGEMENTS = [
  { ar: "ما شاء الله",        en: "Masha'Allah",        meaning: "As God has willed" },
  { ar: "ممتاز",              en: "Mumtaz",             meaning: "Excellent" },
  { ar: "أحسنت",              en: "Ahsant",             meaning: "Well done" },
  { ar: "جزاك الله خيراً",    en: "Jazak Allah khair",  meaning: "May God reward you" },
  { ar: "مبارك عليك",         en: "Mubarak alaika",     meaning: "Congratulations" },
  { ar: "بارك الله فيك",      en: "Baraka'Allah feek",  meaning: "May God bless you" },
  { ar: "رائع جداً",          en: "Raa'i jaddan",       meaning: "Absolutely amazing" },
  { ar: "أحسنت القراءة",      en: "Ahsanta al-qiraa'a", meaning: "You read well" },
  { ar: "نور ينير طريقك",    en: "Nur yuniir tareeqak", meaning: "Light illuminates your path" },
  { ar: "يا عالم",            en: "Ya aalim",           meaning: "Oh scholar" },
  { ar: "ألف مبروك",          en: "Alf mabruk",         meaning: "A thousand congratulations" },
];

// Streak-tier pool — heavier praise reserved for streaks of 3+
const STREAK_POOL = [
  { ar: "سبحان الله",         en: "SubhanAllah",        meaning: "Glory to God" },
  { ar: "الله أكبر",          en: "Allahu akbar",       meaning: "God is greatest" },
  { ar: "تبارك الله",         en: "Tabarak Allah",      meaning: "Blessed is God" },
];

export function pickEncouragement({ streak = 0 } = {}) {
  const pool = streak >= 3 ? STREAK_POOL : ENCOURAGEMENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

let _overlayEl = null;
function getOverlay() {
  if (_overlayEl && document.body.contains(_overlayEl)) return _overlayEl;
  const el = document.createElement("div");
  el.className = "iq-encouragement";
  el.setAttribute("dir", "rtl");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <div class="iq-encouragement__ar"></div>
    <div class="iq-encouragement__en" dir="ltr"></div>
  `;
  document.body.appendChild(el);
  _overlayEl = el;
  return el;
}

export function showEncouragement(opts = {}) {
  const { streak = 0, duration = 1600 } = opts;
  const phrase = pickEncouragement({ streak });
  const el = getOverlay();
  el.querySelector(".iq-encouragement__ar").textContent = phrase.ar;
  el.querySelector(".iq-encouragement__en").textContent = phrase.en;
  el.classList.remove("is-show");
  void el.offsetWidth;
  el.classList.add("is-show");
  clearTimeout(showEncouragement._t);
  showEncouragement._t = setTimeout(() => el.classList.remove("is-show"), duration);
  return phrase;
}
