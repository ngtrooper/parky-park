// Ad abstraction. Web build: mock ads (a short fake "test ad" overlay). Native (Capacitor): AdMob via
// @capacitor-community/admob using Google's PUBLIC TEST ad unit IDs only. Swap in real IDs at publish time.
const TEST_IDS = {
  android: { interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
  ios: { interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
};
const cap = () => window.Capacitor;
export const isNative = () => !!cap()?.isNativePlatform?.();
// Ads only exist in the native apps. The web build shows none (?mockads turns on the test mock for QA).
export const adsOn = () => isNative() || /[?&]mockads/.test(location.search);
let admob = null, ready = null;
async function native() {
  if (!isNative()) return null;
  if (!ready) ready = (async () => {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({ initializeForTesting: true });
    try { await AdMob.requestTrackingAuthorization?.(); } catch {} // iOS ATT prompt
    try { const c = await AdMob.requestConsentInfo(); if (c.isConsentFormAvailable && c.status === 'REQUIRED') await AdMob.showConsentForm(); } catch {}
    admob = AdMob; return AdMob;
  })().catch(e => { console.warn('AdMob unavailable', e); return null; });
  return ready;
}
const ids = () => TEST_IDS[cap()?.getPlatform?.() === 'ios' ? 'ios' : 'android'];
if (isNative()) native();

function mock(kind, ms) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'mockad p';
    d.innerHTML = `<div><b>TEST AD</b><br>${kind === 'rewarded' ? 'Rewarded' : 'Interstitial'} placeholder<br><small>(web build: no real ads)</small><br><span>${Math.ceil(ms / 1000)}</span></div>`;
    document.getElementById('ui').appendChild(d);
    let left = ms; const iv = setInterval(() => { left -= 250; d.querySelector('span').textContent = Math.max(0, Math.ceil(left / 1000)); if (left <= 0) { clearInterval(iv); d.remove(); res(true); } }, 250);
  });
}
let busy = false;
export async function showInterstitial() {
  if (busy) return; busy = true;
  try {
    const A = await native();
    if (A) { await A.prepareInterstitial({ adId: ids().interstitial, isTesting: true }); await A.showInterstitial(); }
    else await mock('interstitial', 1500);
  } catch (e) { console.warn('interstitial failed', e); } finally { busy = false; }
}
export async function showRewarded(onReward) {
  if (busy) return false; busy = true;
  try {
    const A = await native();
    if (A) {
      let got = false;
      const h = await A.addListener('onRewardedVideoAdReward', () => { got = true; });
      await A.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: true });
      await A.showRewardVideoAd(); h.remove?.();
      if (got) onReward?.(); return got;
    }
    await mock('rewarded', 2500); onReward?.(); return true;
  } catch (e) { console.warn('rewarded failed', e); return false; } finally { busy = false; }
}
// interstitial pacing: every 3rd run start, never mid-run
let runsSince = 0;
export function onRunStart() { if (!adsOn()) return Promise.resolve(); runsSince++; if (runsSince >= 4) { runsSince = 1; return showInterstitial(); } return Promise.resolve(); }
