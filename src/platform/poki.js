// Poki SDK v2 (sdk.poki.com/html5). Poki auto-syncs localStorage to the logged-in player's cloud save, so we keep localStorage.
import { loadScript, safeLocal } from './util.js';
let P = null, hooks = {};
export default {
  name: 'poki', hasAds: true, // Poki serves the ads
  externalLinks: false, storage: safeLocal,
  async init(h) { hooks = h; try { await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js'); P = window.PokiSDK; await P.init().catch(() => {}); } catch (e) { console.warn('Poki SDK unavailable', e); P = null; } },
  loadingDone() { P?.gameLoadingFinished(); },
  gameplayStart() { P?.gameplayStart(); },
  gameplayStop() { P?.gameplayStop(); },
  happytime() {},
  adsOn: () => !!P,
  async interstitial() { if (!P) return; hooks.pause?.(); try { await P.commercialBreak(() => hooks.pause?.()); } catch {} hooks.resume?.(); },
  onRunStart() { return this.interstitial(); }, // Poki decides whether an ad actually plays
  async rewarded() { if (!P) return false; hooks.pause?.(); let ok = false; try { ok = await P.rewardedBreak(() => hooks.pause?.()); } catch {} hooks.resume?.(); return !!ok; },
};
