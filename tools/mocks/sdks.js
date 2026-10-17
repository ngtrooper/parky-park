// Mock portal SDKs for local tests (served in place of the real SDK URLs by tools/portal_test.mjs).
window.__sdkLog = [];
const log = (...a) => window.__sdkLog.push(a.join(':'));
const adRun = (cbStart, ms = 300) => new Promise(r => { cbStart?.(); window.__inAd = true; setTimeout(() => { window.__inAd = false; r(); }, ms); });
if (window.__MOCK === 'crazygames') {
  const mem = {};
  window.CrazyGames = { SDK: { environment: 'local', async init() { log('init'); },
    game: { settings: { muteAudio: false, disableChat: false }, addSettingsChangeListener: f => { window.__cgSettings = f; log('settingsListener'); }, gameplayStart: () => log('gameplayStart'), gameplayStop: () => log('gameplayStop'), happytime: () => log('happytime'), loadingStart: () => log('loadingStart'), loadingStop: () => log('loadingStop') },
    ad: { requestAd(t, cb) { log('ad', t); setTimeout(() => { cb.adStarted(); window.__mutedDuringAd = window.__pp?.sfx?.muted || window.__adMuted?.(); setTimeout(() => cb.adFinished(), 300); }, 50); } },
    data: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); log('data.set', k); }, removeItem: k => delete mem[k], clear: () => { for (const k in mem) delete mem[k]; log('data.clear'); } } } };
}
if (window.__MOCK === 'poki') {
  window.PokiSDK = { init: async () => log('init'), gameLoadingFinished: () => log('loadingFinished'), gameplayStart: () => log('gameplayStart'), gameplayStop: () => log('gameplayStop'),
    commercialBreak: async f => { log('commercialBreak'); await adRun(f); }, rewardedBreak: async f => { log('rewardedBreak'); await adRun(f); return true; } };
}
if (window.__MOCK === 'gamedistribution') {
  window.gdsdk = { showAd: async t => { log('showAd', t || 'interstitial'); window.GD_OPTIONS.onEvent({ name: 'SDK_GAME_PAUSE' }); await adRun(null);
    if (t === 'rewarded') window.GD_OPTIONS.onEvent({ name: 'SDK_REWARDED_WATCH_COMPLETE' }); window.GD_OPTIONS.onEvent({ name: 'SDK_GAME_START' }); }, preloadAd: async () => {} };
  window.GD_OPTIONS?.onEvent({ name: 'SDK_READY' });
}
