const PROX_STORE_KEY = "hq-proximity-presence-v1";
const HQ_SERVICE_UUID = "9d8f9b54-49eb-4a9d-97df-5d8653d25f31";

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

function isNativeCapacitor() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function getNativeBlePlugin() {
  return window.Capacitor?.Plugins?.BluetoothLowEnergy ?? null;
}

function geoBucket(lat, lon) {
  const latBucket = Math.round(lat * 200) / 200;
  const lonBucket = Math.round(lon * 200) / 200;
  return `${latBucket.toFixed(3)}:${lonBucket.toFixed(3)}`;
}

function readPresence() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROX_STORE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePresence(entries) {
  try {
    localStorage.setItem(PROX_STORE_KEY, JSON.stringify(entries));
  } catch {}
}

function upsertPresence(entry) {
  const now = Date.now();
  const staleCutoff = now - 30000;
  const current = readPresence().filter(item => item?.seenAt >= staleCutoff);
  const kept = current.filter(item => item.id !== entry.id);
  kept.push({ ...entry, seenAt: now });
  writePresence(kept);
}

function nearbyCountForBucket(id, bucket) {
  const now = Date.now();
  const staleCutoff = now - 30000;
  const current = readPresence().filter(item => item?.seenAt >= staleCutoff);
  writePresence(current);
  return current.filter(item => item.id !== id && item.bucket === bucket).length;
}

export function createProximityService({ onStatus, onNearby } = {}) {
  const selfId = randomToken();
  let enabled = false;
  let bucket = "";
  let loopId = null;
  let scanListener = null;
  let detectedNativePeers = new Map();

  function status(msg, type = "") {
    onStatus?.(msg, type);
  }

  function emitNativeNearbyCount() {
    const now = Date.now();
    for (const [id, ts] of detectedNativePeers.entries()) {
      if (now - ts > 14000) detectedNativePeers.delete(id);
    }
    onNearby?.(detectedNativePeers.size);
  }

  async function ensureNativePermissions(ble) {
    try {
      const current = await ble.checkPermissions();
      if (current?.bluetooth === "granted" && current?.location !== "denied") {
        return true;
      }
      const requested = await ble.requestPermissions();
      return requested?.bluetooth === "granted";
    } catch {
      return false;
    }
  }

  async function startNativeNearby({ roomCode = "", advertise = false } = {}) {
    const ble = getNativeBlePlugin();
    if (!ble) {
      status("Native BLE plugin unavailable. Falling back to local nearby mode.");
      return false;
    }

    const hasPerm = await ensureNativePermissions(ble);
    if (!hasPerm) {
      status("Bluetooth permission not granted.", "error");
      return false;
    }

    try {
      await ble.initialize({ mode: "central" });
    } catch {}

    if (advertise) {
      try {
        await ble.initialize({ mode: "peripheral" });
        await ble.startAdvertising({
          name: roomCode ? `HQ-${roomCode}` : "HQ-Tournament",
          services: [HQ_SERVICE_UUID],
          includeName: true,
          includeTxPowerLevel: false,
        });
        status("BLE advertising active for nearby tournament discovery.", "success");
      } catch {
        status("BLE advertising unavailable on this device build. Scanning still enabled.");
      }

      // Return to central mode so this device can also detect peers.
      try { await ble.initialize({ mode: "central" }); } catch {}
    }

    try {
      scanListener = await ble.addListener("deviceScanned", event => {
        const device = event?.device;
        const services = device?.serviceUuids ?? [];
        const matchesService = services.some(s => String(s).toLowerCase() === HQ_SERVICE_UUID);
        const matchesName = String(device?.name ?? "").startsWith("HQ-");
        if (!matchesService && !matchesName) return;
        const key = device?.deviceId ?? device?.id ?? randomToken();
        detectedNativePeers.set(key, Date.now());
        emitNativeNearbyCount();
      });
      await ble.startScan({
        services: [HQ_SERVICE_UUID],
        timeout: 0,
        allowDuplicates: false,
      });
      status("Native BLE scan running for nearby challenge detection.", "success");
    } catch {
      status("BLE scan could not start. Check device Bluetooth and permissions.", "error");
      return false;
    }

    return true;
  }

  async function stopNativeNearby() {
    const ble = getNativeBlePlugin();
    if (!ble) return;
    try { await ble.stopScan(); } catch {}
    try { await ble.stopAdvertising(); } catch {}
    try { await scanListener?.remove?.(); } catch {}
    scanListener = null;
    detectedNativePeers = new Map();
    onNearby?.(0);
  }

  async function requestGeoBucket() {
    if (!navigator.geolocation) {
      status("Geolocation unavailable on this device.", "error");
      return "";
    }
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve(geoBucket(pos.coords.latitude, pos.coords.longitude)),
        () => {
          status("Location permission denied. Nearby prompts unavailable.", "error");
          resolve("");
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 15000 }
      );
    });
  }

  async function tryWebBluetoothPrompt() {
    if (!navigator.bluetooth?.requestDevice) return;
    try {
      await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [] });
      status("Bluetooth permission granted for nearby prompts.", "success");
    } catch {
      // Keep silent unless user explicitly tries to use Bluetooth prompt.
    }
  }

  async function enable({ roomCode = "", advertise = false } = {}) {
    if (enabled) return true;
    enabled = true;

    if (isNativeCapacitor()) {
      const okNative = await startNativeNearby({ roomCode, advertise });
      if (okNative) return true;
    }

    const nextBucket = await requestGeoBucket();
    if (!nextBucket) {
      enabled = false;
      return false;
    }

    bucket = nextBucket;
    status("Nearby challenge detection enabled.", "success");

    await tryWebBluetoothPrompt();

    loopId = setInterval(() => {
      if (!enabled || !bucket) return;
      upsertPresence({ id: selfId, bucket });
      const count = nearbyCountForBucket(selfId, bucket);
      onNearby?.(count);
    }, 2500);

    return true;
  }

  async function disable() {
    enabled = false;
    if (loopId) {
      clearInterval(loopId);
      loopId = null;
    }
    await stopNativeNearby();
    status("Nearby challenge detection disabled.");
  }

  return {
    enable,
    disable,
    isEnabled: () => enabled,
  };
}