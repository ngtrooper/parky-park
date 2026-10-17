// Web (GitHub Pages) + native Capacitor apps: localStorage saves; ads only in the native app (or ?mockads for QA).
import { showInterstitial, showRewarded, onRunStart, adsOn, isNative } from '../ads.js';
import { safeLocal } from './util.js';
export default {
  name: 'web', hasAds: false, // web build: no ad network (native Capacitor app and ?mockads turn ads on at runtime)
  externalLinks: true, storage: safeLocal,
  async init() {}, loadingDone() {}, gameplayStart() {}, gameplayStop() {}, happytime() {},
  adsOn, interstitial: showInterstitial, onRunStart: () => (isNative() ? showInterstitial() : onRunStart()),
  async rewarded() { let got = false; await showRewarded(() => { got = true; }); return got; },
};
