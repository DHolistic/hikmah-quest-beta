/* ═══════════════════════════════════════════════════════════════
   HQUEST · TEAM TURN-SWITCH OVERLAY
   Brief full-bleed banner on each A↔B turn flip. Pairs with the
   playTurnSwitch() chime so players know to pass the device.
   ═══════════════════════════════════════════════════════════════ */

let _bannerEl = null;
let _hideTimer = null;

function getBanner() {
  if (_bannerEl && document.body.contains(_bannerEl)) return _bannerEl;
  const el = document.createElement("div");
  el.className = "iq-turn-banner";
  el.setAttribute("aria-live", "assertive");
  el.innerHTML = `
    <div class="iq-turn-banner__inner">
      <div class="iq-turn-banner__sub">Pass the device</div>
      <div class="iq-turn-banner__title"><span class="iq-turn-banner__team"></span><span class="iq-turn-banner__suffix">'s turn</span></div>
      <div class="iq-turn-banner__ar" dir="rtl" lang="ar">دور الفريق</div>
    </div>
  `;
  document.body.appendChild(el);
  _bannerEl = el;
  return el;
}

export function showTurnSwitch(team, opts = {}) {
  const { duration = 1300 } = opts;
  const el = getBanner();
  const teamLetter = team === "B" ? "B" : "A";
  el.querySelector(".iq-turn-banner__team").textContent = `Team ${teamLetter}`;
  el.dataset.team = teamLetter;
  el.classList.remove("is-show");
  void el.offsetWidth;
  el.classList.add("is-show");
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => el.classList.remove("is-show"), duration);
}
