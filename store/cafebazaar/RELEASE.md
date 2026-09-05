# Cafe Bazaar release process

CamCam must use the same private Android signing key for every Cafe Bazaar update. Never commit the `.jks`/`.keystore` file to this public repository.

## One-time GitHub Actions secrets

Add these repository secrets before running **Build Cafe Bazaar Release**:

- `ANDROID_KEYSTORE_BASE64` — base64 of the release JKS/keystore file
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — release key alias
- `ANDROID_KEY_PASSWORD` — release key password

The workflow decodes the keystore only into the temporary GitHub runner directory and deletes it automatically with the runner after the job.

## Output

The workflow produces:

- `CamCam-Bazaar.apk` — signed production APK, directly suitable for APK-based Bazaar submission
- `CamCam-Bazaar.aab` — signed Android App Bundle
- `SHA256SUMS.txt` — artifact digests
- `SIGNING-CERTIFICATE.txt` — certificate information for future update verification

For the first release, retain an offline backup of the signing keystore and its passwords. Losing the key can prevent publishing updates under the same package name.

## App identity

- Package: `com.camcam`
- Version: `1.2.0`
- Version code: `3`
- Minimum Android: API 26
- Target SDK: API 35
- Privacy policy: `https://camcam.smarbiz.sbs/static/privacy.html`

## Before submission

1. Install the signed production APK on a real Android device.
2. Verify the role chooser, Camera mode, Viewer mode, login, pairing and live view.
3. Verify content is not hidden behind the status bar, display cutout or bottom navigation/gesture area.
4. Verify camera/microphone permissions are requested only in Camera mode.
5. Upload the listing text from `listing-fa.md` and required screenshots/icon in Pishkhan.
6. Keep the signing key backup outside GitHub.
