package com.camcam.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

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

    private WebView webView;
    private PermissionRequest pendingPermissionRequest;
    private String currentMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String savedMode = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_MODE, null);
        if (MODE_CAMERA.equals(savedMode) || MODE_VIEWER.equals(savedMode)) {
            startMode(savedMode, false);
        } else {
            showRoleChooser();
        }
    }

    private void showRoleChooser() {
        currentMode = null;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        destroyWebView();

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setPadding(dp(28), dp(36), dp(28), dp(36));
        page.setBackgroundColor(Color.rgb(246, 240, 230));
        page.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView mark = new TextView(this);
        mark.setText("◇");
        mark.setGravity(Gravity.CENTER);
        mark.setTextSize(38);
        mark.setTextColor(Color.rgb(13, 107, 102));
        GradientDrawable markBg = new GradientDrawable();
        markBg.setColor(Color.rgb(227, 239, 235));
        markBg.setCornerRadius(dp(22));
        mark.setBackground(markBg);
        LinearLayout.LayoutParams markLp = new LinearLayout.LayoutParams(dp(72), dp(72));
        markLp.bottomMargin = dp(22);
        page.addView(mark, markLp);

        TextView title = new TextView(this);
        title.setText("این گوشی قراره چیکار کنه؟");
        title.setTextColor(Color.rgb(23, 60, 58));
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        page.addView(title, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView subtitle = new TextView(this);
        subtitle.setText("هر وقت خواستی می‌تونی نقش گوشی رو عوض کنی.");
        subtitle.setTextColor(Color.rgb(107, 126, 121));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(8), 0, dp(24));
        page.addView(subtitle, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button camera = roleButton("📷  این گوشی دوربین است", true);
        camera.setOnClickListener(v -> startMode(MODE_CAMERA, true));
        page.addView(camera, roleButtonParams());

        Button viewer = roleButton("👁  این گوشی برای مشاهده است", false);
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

        setContentView(page);
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
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        destroyWebView();
        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
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
        settings.setUserAgentString(settings.getUserAgentString() + " CamCamAndroid/1.1 " + (isCameraMode() ? "Camera" : "Viewer"));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        WebView.setWebContentsDebuggingEnabled(false);

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
        });
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if ("https".equalsIgnoreCase(scheme) && (APP_HOST.equalsIgnoreCase(host) || PAYMENT_HOST.equalsIgnoreCase(host))) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
        }
        return true;
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (!isCameraMode() || origin == null || !"https".equalsIgnoreCase(origin.getScheme()) || !APP_HOST.equalsIgnoreCase(origin.getHost())) {
            request.deny();
            return;
        }

        pendingPermissionRequest = request;
        List<String> missing = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.CAMERA);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.RECORD_AUDIO);
            }
        }

        if (missing.isEmpty()) {
            grantAllowedResources(request);
        } else {
            requestPermissions(missing.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
        }
    }

    private void grantAllowedResources(PermissionRequest request) {
        if (request == null || !isCameraMode()) return;
        List<String> allowed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            }
        }
        pendingPermissionRequest = null;
        if (allowed.isEmpty()) {
            request.deny();
        } else {
            request.grant(allowed.toArray(new String[0]));
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_REQUEST && pendingPermissionRequest != null) {
            grantAllowedResources(pendingPermissionRequest);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else if (currentMode != null) {
            showRoleChooser();
        } else {
            super.onBackPressed();
        }
    }

    private void destroyWebView() {
        if (pendingPermissionRequest != null) {
            pendingPermissionRequest.deny();
            pendingPermissionRequest = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
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
        super.onDestroy();
    }
}
