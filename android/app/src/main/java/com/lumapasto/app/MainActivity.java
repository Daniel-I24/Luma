package com.lumapasto.app;

import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    /** The native splash never waits longer than this for the web page. */
    private static final long MAX_NATIVE_SPLASH_MS = 1500;

    private volatile boolean pageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Native splash (theme AppTheme.NoActionBarLaunch). It stays until index.html
        // has loaded and painted the same mark (#luma-entry), which AppEntry continues.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        registerPlugin(LumaSettingsPlugin.class);
        long shownAt = SystemClock.uptimeMillis();
        splash.setKeepOnScreenCondition(
            () -> !pageLoaded && SystemClock.uptimeMillis() - shownAt < MAX_NATIVE_SPLASH_MS
        );
        super.onCreate(savedInstanceState);
        // Same background as the splash, so no white frame shows before the page paints.
        bridge.getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.luma_splash_background));
        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    pageLoaded = true;
                }
            }
        );
    }
}
