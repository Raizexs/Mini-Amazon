const NS = "mini.";
export const store = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(NS + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(NS + key, JSON.stringify(value)); },
  merge(key, patch) { this.set(key, { ...(this.get(key, {})), ...patch }); }
};