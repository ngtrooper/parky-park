// GameDistribution HTML5 SDK (gamedistribution.com/developers/sdk/html5). Saves: localStorage.
// Set VITE_GD_GAME_ID at build time to the game hash from the GD control panel.
import { loadScript, safeLocal } from './util.js';
let hooks = {}, ready = false, rewardDone = false, adStarted = false, onAdEnd = null;
const gd = () => window.gdsdk;
export default {
  name: 'gamedistribution', hasAds: true, // GD serves the ads
  externalLinks: false, storage: safeLocal,
  async init(h) { hooks = h;
    window.GD_OPTIONS = { gameId: import.meta.env.VITE_GD_GAME_ID || 'f80b379dea094c32949287ccda7b3610', onEvent(e) {
      if (e.name === 'SDK_GAME_PAUSE') { adStarted = true; hooks.pause?.(); }
      else if (e.name === 'SDK_GAME_START') { hooks.resume?.(); if (adStarted) onAdEnd?.(); }
      else if (e.name === 'SDK_REWARDED_WATCH_COMPLETE') rewardDone = true;
      else if (e.name === 'SDK_READY') ready = true;
      (window.__gdEvents ||= []).push(e.name); } };
    try { await loadScript('https://html5.api.gamedistribution.com/main.min.js'); ready = true; } catch (e) { console.warn('GD SDK unavailable', e); } },
  loadingDone() {}, gameplayStart() {}, gameplayStop() {}, happytime() {},
  adsOn: () => ready && !!gd(),
  // showAd can stay pending forever when no ad fills (e.g. off-site / localhost): if the ad hasn't started within
  // 6 s we carry on; once it has started we wait for SDK_GAME_START (or the promise), capped at 90 s.
  async interstitial() { await this._show(); },
  onRunStart() { return this.interstitial(); },
  async rewarded() { rewardDone = false; await this._show('rewarded'); return rewardDone; },
  _show(type) { if (!gd()?.showAd) return Promise.resolve(); adStarted = false;
    return new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; onAdEnd = null; clearTimeout(t1); clearTimeout(t2); hooks.resume?.(); res(); };
      onAdEnd = fin; const t1 = setTimeout(() => { if (!adStarted) fin(); }, 6000), t2 = setTimeout(fin, 90000);
      (type ? gd().showAd(type) : gd().showAd()).then(fin, fin); }); },
};
