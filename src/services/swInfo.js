function parseSwVersionFromSource(source) {
  const text = String(source || "");
  const match =
    text.match(/const\s+SW_VERSION\s*=\s*"([^"]+)"/) ||
    text.match(/const\s+CACHE\s*=\s*"([^"]+)"/);
  return match?.[1] ? String(match[1]) : "";
}

async function requestWorkerMeta(worker, timeoutMs = 1200) {
  if (!worker || typeof worker.postMessage !== "function") return null;

  return await new Promise((resolve) => {
    const channel = new window.MessageChannel();
    let done = false;

    const finish = (value) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        channel.port1.close();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    channel.port1.onmessage = (event) => {
      finish(event?.data && typeof event.data === "object" ? event.data : null);
    };

    try {
      worker.postMessage({ type: "GET_META" }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

async function fetchLatestMeta() {
  try {
    const res = await fetch(`./sw.js?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return { ok: false, version: "", error: `HTTP ${res.status}` };
    const source = await res.text();
    const version = parseSwVersionFromSource(source);
    return { ok: true, version, error: "" };
  } catch (e) {
    return { ok: false, version: "", error: String(e?.message || e || "fetch failed") };
  }
}

export async function readServiceWorkerVersions() {
  const isDevHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!("serviceWorker" in navigator)) {
    return {
      supported: false,
      isDevHost,
      registered: false,
      activeVersion: "",
      latestVersion: "",
      hasUpdate: false,
      mismatch: false,
      warning: "",
    };
  }

  const latest = await fetchLatestMeta();

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration("./sw.js")) ||
      (await navigator.serviceWorker.getRegistration());

    if (!reg) {
      return {
        supported: true,
        isDevHost,
        registered: false,
        activeVersion: "",
        latestVersion: latest.version,
        hasUpdate: false,
        mismatch: false,
        warning: "",
      };
    }

    const activeMeta =
      (await requestWorkerMeta(reg.active)) ||
      (await requestWorkerMeta(navigator.serviceWorker.controller));

    const waitingMeta = await requestWorkerMeta(reg.waiting);
    const activeVersion = String(activeMeta?.version || "");
    const latestVersion = String(waitingMeta?.version || latest.version || "");
    const hasUpdate = !!reg.waiting || (!!activeVersion && !!latestVersion && activeVersion !== latestVersion);
    const mismatch = !!activeVersion && !!latestVersion && activeVersion !== latestVersion;

    let warning = "";
    if (reg.waiting) warning = "Neuer Service Worker ist bereits installiert und wartet auf Aktivierung.";
    else if (mismatch) warning = "Aktiver Service Worker weicht von der neuesten sw.js ab.";
    else if (!activeVersion && latestVersion) warning = "Aktive SW-Version nicht lesbar, neueste Datei aber vorhanden.";
    else if (!latest.ok && latest.error) warning = `Neueste sw.js nicht lesbar: ${latest.error}`;

    return {
      supported: true,
      isDevHost,
      registered: true,
      activeVersion,
      latestVersion,
      hasUpdate,
      mismatch,
      warning,
    };
  } catch (e) {
    return {
      supported: true,
      isDevHost,
      registered: false,
      activeVersion: "",
      latestVersion: latest.version,
      hasUpdate: false,
      mismatch: false,
      warning: String(e?.message || e || "SW status failed"),
    };
  }
}
