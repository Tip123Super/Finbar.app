// Replica minimale dell'API "window.storage" usata dentro gli artifact di Claude,
// così App.jsx funziona qui SENZA MODIFICHE al codice.
//
// Il parametro "shared" viene ignorato (non ha un vero significato multiutente
// in un'app senza login) — qui i dati restano nel browser locale come backup,
// mentre la sincronizzazione VERA tra dispositivi passa da Supabase, che ora
// dovrebbe funzionare per davvero (fuori dalla sandbox di Claude).

const KEY = "finex-storage-data";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

window.storage = {
  async get(key) {
    const data = readAll();
    if (!(key in data)) throw new Error(`Storage key not found: ${key}`);
    return { key, value: data[key], shared: false };
  },
  async set(key, value) {
    const data = readAll();
    data[key] = value;
    writeAll(data);
    return { key, value, shared: false };
  },
  async delete(key) {
    const data = readAll();
    if (!(key in data)) return null;
    delete data[key];
    writeAll(data);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    const data = readAll();
    const keys = Object.keys(data).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
