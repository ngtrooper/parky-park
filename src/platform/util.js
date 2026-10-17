// Shared helpers for portal adapters.
export const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('SDK load failed: ' + src)); document.head.appendChild(s); });
// localStorage that never throws (incognito / blocked storage): falls back to memory
const mem = new Map();
export const safeLocal = {
  getItem(k) { try { return localStorage.getItem(k); } catch { return mem.has(k) ? mem.get(k) : null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch { mem.set(k, String(v)); } },
  removeItem(k) { try { localStorage.removeItem(k); } catch { mem.delete(k); } },
  clearPrefix(p) { try { Object.keys(localStorage).filter(k => k.startsWith(p)).forEach(k => localStorage.removeItem(k)); } catch {} [...mem.keys()].filter(k => k.startsWith(p)).forEach(k => mem.delete(k)); },
};
