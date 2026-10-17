// CrazyGames HTML5 SDK v3 (docs.crazygames.com/sdk/intro). Saves go through the Data module (synced to the
// player's CrazyGames account; guests saved locally by the SDK and migrated on login).
import { loadScript, safeLocal } from './util.js';
let SDK = null, hooks = {};
const ok = () => SDK && SDK.environment !== 'disabled';
const ad = type => new Promise(res => {
  if (!ok()) return res(false);
  let started = false;
  try { SDK.ad.requestAd(type, {
    adStarted: () => { started = true; hooks.pause?.(); },
    adFinished: () => { hooks.resume?.(); res(true); },
    adError: () => { if (started) hooks.resume?.(); res(false); },
  }); } catch { res(false); }
});
export default {
  name: 'crazygames', hasAds: true, // CrazyGames serves video ads (Full Launch only)
  externalLinks: false,
  storage: {
    getItem: k => ok() ? SDK.data.getItem(k) : safeLocal.getItem(k),
    setItem: (k, v) => ok() ? SDK.data.setItem(k, v) : safeLocal.setItem(k, v),
    removeItem: k => ok() ? SDK.data.removeItem(k) : safeLocal.removeItem(k),
    clearPrefix: p => ok() ? SDK.data.clear() : safeLocal.clearPrefix(p), // Data module is scoped to this game
  },
  async init(h) { hooks = h; try { await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js'); SDK = window.CrazyGames.SDK; await SDK.init();
      // one-time copy of any pre-existing local save into the Data module
      if (ok() && !SDK.data.getItem('parkypark_v1')) { const old = safeLocal.getItem('parkypark_v1'); if (old) SDK.data.setItem('parkypark_v1', old); }
      // Full Launch requirement: honour the site's muteAudio setting (priority over our in-game toggle)
      if (ok()) { hooks.platformMute?.(!!SDK.game.settings?.muteAudio);
        SDK.game.addSettingsChangeListener?.(st => hooks.platformMute?.(!!st?.muteAudio)); }
      SDK.game.loadingStart?.();
    } catch (e) { console.warn('CrazyGames SDK unavailable', e); SDK = null; } },
  loadingDone() { if (ok()) SDK.game.loadingStop?.(); },
  gameplayStart() { if (ok()) SDK.game.gameplayStart(); },
  gameplayStop() { if (ok()) SDK.game.gameplayStop(); },
  happytime() { if (ok()) SDK.game.happytime(); },
  adsOn: () => ok(),
  interstitial: () => ad('midgame'),
  onRunStart() { return ad('midgame'); }, // SDK enforces its own ~3 min cooldown
  rewarded: () => ad('rewarded'),
};
