# Spot Thief: App Store / Play Store checklist

The app is a Capacitor wrapper around the web build (`dist/`).
- App id: `com.ngtrooper.spotthief`
- Name: "Spot Thief"
- Ads: `@capacitor-community/admob` 7.2.0, wired in `src/ads.js`. It uses **Google TEST ad unit IDs only**. No accounts have been created.

## Build commands (already set up on the box)
```
npm run build && npx cap sync          # copy web build into android/ + ios/
npm run android:apk                    # debug APK -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android:aab                    # release bundle (needs your signing key, see below)
```
JDK 21 is in `~/jdk`, and the Android SDK (platform/build-tools 35) is in `~/android-sdk`.

## Google Play (Android)
1. **Developer account:** $25 one-time at https://play.google.com/console. Identity verification is required. *Franklin.*
   - New personal accounts must run a **closed test with at least 12 testers for 14 days** before production.
2. **Signing key:** create an upload keystore. I can generate it on request, but Franklin must back it up, because losing it is painful.
   ```
   keytool -genkey -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   - Reference it in `android/app/build.gradle` (`signingConfigs`).
   - Then run `./gradlew bundleRelease` to get `app-release.aab`.
   - Enroll in Play App Signing. I can do the build; Franklin keeps the key.
3. **Upload an AAB, not an APK.** Target API must be the current Play requirement (35 is set).
4. **Privacy policy URL:** required because the app shows ads and uses the advertising ID.
   - I can write one and host it on GitHub Pages, e.g. `ngtrooper.github.io/parky-park/privacy.html`.
5. **Content rating:** fill in the IARC questionnaire. The game has cartoon cars and no violence, so expect "Everyone". *Franklin, in the console.*
6. **Data safety form:** declare
   - Device or other IDs (advertising ID)
   - App interactions and diagnostics collected by the AdMob SDK
   - Shared with Google for advertising
   - Encrypted in transit
   - Not collected by us
7. **Ads declaration:** "Contains ads: Yes". Target audience must be 13+ (not "designed for children"), to avoid Families policy requirements.
8. **AdMob:**
   - Create a free AdMob account (*Franklin*). Add the Android app and create 1 interstitial and 1 rewarded unit.
   - Send me the IDs. I replace the `TEST_IDS` in `src/ads.js`, set `isTesting:false`, and update `APPLICATION_ID` in `android/app/src/main/AndroidManifest.xml`.
   - Configure the UMP consent message (GDPR) in AdMob → Privacy & messaging. The code already calls `requestConsentInfo`/`showConsentForm`.
9. **app-ads.txt:** AdMob gives a line like `google.com, pub-XXXXXXXX, DIRECT, f08c47fec0942fa0`.
   - It must be served at the root of the **developer website** listed in Play, e.g. `https://ngtrooper.github.io/app-ads.txt`. That requires a `ngtrooper.github.io` user-site repo. I can set it up when approved.
10. **Store listing:** 512×512 icon, 1024×500 feature graphic, phone screenshots, short and full description. I can make all of these.

## Apple App Store (iOS)
1. **Apple Developer Program:** $99/year. *Franklin* (Apple ID plus enrollment).
2. **Building requires macOS + Xcode.** The box is Linux, so it can't build iOS. Options:
   - **A Mac:**
     ```
     npm run build && npx cap sync ios && npx cap open ios
     ```
     Then in Xcode set the Team, Archive, and choose Distribute → App Store Connect. CocoaPods/SPM resolve the AdMob SDK.
   - **A cloud build:**
     - **Codemagic** has a free tier with Capacitor support: connect the GitHub repo and add App Store Connect API key credentials.
     - **Ionic Appflow** is the Capacitor-native option but is paid.
     - EAS is Expo-only, so it doesn't fit here.
3. The project is already in `ios/`. `Info.plist` has:
   - the `GADApplicationIdentifier` (test)
   - `NSUserTrackingUsageDescription`
   - `SKAdNetworkItems`
4. **ATT prompt:** required before personalized ads. `src/ads.js` calls `trackingAuthorizationStatus` / `requestTrackingAuthorization` on iOS. Ads still work (non-personalized) if the user declines.
5. **App Store Connect:**
   - privacy "nutrition label" (Identifiers / Usage Data → Third-party advertising)
   - privacy policy URL
   - age rating (4+)
   - screenshots (6.7" and 6.5" iPhone, plus iPad if universal)
6. **AdMob iOS app:** add the app in AdMob and create its units. I swap in the IDs.

## Who does what
| Franklin (needs identity/payment) | I can do on the box |
|---|---|
| Pay Play $25 and Apple $99/yr, verify identity | Builds (APK/AAB), Capacitor sync, code changes |
| Create AdMob account, accept terms, payment/tax info | Swap in real ad unit IDs, consent wiring |
| Own the signing keystore / Apple certificates | Privacy policy page + app-ads.txt hosting (on approval) |
| Fill the content rating + data safety + ATT/privacy questionnaires (I can draft answers) | Icons, feature graphic, screenshots, listing text |
| Recruit 12 closed testers (Play) | Codemagic config file for iOS cloud builds |
| Mac or Codemagic account for iOS | |

## Trademark caution
- **No "Tesla", "Roadster", "Elon", "Cybertruck", or logos/wordmarks** in the app name, icon, description, keywords or screenshots. Both stores reject impersonation and infringement, and it invites takedowns.
- The car stays a generic white wedge. The parody humor ("parking date slipped") is fine in-game, but keep the listing generic, e.g. *"Launch off a ramp, flip, and steal the best parking spot."*
