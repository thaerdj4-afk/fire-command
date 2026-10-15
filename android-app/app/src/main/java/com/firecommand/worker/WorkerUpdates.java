package com.firecommand.worker;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Optional update prompt; never blocks worker login, alerts, or location sharing. */
final class WorkerUpdates {
  static final String ORIGIN = "https://fire-worker-download.thaerdj4.chatgpt.site";
  static final String MANIFEST = ORIGIN + "/updates.json";
  private WorkerUpdates() {}
  static void check(Activity activity) {
    new Thread(() -> {
      HttpsURLConnection connection = null;
      try {
        connection = (HttpsURLConnection) new URL(MANIFEST).openConnection();
        connection.setConnectTimeout(6000);
        connection.setReadTimeout(6000);
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        if (connection.getResponseCode() != 200) return;
        byte[] bytes;
        try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
          byte[] buffer = new byte[1024]; int count;
          while ((count = in.read(buffer)) != -1) {
            if (out.size() + count > 16384) return;
            out.write(buffer, 0, count);
          }
          bytes = out.toByteArray();
        }
        JSONObject data = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        String packageName = activity.getPackageName();
        android.content.pm.PackageInfo info = activity.getPackageManager().getPackageInfo(packageName, 0);
        long installed = android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        long offered = data.getLong("versionCode");
        if (!packageName.equals(data.getString("packageName")) || offered <= installed) return;
        // Open only our fixed download page. The manifest cannot supply arbitrary URLs.
        String version = data.optString("versionName", "");
        if (version.length() > 60) version = "";
        final String label = version;
        activity.runOnUiThread(() -> {
          if (activity.isFinishing() || activity.isDestroyed()) return;
          new AlertDialog.Builder(activity)
            .setTitle("קיים עדכון חדש")
            .setMessage("גרסה " + label + " זמינה להורדה. מתקינים מעל האפליקציה הקיימת, בלי למחוק אותה. ההתקנה דורשת אישור שלך.")
            .setPositiveButton("עדכון עכשיו", (dialog, which) -> {
              try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(ORIGIN + "/"))); }
              catch (Exception ignored) { /* No browser installed: worker remains usable. */ }
            })
            .setNegativeButton("מאוחר יותר", null).show();
        });
      } catch (Exception ignored) { /* Offline, missing or malformed manifest must not interrupt work. */ }
      finally { if (connection != null) connection.disconnect(); }
    }, "worker-update-check").start();
  }
}
