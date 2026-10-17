// Platform layer, chosen at build time with VITE_PLATFORM = web | crazygames | poki | gamedistribution.
// Unused adapters are dropped from the bundle (constant-folded dynamic imports).
const NAME = import.meta.env.VITE_PLATFORM || 'web';
const mod = NAME === 'crazygames' ? await import('./crazygames.js') : NAME === 'poki' ? await import('./poki.js')
  : NAME === 'gamedistribution' ? await import('./gamedistribution.js') : await import('./web.js');
const A = mod.default;
let want = false, gpT = null, gpLast = 0, playing = false, lastAd = Date.now(); // count page load (portal preroll) as the last ad
const MIN_GAP = 60000; // >= 60 s between interstitials (GD also enforces this; CrazyGames uses ~3 min itself)
export const platform = {
  ...A,
  // per-platform ad flag: hasAds = the platform has an ad network; adsOn() = ads usable right now (SDK loaded).
  // Every ad UI (2x coins, daily ad gift, interstitials) is gated on adsOn(); no-ads platforms get a free daily bonus.
  adsOn: () => !!(A.adsOn?.()) && (A.hasAds || A.name === 'web'),
  // gameplay start/stop: one event per real transition, at most one call per 1.1 s (CrazyGames throttles faster calls);
  // quick flips (boot scene -> menu, stop -> start between runs) collapse to the final state
  async onRunStart() { if (A.name === 'web') return A.onRunStart(); // web/native app: own every-3rd-run pacing
    if (!platform.adsOn() || Date.now() - lastAd < (window.__adGap ?? MIN_GAP)) return; lastAd = Date.now(); await A.onRunStart(); lastAd = Date.now(); },
  async rewarded() { const ok = await A.rewarded(); lastAd = Date.now(); return ok; }, // a rewarded ad also resets the interstitial timer
  gameplayStart() { want = true; sched(); },
  gameplayStop() { want = false; sched(); },
};
function sched() {
  if (gpT) return;
  gpT = setTimeout(() => { gpT = null; if (want === playing) return; playing = want; gpLast = Date.now(); playing ? A.gameplayStart() : A.gameplayStop(); },
    Math.max(0, gpLast + 1100 - Date.now()));
}
