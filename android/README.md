# CamCam Android app

## Native push notifications

The release workflow reads `FIREBASE_GOOGLE_SERVICES_JSON_B64` from GitHub Actions
secrets and writes it to `android/app/google-services.json` only while building.
The backend separately reads `FIREBASE_SERVICE_ACCOUNT_B64`; never put the
service-account key inside the app or commit either Firebase JSON file.

CamCam now builds one installable APK: `CamCam.apk` (`com.camcam`).

On first launch the user chooses one of two roles inside the same app:

- **Camera** — opens `/camera`, requests camera/microphone only when the CamCam HTTPS origin asks for them, and keeps the screen awake while publishing.
- **Viewer** — opens the normal CamCam dashboard and refuses camera/microphone WebView access.

The selected role is remembered. From the root screen, pressing Android Back returns to the role chooser so the same installed app can switch between Camera and Viewer later.

Security hardening remains shared: HTTPS-only navigation, SSL errors fail closed, no mixed content, no file/content access, no third-party cookies, and WebView debugging is disabled. Only CamCam and the Zibal payment host stay inside the WebView; unrelated links are routed to Android externally.

The GitHub workflow builds the unified internal sideload APK and publishes it as an artifact and release asset. A production store build should use a private release signing key stored only in GitHub Actions secrets.
