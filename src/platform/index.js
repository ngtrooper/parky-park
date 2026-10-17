// Platform layer, chosen at build time with VITE_PLATFORM = web | crazygames | poki | gamedistribution.
// Unused adapters are dropped from the bundle (constant-folded dynamic imports).
const NAME = import.meta.env.VITE_PLATFORM || 'web';
const mod = NAME === 'crazygames' ? await import('./crazygames.js') : NAME === 'poki' ? await import('./poki.js')
  : NAME === 'gamedistribution' ? await import('./gamedistribution.js') : await import('./web.js');
const A = mod.default;
let playing = false;
export const platform = {
  ...A,
  // per-platform ad flag: hasAds = the platform has an ad network; adsOn() = ads usable right now (SDK loaded).
  // Every ad UI (2x coins, daily ad gift, interstitials) is gated on adsOn(); no-ads platforms get a free daily bonus.
  adsOn: () => !!(A.adsOn?.()) && (A.hasAds || A.name === 'web'),
  // idempotent gameplay start/stop (portals want exactly one event per transition)
  gameplayStart() { if (!playing) { playing = true; A.gameplayStart(); } },
  gameplayStop() { if (playing) { playing = false; A.gameplayStop(); } },
};
