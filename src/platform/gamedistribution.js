// GameDistribution HTML5 SDK (gamedistribution.com/developers/sdk/html5). Saves: localStorage.
// Set VITE_GD_GAME_ID at build time to the game hash from the GD control panel.
import { loadScript, safeLocal } from './util.js';
let hooks = {}, ready = false, rewardDone = false;
const gd = () => window.gdsdk;
export default {
  name: 'gamedistribution', hasAds: true, // GD serves the ads
  externalLinks: false, storage: safeLocal,
  async init(h) { hooks = h;
    window.GD_OPTIONS = { gameId: import.meta.env.VITE_GD_GAME_ID || 'REPLACE_WITH_GD_GAME_ID', onEvent(e) {
      if (e.name === 'SDK_GAME_PAUSE') hooks.pause?.();
      else if (e.name === 'SDK_GAME_START') hooks.resume?.();
      else if (e.name === 'SDK_REWARDED_WATCH_COMPLETE') rewardDone = true;
      else if (e.name === 'SDK_READY') ready = true; } };
    try { await loadScript('https://html5.api.gamedistribution.com/main.min.js'); ready = true; } catch (e) { console.warn('GD SDK unavailable', e); } },
  loadingDone() {}, gameplayStart() {}, gameplayStop() {}, happytime() {},
  adsOn: () => ready && !!gd(),
  async interstitial() { if (!gd()?.showAd) return; try { await gd().showAd(); } catch {} hooks.resume?.(); },
  onRunStart() { return this.interstitial(); },
  async rewarded() { if (!gd()?.showAd) return false; rewardDone = false; try { await gd().showAd('rewarded'); } catch {} hooks.resume?.(); return rewardDone; },
};
