package com.lumapasto.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the system settings a phone without Google services has no dialog for. */
@CapacitorPlugin(name = "LumaSettings")
public class LumaSettingsPlugin extends Plugin {

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        open(call, new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Uri app = Uri.fromParts("package", getContext().getPackageName(), null);
        open(call, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app));
    }

    private void open(PluginCall call, Intent intent) {
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("settings_unavailable");
        }
    }
}
