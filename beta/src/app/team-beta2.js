/* ═══════════════════════════════════════════════════════════════
   ILM QUEST · TEAM BETA 2 HUB CONTROLLER
   Anonymous avatars · Room management · Live lobby
   ═══════════════════════════════════════════════════════════════ */

import { generateRoomCode, generateAvatar, MultiplayerRoom, MSG, setActiveRoom, closeActiveRoom, getActiveRoom } from "./multiplayer.js";
import { saveSession, loadSession } from "./config.js";

// ── State ────────────────────────────────────────────────────────────────
const session = loadSession() ?? {};
let _avatar   = generateAvatar();
let _room     = null;
let _hidden   = true;  // privacy-first default
let _scores   = {};    // playerId → { name, pts }

// ── DOM refs ─────────────────────────────────────────────────────────────
const selfBadge      = document.getElementById("tб-self-badge");
const selfName       = document.getElementById("tб-self-name");
const privacyBtn     = document.getElementById("tб-privacy-btn");

const hostCreateBtn  = document.getElementById("tб-host-create");
const hostStopBtn    = document.getElementById("tб-host-stop");
const roomCodeEl     = document.getElementById("tб-room-code");
const hostSection    = document.getElementById("tб-host-section");
const hostLobby      = document.getElementById("tб-host-lobby");

const joinCodeInput  = document.getElementById("tб-join-code");
const joinBtn        = document.getElementById("tб-join-btn");
const leaveBtn       = document.getElementById("tб-leave-btn");
const joinSection    = document.getElementById("tб-join-section");

const playerGrid     = document.getElementById("tб-player-grid");
const statusEl       = document.getElementById("tб-status");
const startGameBtn   = document.getElementById("tб-start-game");
const confScores     = document.getElementById("tб-conf-scores");

// ── Avatar display ───────────────────────────────────────────────────────
function renderSelf() {
  if (!selfBadge) return;
  selfBadge.textContent  = _hidden ? "?" : _avatar.initials;
  selfBadge.style.background = _hidden
    ? "rgba(240,232,213,.06)"
    : `radial-gradient(circle at 35% 35%, ${_avatar.color}, rgba(7,17,26,.9))`;
  selfBadge.style.color = _hidden ? "rgba(240,232,213,.3)" : _avatar.color;
  selfBadge.classList.toggle("is-hidden", _hidden);
  if (selfName) selfName.textContent = _hidden ? "Hidden" : _avatar.name;
  if (privacyBtn) privacyBtn.textContent = _hidden ? "👁 Show identity" : "🙈 Hide identity";
}

if (privacyBtn) {
  privacyBtn.addEventListener("click", () => {
    _hidden = !_hidden;
    if (_room) _room.setHidden(_hidden);
    renderSelf();
  });
}

// ── Player grid ──────────────────────────────────────────────────────────
function renderPlayerGrid() {
  if (!playerGrid || !_room) return;

  const cards = [];
  _room.players.forEach((p, id) => {
    const isSelf = id === _room.playerId;
    const hidden = isSelf ? _hidden : false;
    const av     = p.avatar;
    cards.push(`
      <div class="iq-player-card${isSelf ? " iq-player-card--self" : ""}">
        <div class="iq-player-card__badge" style="background:radial-gradient(circle at 35% 35%, ${av.color}, rgba(7,17,26,.9)); color:${av.color};">
          ${hidden ? "?" : av.initials}
        </div>
        <span class="iq-player-card__name">${hidden ? "Hidden" : av.name}${isSelf ? " (you)" : ""}</span>
      </div>
    `);
  });

  if (cards.length === 0) {
    playerGrid.innerHTML = `<p class="iq-lobby-waiting"><span class="iq-waiting-dot"></span>Waiting for players to join…</p>`;
  } else {
    playerGrid.innerHTML = cards.join("");
  }
}

// ── Status helper ────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = "iq-team-status" + (type ? ` is-${type}` : "");
}

// ── Conference scores ────────────────────────────────────────────────────
function renderScores() {
  if (!confScores) return;
  const entries = Object.entries(_scores);
  if (entries.length === 0) { confScores.innerHTML = ""; return; }

  entries.sort((a, b) => (b[1].pts ?? 0) - (a[1].pts ?? 0));
  confScores.innerHTML = entries.map(([id, s]) => `
    <div class="iq-conf-score-row">
      <span class="iq-conf-score-row__name">${s.name}</span>
      <span class="iq-conf-score-row__pts">${s.pts ?? 0}</span>
    </div>
  `).join("");
}

// ── Host flow ────────────────────────────────────────────────────────────
if (hostCreateBtn) {
  hostCreateBtn.addEventListener("click", () => {
    closeActiveRoom();
    const code = generateRoomCode();
    _room = new MultiplayerRoom("host", code, _avatar);
    _room.open();
    setActiveRoom(_room);

    if (roomCodeEl) roomCodeEl.textContent = code;
    if (hostSection) hostSection.style.display = "";
    if (hostLobby)   hostLobby.style.display   = "";
    hostCreateBtn.style.display = "none";
    if (hostStopBtn) hostStopBtn.style.display  = "";
    if (startGameBtn) startGameBtn.disabled = false;

    // Initialise own score entry
    _scores[_room.playerId] = { name: _hidden ? "Host" : _avatar.name, pts: 0 };
    renderPlayerGrid();
    renderScores();
    setStatus(`Room ${code} open — share this code!`, "success");

    // Listen for join events
    _room.on(MSG.PLAYER_JOINED, (msg) => {
      _scores[msg.playerId] = { name: msg.avatar.name, pts: 0 };
      renderPlayerGrid();
      renderScores();
      setStatus(`${msg.avatar.name} joined!`);
    });

    _room.on(MSG.ANSWER_CORRECT, (msg) => {
      if (_scores[msg._from]) {
        _scores[msg._from].pts = (_scores[msg._from].pts ?? 0) + (msg.pts ?? 1);
        renderScores();
      }
    });

    _room.on(MSG.SCORE_UPDATE, (msg) => {
      if (msg.scores) {
        Object.assign(_scores, msg.scores);
        renderScores();
      }
    });
  });
}

if (hostStopBtn) {
  hostStopBtn.addEventListener("click", () => {
    closeActiveRoom();
    _room = null;
    if (hostSection) hostSection.style.display = "none";
    if (hostLobby)   hostLobby.style.display   = "none";
    hostCreateBtn.style.display = "";
    hostStopBtn.style.display  = "none";
    if (startGameBtn) startGameBtn.disabled = true;
    setStatus("Room closed.");
    if (playerGrid) playerGrid.innerHTML = "";
    _scores = {};
    renderScores();
  });
}

// ── Join flow ─────────────────────────────────────────────────────────────
if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    const code = joinCodeInput?.value.trim().toUpperCase();
    if (!code || code.length < 2) { setStatus("Enter a room code.", "error"); return; }

    closeActiveRoom();
    _room = new MultiplayerRoom("player", code, _avatar);
    _room.open();
    setActiveRoom(_room);

    joinBtn.style.display  = "none";
    if (leaveBtn) leaveBtn.style.display = "";
    if (joinSection) joinSection.style.display = "";
    renderPlayerGrid();
    setStatus(`Joining room ${code}…`);

    // Listen for room events from host
    _room.on(MSG.PLAYER_JOINED, (msg) => {
      renderPlayerGrid();
      setStatus(`${msg.avatar.name} is also here.`);
    });

    _room.on(MSG.CARD_EVENT, (msg) => {
      // Show card info to player-only view (future: display card in a player tile)
      setStatus(`New card: ${msg.card?.nameOfAllah ?? "—"}`);
    });

    _room.on(MSG.SCORE_UPDATE, (msg) => {
      if (msg.scores) {
        Object.assign(_scores, msg.scores);
        renderScores();
      }
    });

    _room.on(MSG.TURN_CHANGE, (msg) => {
      setStatus(`Turn: Team ${msg.turn}`);
    });

    _room.on(MSG.GAME_COMPLETE, (msg) => {
      if (msg.scores) {
        Object.assign(_scores, msg.scores);
        renderScores();
      }
      setStatus("Game complete! Final scores above.", "success");
    });

    // Let host know we're here (already sent in open(), this is for re-confirm)
    setTimeout(() => {
      if (_room?.players.size > 1) {
        setStatus(`Connected to room ${code}`, "success");
      } else {
        setStatus(`Waiting for host of room ${code}…`);
      }
      renderPlayerGrid();
    }, 800);
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    closeActiveRoom();
    _room = null;
    joinBtn.style.display  = "";
    leaveBtn.style.display = "none";
    if (joinCodeInput) joinCodeInput.value = "";
    if (playerGrid) playerGrid.innerHTML = "";
    _scores = {};
    renderScores();
    setStatus("Left the room.");
  });
}

// ── Start game (host) ─────────────────────────────────────────────────────
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    saveSession({
      ...session,
      mode: "team",
      multiplayerRoom: _room?.roomCode ?? null,
    });
    location.href = "gameplay.html";
  });
}

// ── Init ─────────────────────────────────────────────────────────────────
renderSelf();
if (hostSection) hostSection.style.display = "none";
if (hostLobby)   hostLobby.style.display   = "none";
if (hostStopBtn) hostStopBtn.style.display = "none";
if (leaveBtn)    leaveBtn.style.display    = "none";
if (startGameBtn) startGameBtn.disabled    = true;
