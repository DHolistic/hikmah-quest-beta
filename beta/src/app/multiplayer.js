/* ═══════════════════════════════════════════════════════════════
   ILM QUEST · MULTIPLAYER
   BroadcastChannel for same-device/same-browser tab sync.
   Room-code join for simple coordinated play.
   Graceful fallback: works fully offline / solo.
   ═══════════════════════════════════════════════════════════════ */

// ── Message types ────────────────────────────────────────────────────────
export const MSG = /** @type {const} */ ({
  HOST_ANNOUNCE:   "HOST_ANNOUNCE",   // host → all: "I am hosting room X"
  PLAYER_JOIN:     "PLAYER_JOIN",     // player → host: join request
  PLAYER_JOINED:   "PLAYER_JOINED",   // host → all: new player confirmed
  PLAYER_LEFT:     "PLAYER_LEFT",     // host → all: player left
  CARD_EVENT:      "CARD_EVENT",      // host → players: current card state
  SCORE_UPDATE:    "SCORE_UPDATE",    // host → all: latest scores
  TURN_CHANGE:     "TURN_CHANGE",     // host → all: whose turn
  ANSWER_CORRECT:  "ANSWER_CORRECT",  // event: correct answer
  ANSWER_MISS:     "ANSWER_MISS",     // event: missed answer
  GAME_COMPLETE:   "GAME_COMPLETE",   // host → all: game over + final scores
  PING:            "PING",            // keepalive
  PONG:            "PONG",
});

// ── Room code generator (4 consonant+vowel chars, readable) ──────────────
const CONSONANTS = "BDFGHJKLMNPRST";
const VOWELS     = "AEIOU";

export function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 2; i++) {
    code += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
    code += VOWELS[Math.floor(Math.random() * VOWELS.length)];
  }
  return code;  // e.g. "BELO", "TAMI"
}

// ── Anonymous avatar identity ─────────────────────────────────────────────
const ADJECTIVES = [
  "Sincere", "Steadfast", "Grateful", "Patient", "Mindful",
  "Humble", "Gentle", "Radiant", "Thoughtful", "Serene",
  "Curious", "Brave", "Kind", "Hopeful", "Bright",
];

const ANIMALS = [
  "Falcon", "Cedar", "Sage", "River", "Stone",
  "Light", "Moon", "Star", "Olive", "Reed",
  "Pearl", "Sand", "Dusk", "Dawn", "Wind",
];

export function generateAvatar() {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return {
    name:   `${adj} ${animal}`,
    initials: `${adj[0]}${animal[0]}`,
    // Deterministic hue from name string for consistent color
    color:  _nameToHue(`${adj}${animal}`),
  };
}

function _nameToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  // Warm golden-blue palette range (20°–220°)
  const hue = 20 + (hash % 200);
  return `hsl(${hue}, 60%, 62%)`;
}

// ── Multiplayer Room ─────────────────────────────────────────────────────
export class MultiplayerRoom {
  /**
   * @param {"host"|"player"} role
   * @param {string} roomCode
   * @param {{ name: string, initials: string, color: string }} avatar
   */
  constructor(role, roomCode, avatar) {
    this.role      = role;
    this.roomCode  = roomCode.toUpperCase();
    this.avatar    = avatar;
    this.playerId  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.players   = new Map();  // playerId → { avatar, joinedAt }
    this._channel  = null;
    this._listeners = [];
    this._pingTimer = null;
    this._hidden   = true;   // privacy-first: avatar hidden by default

    // Register self
    this.players.set(this.playerId, { avatar, joinedAt: Date.now() });
  }

  /** Open the BroadcastChannel. Call before any send/receive. */
  open() {
    const channelName = `ilm-quest-room-${this.roomCode}`;
    try {
      this._channel = new BroadcastChannel(channelName);
      this._channel.onmessage = (evt) => this._handleMessage(evt.data);
    } catch (err) {
      console.warn("[ILM Multiplayer] BroadcastChannel unavailable:", err);
      this._channel = null;
    }

    if (this.role === "host") {
      this._startPingTimer();
      this._broadcast({ type: MSG.HOST_ANNOUNCE, roomCode: this.roomCode, avatar: this.avatar, playerId: this.playerId });
    } else {
      // Send join request
      this._broadcast({ type: MSG.PLAYER_JOIN, avatar: this.avatar, playerId: this.playerId });
    }

    return this;
  }

  /** Toggle avatar visibility */
  setHidden(hidden) {
    this._hidden = hidden;
  }

  isHidden() { return this._hidden; }

  /** Register a message handler. Returns an unsubscribe function. */
  on(type, handler) {
    const entry = { type, handler };
    this._listeners.push(entry);
    return () => { this._listeners = this._listeners.filter(l => l !== entry); };
  }

  /** Emit a typed event to all listeners */
  _emit(msg) {
    this._listeners.forEach(l => {
      if (l.type === "*" || l.type === msg.type) l.handler(msg);
    });
  }

  /** Send a message over the channel (host only for most game events) */
  _broadcast(data) {
    if (!this._channel) return;
    try { this._channel.postMessage({ ...data, _from: this.playerId, _room: this.roomCode }); } catch {}
  }

  /** Handle incoming messages */
  _handleMessage(msg) {
    if (!msg || msg._room !== this.roomCode) return;
    if (msg._from === this.playerId) return;  // ignore own messages

    switch (msg.type) {
      case MSG.PLAYER_JOIN:
        if (this.role === "host") {
          this.players.set(msg.playerId, { avatar: msg.avatar, joinedAt: Date.now() });
          // Acknowledge to all
          this._broadcast({
            type: MSG.PLAYER_JOINED,
            playerId: msg.playerId,
            avatar:   msg.avatar,
            players:  this._serializePlayers(),
          });
        }
        break;

      case MSG.PLAYER_JOINED:
        // Track new player (already in players map if we're host)
        if (msg.playerId !== this.playerId && !this.players.has(msg.playerId)) {
          this.players.set(msg.playerId, { avatar: msg.avatar, joinedAt: Date.now() });
        }
        break;

      case MSG.HOST_ANNOUNCE:
        // Player receiving host's announcement — send our join
        if (this.role === "player") {
          this._broadcast({ type: MSG.PLAYER_JOIN, avatar: this.avatar, playerId: this.playerId });
        }
        break;

      case MSG.PING:
        this._broadcast({ type: MSG.PONG });
        break;
    }

    this._emit(msg);
  }

  _serializePlayers() {
    const out = {};
    this.players.forEach((v, k) => { out[k] = v; });
    return out;
  }

  _startPingTimer() {
    this._pingTimer = setInterval(() => {
      this._broadcast({ type: MSG.PING });
    }, 8000);
  }

  // ── Host-only game event broadcasts ───────────────────────────────────

  /** Broadcast current card to players */
  sendCardEvent(cardContext) {
    if (this.role !== "host") return;
    this._broadcast({ type: MSG.CARD_EVENT, card: cardContext });
  }

  /** Broadcast updated scores */
  sendScoreUpdate(scores) {
    if (this.role !== "host") return;
    this._broadcast({ type: MSG.SCORE_UPDATE, scores });
  }

  /** Broadcast turn change */
  sendTurnChange(turn) {
    if (this.role !== "host") return;
    this._broadcast({ type: MSG.TURN_CHANGE, turn });
  }

  /** Broadcast correct answer event */
  sendAnswerCorrect(pts) {
    this._broadcast({ type: MSG.ANSWER_CORRECT, pts, playerId: this.playerId });
  }

  /** Broadcast miss event */
  sendAnswerMiss() {
    this._broadcast({ type: MSG.ANSWER_MISS, playerId: this.playerId });
  }

  /** Broadcast game complete */
  sendGameComplete(finalScores) {
    if (this.role !== "host") return;
    this._broadcast({ type: MSG.GAME_COMPLETE, scores: finalScores });
  }

  /** Close channel and stop timers */
  close() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    if (this._channel)   { this._channel.close(); this._channel = null; }
    this._listeners = [];
  }
}

// ── Singleton room instance for the current session ────────────────────
let _activeRoom = null;

export function getActiveRoom()      { return _activeRoom; }
export function setActiveRoom(room)  { _activeRoom = room; }
export function closeActiveRoom()    { _activeRoom?.close(); _activeRoom = null; }
