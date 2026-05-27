/* ═══════════════════════════════════════════════════════════════
   HQUEST · TEAM BETA 2 HUB CONTROLLER
   Anonymous avatars · Room management · Live lobby
   ═══════════════════════════════════════════════════════════════ */

import { generateRoomCode, generateAvatar, MultiplayerRoom, MSG, setActiveRoom, closeActiveRoom, getActiveRoom } from "./multiplayer.js";
import { saveSession, loadSession } from "./config.js";
import { createProximityService } from "./proximity.js";

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
const teamNameInput  = document.getElementById("tb-team-name");
const playerNameInput = document.getElementById("tb-player-name");
const roundSelect    = document.getElementById("tb-round-seconds");
const battleSelect   = document.getElementById("tb-battle-style");
const nearbyOptIn    = document.getElementById("tb-nearby-optin");
const qrImage        = document.getElementById("tb-qr-image");
const copyLinkBtn    = document.getElementById("tb-copy-link");
const nearbyEnableBtn = document.getElementById("tb-nearby-enable");
const nearbyDisableBtn = document.getElementById("tb-nearby-disable");
const nearbyBanner = document.getElementById("tb-nearby-banner");
const nearbyText = document.getElementById("tb-nearby-text");
const nearbyAccept = document.getElementById("tb-nearby-accept");
const nearbyDismiss = document.getElementById("tb-nearby-dismiss");
const achievementList = document.getElementById("tb-achievement-list");

const ACHIEVE_KEY = "hq-tournament-achievements-v1";
let _displayName = String(session.playerName ?? "").trim();

function initialsForName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "HQ";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function currentAvatar() {
  const name = _displayName || _avatar.name;
  return {
    ..._avatar,
    name,
    initials: _displayName ? initialsForName(_displayName) : _avatar.initials,
  };
}

function loadAchievements() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACHIEVE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function renderAchievements() {
  if (!achievementList) return;
  const rows = loadAchievements();
  if (!rows.length) {
    achievementList.innerHTML = `<p class="iq-lobby-waiting">No badges yet. Win rounds to unlock.</p>`;
    return;
  }
  achievementList.innerHTML = rows
    .slice(-6)
    .reverse()
    .map(row => `
      <div class="iq-achievement-item">
        <span class="iq-achievement-item__name">${row.name}</span>
        <span class="iq-achievement-item__meta">${row.when}</span>
      </div>
    `)
    .join("");
}

function showNearbyPrompt(count) {
  if (!nearbyBanner || !nearbyText) return;
  if (count <= 0) {
    nearbyBanner.style.display = "none";
    return;
  }
  nearbyText.textContent = count === 1
    ? "1 nearby user detected. Start a challenge?"
    : `${count} nearby users detected. Start a challenge?`;
  nearbyBanner.style.display = "";
}

const proximity = createProximityService({
  onStatus: (msg, type = "") => setStatus(msg, type),
  onNearby: count => showNearbyPrompt(count),
});

function buildInviteUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("join", code);
  return url.toString();
}

function renderQrInvite(code) {
  if (!qrImage) return;
  const invite = buildInviteUrl(code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(invite)}`;
  qrImage.src = qrUrl;
  qrImage.dataset.invite = invite;
}

function canStartTournament() {
  if (!_room || _room.role !== "host") return false;
  return _room.players.size >= 3;
}

function syncStartAvailability() {
  if (!startGameBtn) return;
  const ready = canStartTournament();
  startGameBtn.disabled = !ready;
  if (_room?.role === "host") {
    if (ready) {
      setStatus(`Tournament ready: ${_room.players.size} players connected.`, "success");
    } else {
      setStatus(`Need ${Math.max(0, 3 - (_room?.players.size ?? 0))} more player(s) for tournament mode.`);
    }
  }
}

// ── Avatar display ───────────────────────────────────────────────────────
function renderSelf() {
  if (!selfBadge) return;
  const avatar = currentAvatar();
  selfBadge.textContent  = _hidden ? "?" : avatar.initials;
  selfBadge.style.background = _hidden
    ? "rgba(240,232,213,.06)"
    : `radial-gradient(circle at 35% 35%, ${avatar.color}, rgba(7,17,26,.9))`;
  selfBadge.style.color = _hidden ? "rgba(240,232,213,.3)" : avatar.color;
  selfBadge.classList.toggle("is-hidden", _hidden);
  if (selfName) selfName.textContent = _hidden ? "Hidden" : avatar.name;
  if (privacyBtn) privacyBtn.textContent = _hidden ? "Show identity" : "Hide identity";
  if (playerNameInput) playerNameInput.value = _displayName;
}

if (privacyBtn) {
  privacyBtn.addEventListener("click", () => {
    _hidden = !_hidden;
    if (_room) _room.setHidden(_hidden);
    renderSelf();
  });
}

if (playerNameInput) {
  playerNameInput.value = _displayName;
  playerNameInput.addEventListener("input", () => {
    _displayName = playerNameInput.value.trim();
    saveSession({ ...loadSession(), playerName: _displayName });
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
    _room = new MultiplayerRoom("host", code, currentAvatar());
    _room.open();
    setActiveRoom(_room);

    if (roomCodeEl) roomCodeEl.textContent = code;
    renderQrInvite(code);
    if (hostSection) hostSection.style.display = "";
    if (hostLobby)   hostLobby.style.display   = "";
    hostCreateBtn.style.display = "none";
    if (hostStopBtn) hostStopBtn.style.display  = "";
    if (startGameBtn) startGameBtn.disabled = true;

    // Initialise own score entry
    _scores[_room.playerId] = { name: _hidden ? "Host" : currentAvatar().name, pts: 0 };
    renderPlayerGrid();
    renderScores();
    setStatus(`Room ${code} open — share QR or code.`, "success");
    syncStartAvailability();

    if (proximity.isEnabled()) {
      proximity.disable().then(() =>
        proximity.enable({ roomCode: code, advertise: true })
      );
    }

    // Listen for join events
    _room.on(MSG.PLAYER_JOINED, (msg) => {
      _scores[msg.playerId] = { name: msg.avatar.name, pts: 0 };
      renderPlayerGrid();
      renderScores();
      syncStartAvailability();
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
    if (qrImage) {
      qrImage.removeAttribute("src");
      delete qrImage.dataset.invite;
    }
  });
}

// ── Join flow ─────────────────────────────────────────────────────────────
if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    const code = joinCodeInput?.value.trim().toUpperCase();
    if (!code || code.length < 2) { setStatus("Enter a room code.", "error"); return; }

    closeActiveRoom();
    _room = new MultiplayerRoom("player", code, currentAvatar());
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

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    const invite = qrImage?.dataset.invite;
    if (!invite) {
      setStatus("Create a room first to generate an invite link.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(invite);
      setStatus("Invite link copied.", "success");
    } catch {
      setStatus("Could not copy link. Share the room code manually.");
    }
  });
}

if (nearbyEnableBtn) {
  nearbyEnableBtn.addEventListener("click", async () => {
    if (!nearbyOptIn?.checked) {
      setStatus("Enable nearby opt-in first.", "error");
      return;
    }
    const ok = await proximity.enable({
      roomCode: _room?.roomCode ?? "",
      advertise: Boolean(_room?.role === "host"),
    });
    if (!ok) return;
    nearbyEnableBtn.style.display = "none";
    if (nearbyDisableBtn) nearbyDisableBtn.style.display = "";
  });
}

if (nearbyDisableBtn) {
  nearbyDisableBtn.addEventListener("click", () => {
    proximity.disable();
    nearbyDisableBtn.style.display = "none";
    if (nearbyEnableBtn) nearbyEnableBtn.style.display = "";
    if (nearbyBanner) nearbyBanner.style.display = "none";
  });
}

if (nearbyDismiss) {
  nearbyDismiss.addEventListener("click", () => {
    if (nearbyBanner) nearbyBanner.style.display = "none";
  });
}

if (nearbyAccept) {
  nearbyAccept.addEventListener("click", () => {
    if (_room && canStartTournament()) {
      startGameBtn?.click();
      return;
    }
    if (!_room) {
      hostCreateBtn?.click();
    } else {
      setStatus("Need at least 3 connected players to start tournament mode.");
    }
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
    if (!canStartTournament()) {
      syncStartAvailability();
      return;
    }

    const roundSeconds = Number(roundSelect?.value || 60);
    const teamName = (teamNameInput?.value || "").trim();
    const battleStyle = battleSelect?.value || "same-deck";

    saveSession({
      ...session,
      mode: "team",
      multiplayerRoom: _room?.roomCode ?? null,
      roundSeconds,
      teamName,
      battleStyle,
      nearbyOptIn: Boolean(nearbyOptIn?.checked),
      tournamentMode: true,
      playerName: _displayName,
    });
    location.href = "gameplay.html";
  });
}

function autoJoinFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const join = (params.get("join") || "").trim().toUpperCase();
  if (!join) return;
  if (joinCodeInput) joinCodeInput.value = join;
  if (joinBtn) joinBtn.click();
}

// ── Init ─────────────────────────────────────────────────────────────────
renderSelf();
renderAchievements();
if (hostSection) hostSection.style.display = "none";
if (hostLobby)   hostLobby.style.display   = "none";
if (hostStopBtn) hostStopBtn.style.display = "none";
if (leaveBtn)    leaveBtn.style.display    = "none";
if (startGameBtn) startGameBtn.disabled    = true;
if (nearbyOptIn) nearbyOptIn.checked = false;
autoJoinFromQuery();

window.addEventListener("beforeunload", () => {
  proximity.disable();
});
