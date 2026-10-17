# Spot Thief: web portal launch checklist

Research date: 16 Oct 2026. Nothing has been submitted and no accounts have been created; every sign-up and submit step below is for Franklin to do.

## 1. Which portal first, and why

| Rank | Portal | Money potential | Ease | Why |
|---|---|---|---|---|
| 1 | **CrazyGames** | High | Medium | Large audience and a non-exclusive deal. A Basic Launch with no ads tests the game first, then a Full Launch turns ads on. The Data module gives real account cloud saves. Optional time-limited exclusivity raises pay by 50%. |
| 2 | **Poki** | Highest per player | Hard | It is the biggest portal (100M+ monthly players) and pays 100% on players you bring yourself and 50/50 on players Poki brings. It needs **web exclusivity**, which rules out CrazyGames and GameDistribution, and acceptance is strict. Apply first only if you're willing to go Poki-only. |
| 3 | **GameDistribution** | Medium-low | Easy | It spreads the game to thousands of sites and pays a published 33% of net revenue. It isn't exclusive, but the GD build must match the latest version published elsewhere. |
| 4 | Y8 | Low-medium | Easy | Pays 50% of in-game ad revenue through the Y8 SDK. There is no adapter yet; it would be a small add. |
| 5 | itch.io | Very low (no ads) | Very easy | No ad network. It's fine for a free page or tips, and builds community. |
| 6 | Newgrounds | Very low | Easy | Its revenue program is legacy/inactive. Good for exposure only. |
| n/a | Facebook Instant Games / Telegram mini games | Uncertain | Hard | Facebook announced major changes to Instant/Web Games on 31 Jul 2025. Telegram ad monetization isn't documented in a comparable way. Not worth doing first. |

**Recommendation:** start with **CrazyGames** (Basic Launch, then Full Launch). Add **GameDistribution** and **Y8** for extra reach and revenue. Apply to Poki only in place of the others, never alongside them, because Poki is exclusive.

## 2. Ads and payouts by platform

| Platform | Ads in our build? | Who serves the ads | Developer revenue share | Payout minimum / timing | Source |
|---|---|---|---|---|---|
| CrazyGames | Yes (Full Launch only; disabled in Basic Launch) | CrazyGames SDK v3 (midgame + rewarded) | Not published; calculated monthly from traffic and ad performance. Optional exclusivity: +50% | €100, monthly via Tipalti | docs.crazygames.com/sdk/video-ads, files.crazygames.com/documents/developer_terms_20250818.pdf, playgama.com/blog (revenue-share comparison) |
| Poki | Yes | Poki SDK (commercialBreak / rewardedBreak) | 100% on direct players, 50/50 on players Poki brings; web-exclusive | Not published (wire / PayPal) | developers.poki.com/guide/working-with-poki, sdk.poki.com/html5 |
| GameDistribution | Yes | GD SDK (showAd interstitial / rewarded) | 33% of net revenue | €100 (FAQ says €50 by PayPal); paid within 60 days of the monthly report | static.gamedistribution.com/terms/developer.html, portalready.world/portals/portal-payouts-compared |
| Y8 | Not yet (no adapter) | Y8 SDK (Y8-managed), or AdSense for Platforms if eligible | 50% of eligible in-game ad revenue | Not published | developer.y8.com |
| itch.io | **No**: ad UI hidden, free daily bonus shown | none | Sales/tips only; you set itch.io's cut (default 10%) | n/a | itch.io/updates/introducing-open-revenue-sharing |
| Newgrounds | **No**: ad UI hidden | none (legacy program inactive) | n/a | Historically $100, NET 30 | newgrounds.com/wiki/creator-resources/monetization |
| GitHub Pages web build | **No**: ad UI hidden | none | n/a | n/a | n/a |
| Android/iOS app (Capacitor) | Yes (test IDs only for now) | Google AdMob | Google's AdMob share | AdMob threshold | AdMob account needed |

How the per-platform ad flag works (`src/platform/`):
- Each adapter declares `hasAds`. The runtime check `platform.adsOn()` is true only when the platform has ads **and** its SDK actually loaded.
- Every ad feature is gated on that check: the 2x-coins button, the daily ad gift and the between-run interstitials.
- When ads are off, all ad UI is hidden. The daily ad gift becomes a free **daily bonus** worth half the ad gift, once per local day, with a countdown.

**Realistic revenue:** no portal publishes typical earnings or eCPM (portalready.world notes this explicitly). For a small, unproven casual game, expect roughly $0–$50 per month on any single portal until it gets featured. A featured hit can earn far more, but plan for little. Revenue tracks plays × ad views, so the rewarded 2x-coins and daily gift help.

## 3. What's done (in this repo)

- **Platform layer:** `src/platform/{web,crazygames,poki,gamedistribution}.js`, chosen by `VITE_PLATFORM` at build time.
  - Interstitials and rewarded ads are mapped onto each SDK.
  - Gameplay start/stop fire once per transition. Poki also gets loading-finished, and CrazyGames gets loading start/stop.
  - Game logic and audio pause and mute during ads.
  - CrazyGames "happytime" fires when you set a new farthest spot (#3 or beyond).
- **Saves:**
  - CrazyGames uses the **Data module**, which syncs to the player's CrazyGames account. Guests are saved locally by the SDK and migrated when they log in. Any old local save is copied in once.
  - **Poki** automatically syncs localStorage to logged-in players' cloud saves, so it needs no code.
  - GameDistribution and the web build use localStorage only (no account sync).
  - All storage is wrapped in try/catch, so the game stays playable in incognito.
- **Portal builds:**
  - `npm run build:portals` produces `dist-portals/crazygames.zip`, `poki.zip` and `gamedistribution.zip` (about 393 KB each, relative paths, `index.html` at the zip root).
  - Single-portal scripts: `build:crazygames`, `build:poki` and `build:gamedistribution`.
  - GameDistribution needs `VITE_GD_GAME_ID=<hash> npm run build:gamedistribution` once you have the ID.
- **No external links:** the game has none, no repo/GitHub mention and no "Tesla". The Phaser console banner is off. The daily share button only copies text.
- **Requirements fixed:**
  - Loading screen.
  - Responsive 16:9 / mobile layout with safe-area padding.
  - Pause plus mute on tab hide or window blur (shows ⏸ PAUSED).
  - 🔊/🔇 mute toggle in the HUD, saved.
  - Arrow keys, space and the mouse wheel don't scroll the host page.
  - `user-select: none`.
  - No console errors.
- **Tests:**
  - `node tools/portal_test.mjs` runs every portal build against mocked SDKs. It checks events, ads plus mute, rewarded grants, Data-module saves and no leaks, and that the web build hides ads.
  - `node tools/cg_localsdk_test.mjs` runs the **real** CrazyGames SDK in its `local` mode with no errors.

## 4. What Franklin must do

**CrazyGames (first):**
1. Sign up at developer.crazygames.com and accept the developer terms.
2. Fill in payout and tax details (Tipalti: bank/PayPal plus a W-9 or W-8 form).
3. `npm run build:crazygames` → upload `dist-portals/crazygames.zip`.
4. In the submission form:
   - Turn on the **Progress Save → Data module** toggle.
   - Pick landscape plus mobile.
   - Paste the listing text below and upload the cover art.
5. Use the QA preview link to play once. Submit for **Basic Launch**, and if it performs CrazyGames moves it to Full Launch, where ads turn on.

**GameDistribution (optional, in parallel; not with Poki):**
1. Sign up at developer.gamedistribution.com and add payment/VAT info.
2. Create the game to get its game ID, and enable the **Rewarded Ads** flag.
3. Build with `VITE_GD_GAME_ID=... npm run build:gamedistribution` and upload the zip.

**Poki (instead of the above, exclusive):**
1. Sign up at developers.poki.com.
2. Upload `poki.zip` to the Poki Inspector and test.
3. Send a review request.

**Y8:** sign up at developer.y8.com. Ask me to add a Y8 adapter (cloud saves are supported there).

## 5. Listing text (trademark-safe)

- **Title:** Spot Thief
- **Short description:** Launch your rocket-powered car off a giant ramp, fly over the packed lot, and steal the best parking spot before the rivals do!
- **Long description:**
  - The lot is full and every car can fly. Boost down the ramp, pilot your car with real thrusters (lift, push, brake, slam down) and flip it in mid-air for bonus pay. Then land and stop in a free spot before a rival steals it.
  - Farther spots pay more. Spend coins on 7 upgrade lines (boost, air tank, thrusters, tires, gyro, coin magnet), unlock car skins and thruster flame colours, and come back for the Daily Lot.
  - Also includes hand-made puzzle levels.
- **Controls:**
  - Keyboard: ← → drive · W A S D thrusters (D on the ramp = boost) · Q / E flip · ↓ or Space hop · R retry · Enter next · Esc menu.
  - Touch: ◀ ▶ drive (left thumb) · 8-way THRUST pad (right thumb) · ⟲ ⟳ flip · ⤒ hop.
- **Tags:** driving, car, physics, parking, flying, stunt, skill, casual, upgrade, one-button-ish, mobile, arcade
- **Category:** Driving / Casual
- **Privacy note:**
  - Spot Thief stores your progress on your device (and, on CrazyGames and Poki, in your portal account's cloud save). It collects no personal data itself.
  - Ads, where shown, are served by the hosting platform under its own privacy policy.
- Never use "Tesla", "Roadster", "SpaceX" or any brand logo in the title, art or tags. Keep it a generic red sports car.

## 6. Art needed before submission (placeholders hurt acceptance)

Poki and CrazyGames review art quality and thumbnail CTR. Programmer-art covers are likely to get rejected or buried. Commission or make:

| Asset | Size | Notes |
|---|---|---|
| Cover / thumbnail (landscape) | 1280×720 | Hero shot: car mid-flip over the lot, big readable logo |
| Square icon | 512×512 | Car plus "P" sign; readable at 64 px |
| Portrait cover (CrazyGames, optional) | 800×1200 | Same scene, vertical |
| Gameplay screenshots | 1920×1080 ×3–5 | Ramp boost, mid-air thrust, steal moment, shop |
| Gameplay video (CrazyGames) | 15–30 s, 1080p | First 3 s must show the launch |

Placeholder list (to replace): `shots/touch_v8b.png` and `shots/shop_v9.png` (UI references only), `shots/launch_v8.gif` (flight reference).

## 7. Before every portal upload

- `npm run build:portals && node tools/portal_test.mjs` → expect PORTAL BUILDS OK.
- Keep the same version on every non-exclusive portal (GameDistribution's terms §2.6.4).
