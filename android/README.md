# Kaasu for Android (APK)

This folder turns the Kaasu web app into an installable Android app (a
"Trusted Web Activity"). The APK opens the Kaasu website full-screen using
Chrome's engine, so:

- every website update reaches the app automatically (no new APK needed),
- Google sign-in and Drive backup work, because Google blocks sign-in inside
  ordinary in-app web views but allows it in Chrome.

## Download
**https://github.com/rlm1711204/my-cloud-test/releases/latest/download/Kaasu.apk**

On the phone: open the link → download → tap the file → **Install**.
The first time, Android asks you to allow installs from Chrome / Files: tap
**Settings → Allow from this source**, then go back and tap **Install**.
Play Protect may say "unknown app": tap **More details → Install anyway**.

## How the APK gets built
GitHub Actions (`.github/workflows/android-apk.yml`) builds it on GitHub's
servers whenever this folder changes, and publishes it on the Releases page.

## Signing key
`kaasu-release.p12` is the app's signing key, **encrypted** with a password
that is stored only as the GitHub secret `KAASU_KEYSTORE_PASSWORD`. Keep that
password safe (e.g. in a password manager). Every APK must be signed with
the same key, or phones will refuse to install an update over the old version.

## Hiding the address bar (optional)
Without extra setup, the app shows a thin address bar at the top. To remove
it, the file `assetlinks.json` (in this folder) must be published at
`https://rlm1711204.github.io/.well-known/assetlinks.json`. That needs a
second free GitHub repository named `rlm1711204.github.io`.
