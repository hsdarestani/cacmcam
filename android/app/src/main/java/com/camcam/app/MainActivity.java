package com.camcam.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int MEDIA_PERMISSION_REQUEST = 2401;
    private static final String APP_HOST = "camcam.smarbiz.sbs";
    private static final String PAYMENT_HOST = "gateway.zibal.ir";
    private static final String CAMERA_URL = "https://camcam.smarbiz.sbs/camera";
    private static final String VIEWER_URL = "https://camcam.smarbiz.sbs/";
    private static final String PREFS = "camcam_app";
    private static final String PREF_MODE = "mode";
    private static final String MODE_CAMERA = "camera";
    private static final String MODE_VIEWER = "viewer";
    private static final int APP_BG = 0xFFF6F0E6;

    private WebView webView;
    private PermissionRequest pendingPermissionRequest;
    private String currentMode;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private int normalSystemUiVisibility;
    private int normalRequestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        String savedMode = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_MODE, null);
        if (MODE_CAMERA.equals(savedMode) || MODE_VIEWER.equals(savedMode)) {
            startMode(savedMode, false);
        } else {
            showRoleChooser();
        }
    }

    private void configureSystemBars() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(APP_BG);
        getWindow().setNavigationBarColor(APP_BG);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private void setSafeContentView(View content) {
        content.setBackgroundColor(APP_BG);
        setContentView(content);
    }

    private void resetLowPowerWindow() {
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
        getWindow().setAttributes(params);
        if (isCameraMode()) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private void stopCameraService() {
        try {
            stopService(new Intent(this, CameraKeepAliveService.class));
        } catch (Exception ignored) {
        }
    }

    private void showRoleChooser() {
        currentMode = null;
        stopCameraService();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        resetLowPowerWindow();
        destroyWebView();

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setPadding(dp(28), dp(36), dp(28), dp(36));
        page.setBackgroundColor(APP_BG);
        page.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView mark = new TextView(this);
        mark.setText("🐾");
        mark.setGravity(Gravity.CENTER);
        mark.setTextSize(34);
        GradientDrawable markBg = new GradientDrawable();
        markBg.setColor(Color.rgb(227, 239, 235));
        markBg.setCornerRadius(dp(22));
        mark.setBackground(markBg);
        LinearLayout.LayoutParams markLp = new LinearLayout.LayoutParams(dp(72), dp(72));
        markLp.bottomMargin = dp(22);
        page.addView(mark, markLp);

        TextView title = new TextView(this);
        title.setText("این گوشی برای پت چه کاری می‌کند؟");
        title.setTextColor(Color.rgb(23, 60, 58));
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        page.addView(title, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView subtitle = new TextView(this);
        subtitle.setText("یک اپ برای گوشی کنار پت و گوشی خودت؛ هر وقت خواستی نقش را عوض کن.");
        subtitle.setTextColor(Color.rgb(107, 126, 121));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(8), 0, dp(24));
        page.addView(subtitle, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button camera = roleButton("📷  این گوشی کنار پت می‌ماند", true);
        camera.setOnClickListener(v -> startMode(MODE_CAMERA, true));
        page.addView(camera, roleButtonParams());

        Button viewer = roleButton("👁  با این گوشی پت را می‌بینم", false);
        viewer.setOnClickListener(v -> startMode(MODE_VIEWER, true));
        LinearLayout.LayoutParams viewerLp = roleButtonParams();
        viewerLp.topMargin = dp(12);
        page.addView(viewer, viewerLp);

        TextView hint = new TextView(this);
        hint.setText("برای تغییر نقش بعداً، در صفحه اصلی اپ دکمه برگشت گوشی را بزن.");
        hint.setTextColor(Color.rgb(111, 129, 124));
        hint.setTextSize(11);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(10), dp(20), dp(10), 0);
        page.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setSafeContentView(page);
    }

    private Button roleButton(String text, boolean primary) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(16), dp(14), dp(16), dp(14));
        button.setTextColor(primary ? Color.WHITE : Color.rgb(23, 60, 58));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(primary ? Color.rgb(13, 107, 102) : Color.rgb(255, 253, 248));
        bg.setStroke(dp(1), primary ? Color.rgb(13, 107, 102) : Color.rgb(216, 208, 195));
        bg.setCornerRadius(dp(18));
        button.setBackground(bg);
        return button;
    }

    private LinearLayout.LayoutParams roleButtonParams() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62));
        lp.leftMargin = dp(6);
        lp.rightMargin = dp(6);
        return lp;
    }

    private void startMode(String mode, boolean persist) {
        currentMode = mode;
        if (persist) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_MODE, mode).apply();
        }
        if (isCameraMode()) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            stopCameraService();
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        resetLowPowerWindow();
        destroyWebView();
        webView = new WebView(this);
        configureWebView();
        setSafeContentView(webView);
        webView.loadUrl(isCameraMode() ? CAMERA_URL : VIEWER_URL);
    }

    private boolean isCameraMode() {
        return MODE_CAMERA.equals(currentMode);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CamCamAndroid/1.3.0 " + (isCameraMode() ? "Camera" : "Viewer"));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new NativeBridge(), "CamCamNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.startsWith("https://" + APP_HOST)) {
                    disableWebOrientationLock(view);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingPermissionRequest == request) {
                    pendingPermissionRequest = null;
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                enterFullscreen(view, callback);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onShowCustomView(View view, int requestedOrientation, CustomViewCallback callback) {
                enterFullscreen(view, callback);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
    }

    private class NativeBridge {
        @JavascriptInterface
        public void setCameraActive(boolean active) {
            runOnUiThread(() -> {
                if (!isCameraMode()) return;
                Intent service = new Intent(MainActivity.this, CameraKeepAliveService.class);
                try {
                    if (active) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(service);
                        } else {
                            startService(service);
                        }
                    } else {
                        stopService(service);
                    }
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void setLowPower(boolean enabled) {
            runOnUiThread(() -> {
                WindowManager.LayoutParams params = getWindow().getAttributes();
                if (enabled) {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    params.screenBrightness = 0.01f;
                } else {
                    if (isCameraMode()) {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                    params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                }
                getWindow().setAttributes(params);
            });
        }

        @JavascriptInterface
        public String getBatteryInfo() {
            try {
                Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if (battery == null) return "{}";
                int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                int tempTenths = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
                boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
                int percent = level >= 0 && scale > 0 ? Math.round(level * 100f / scale) : -1;
                JSONObject result = new JSONObject();
                if (percent >= 0) result.put("battery", percent);
                result.put("charging", charging);
                if (tempTenths != Integer.MIN_VALUE) result.put("temperature_c", tempTenths / 10.0);
                return result.toString();
            } catch (Exception ignored) {
                return "{}";
            }
        }
    }

    private void disableWebOrientationLock(WebView view) {
        String script = "(function(){"
                + "try{"
                + "if(typeof lockLandscape==='function'){lockLandscape=async function(){};}"
                + "if(typeof unlockOrientation==='function'){unlockOrientation=function(){};}"
                + "if(typeof goFullscreen==='function'){goFullscreen=async function(){var v=document.getElementById('archiveVideo')||document.getElementById('v');if(!v)return;try{if(v.requestFullscreen){await v.requestFullscreen();}else if(v.webkitRequestFullscreen){v.webkitRequestFullscreen();}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen();}v.play().catch(function(){});}catch(e){v.play().catch(function(){});}};}"
                + "if(typeof fullscreenLive==='function'){fullscreenLive=async function(){var v=document.getElementById('liveVideo');if(!v)return;try{if(v.requestFullscreen){await v.requestFullscreen();}else if(v.webkitRequestFullscreen){v.webkitRequestFullscreen();}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen();}v.play().catch(function(){});}catch(e){}};}"
                + "}catch(e){}"
                + "})();";
        view.evaluateJavascript(script, null);
    }

    private void enterFullscreen(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreenView != null) return;
        fullscreenView = view;
        fullscreenCallback = callback;
        normalSystemUiVisibility = getWindow().getDecorView().getSystemUiVisibility();
        normalRequestedOrientation = getRequestedOrientation();
        if (fullscreenView.getParent() instanceof ViewGroup) {
            ((ViewGroup) fullscreenView.getParent()).removeView(fullscreenView);
        }
        FrameLayout content = findViewById(android.R.id.content);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        content.addView(fullscreenView, params);
        fullscreenView.setBackgroundColor(Color.BLACK);
        if (webView != null) webView.setVisibility(View.GONE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        applyFullscreenUi();
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR);
    }

    private void applyFullscreenUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        if (fullscreenView.getParent() instanceof ViewGroup) {
            ((ViewGroup) fullscreenView.getParent()).removeView(fullscreenView);
        }
        fullscreenView = null;
        if (webView != null) webView.setVisibility(View.VISIBLE);
        WebChromeClient.CustomViewCallback callback = fullscreenCallback;
        fullscreenCallback = null;
        if (callback != null) callback.onCustomViewHidden();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        setRequestedOrientation(normalRequestedOrientation);
        configureSystemBars();
        getWindow().getDecorView().setSystemUiVisibility(normalSystemUiVisibility);
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if ("https".equalsIgnoreCase(scheme) && APP_HOST.equalsIgnoreCase(host)) {
            return false;
        }
        // Keep the native bridge isolated to CamCam pages; payment/external pages
        // open in the system browser instead of sharing this WebView process.
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
        }
        return true;
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (origin == null || !"https".equalsIgnoreCase(origin.getScheme()) || !APP_HOST.equalsIgnoreCase(origin.getHost())) {
            request.deny();
            return;
        }
        pendingPermissionRequest = request;
        List<String> missing = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && isCameraMode()
                    && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.CAMERA);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        if (isCameraMode() && Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (missing.isEmpty()) {
            grantAllowedResources(request);
        } else {
            requestPermissions(missing.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
        }
    }

    private void grantAllowedResources(PermissionRequest request) {
        if (request == null) return;
        List<String> allowed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && isCameraMode()
                    && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            }
        }
        pendingPermissionRequest = null;
        if (allowed.isEmpty()) request.deny();
        else request.grant(allowed.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_REQUEST && pendingPermissionRequest != null) {
            grantAllowedResources(pendingPermissionRequest);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (fullscreenView != null) fullscreenView.post(this::applyFullscreenUi);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && fullscreenView != null) applyFullscreenUi();
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else if (currentMode != null) {
            showRoleChooser();
        } else {
            super.onBackPressed();
        }
    }

    private void destroyWebView() {
        if (fullscreenView != null) exitFullscreen();
        if (pendingPermissionRequest != null) {
            pendingPermissionRequest.deny();
            pendingPermissionRequest = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeJavascriptInterface("CamCamNative");
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        destroyWebView();
        stopCameraService();
        super.onDestroy();
    }
}
