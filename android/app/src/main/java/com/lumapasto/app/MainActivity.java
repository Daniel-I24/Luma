package com.lumapasto.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Native splash (theme AppTheme.NoActionBarLaunch); it hands over to the web entry animation.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
