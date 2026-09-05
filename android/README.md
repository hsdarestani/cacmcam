# CamCam Android apps

This project builds two installable APK flavors from the same hardened WebView shell:

- `CamCam-Camera.apk` (`com.camcam.camera`) opens `/camera`, requests camera/microphone only when the CamCam origin asks for them, keeps the screen awake while used as a camera, blocks cleartext HTTP and rejects SSL errors.
- `CamCam-Viewer.apk` (`com.camcam.viewer`) opens the normal CamCam dashboard and never grants camera/microphone WebView permissions.

Both apps only keep CamCam and the Zibal payment host inside the app. Other links open through Android's normal external-app routing. Third-party cookies, file access, content access, mixed content and WebView debugging are disabled.

The GitHub workflow builds signed debug APKs for internal sideloading and publishes them as workflow artifacts and release assets. A production store build should use a private release signing key stored only in GitHub Actions secrets.
