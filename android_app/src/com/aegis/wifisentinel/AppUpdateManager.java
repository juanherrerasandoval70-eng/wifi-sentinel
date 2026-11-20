package com.aegis.wifisentinel;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class AppUpdateManager {
    private static final String TAG = "AppUpdateManager";
    public static String UPDATE_CHECK_URL = "https://raw.githubusercontent.com/juanherrerasandoval70-eng/wifi-sentinel/main/version.json";
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static boolean isDownloading = false;

    public static void setUpdateCheckUrl(String url) {
        if (url != null && !url.trim().isEmpty()) {
            UPDATE_CHECK_URL = url.trim();
        }
    }

    public static void checkForUpdates(Context context, WebView webView, boolean isManual) {
        new Thread(new CheckUpdateRunnable(context, webView, isManual)).start();
    }

    public static void downloadAndInstall(Context context, WebView webView, String apkUrl, String versionName) {
        if (isDownloading) {
            Toast.makeText(context, "La descarga de la actualización ya está en curso...", Toast.LENGTH_SHORT).show();
            return;
        }
        isDownloading = true;
        Toast.makeText(context, "Descargando actualización v" + versionName + "...", Toast.LENGTH_SHORT).show();
        new Thread(new DownloadUpdateRunnable(context, webView, apkUrl, versionName)).start();
    }

    public static void installApkFile(Context context, File apkFile) {
        try {
            if (apkFile == null || !apkFile.exists()) {
                Toast.makeText(context, "Archivo de actualización no encontrado", Toast.LENGTH_SHORT).show();
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Toast.makeText(context, "Habilita 'Instalar apps desconocidas' para completar la actualización", Toast.LENGTH_LONG).show();
                    Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    permissionIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(permissionIntent);
                    return;
                }
            }

            Uri apkUri = Uri.parse("content://" + context.getPackageName() + ".update_provider/" + apkFile.getName());
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(installIntent);
        } catch (Exception e) {
            Log.e(TAG, "Install trigger failed: " + e.getMessage());
            Toast.makeText(context, "Error al lanzar instalador: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private static void dispatchJs(final WebView webView, final String script) {
        if (webView == null) return;
        MAIN_HANDLER.post(new EvaluateJsRunnable(webView, script));
    }

    private static class EvaluateJsRunnable implements Runnable {
        private final WebView webView;
        private final String script;

        public EvaluateJsRunnable(WebView webView, String script) {
            this.webView = webView;
            this.script = script;
        }

        @Override
        public void run() {
            try {
                webView.evaluateJavascript(script, null);
            } catch (Exception ignored) {}
        }
    }

    private static class CheckUpdateRunnable implements Runnable {
        private final Context context;
        private final WebView webView;
        private final boolean isManual;

        public CheckUpdateRunnable(Context context, WebView webView, boolean isManual) {
            this.context = context;
            this.webView = webView;
            this.isManual = isManual;
        }

        @Override
        public void run() {
            try {
                int currentVersionCode = 1;
                String currentVersionName = "1.0.0";
                try {
                    PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
                    currentVersionCode = pInfo.versionCode;
                    currentVersionName = pInfo.versionName;
                } catch (Exception ignored) {}

                URL url = new URL(UPDATE_CHECK_URL + "?t=" + System.currentTimeMillis());
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "WiFiSentinel-Updater/4.0");

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject json = new JSONObject(sb.toString());
                    int remoteCode = json.optInt("versionCode", 0);
                    String remoteName = json.optString("versionName", "");
                    String apkUrl = json.optString("apkUrl", "");
                    String changelog = json.optString("changelog", "Mejoras generales y optimizaciones de seguridad.");
                    boolean forceUpdate = json.optBoolean("forceUpdate", false);

                    if (remoteCode > currentVersionCode && !apkUrl.isEmpty()) {
                        JSONObject payload = new JSONObject();
                        payload.put("hasUpdate", true);
                        payload.put("currentVersion", currentVersionName);
                        payload.put("newVersion", remoteName);
                        payload.put("apkUrl", apkUrl);
                        payload.put("changelog", changelog);
                        payload.put("forceUpdate", forceUpdate);

                        dispatchJs(webView, "if(window.onUpdateAvailable) { window.onUpdateAvailable(" + payload.toString() + "); }");
                    } else {
                        if (isManual) {
                            JSONObject payload = new JSONObject();
                            payload.put("hasUpdate", false);
                            payload.put("currentVersion", currentVersionName);
                            dispatchJs(webView, "if(window.onUpdateCheckResult) { window.onUpdateCheckResult(" + payload.toString() + "); }");
                        }
                    }
                } else {
                    if (isManual) {
                        dispatchJs(webView, "if(window.onUpdateError) { window.onUpdateError('Servidor de actualizaciones no disponible (" + responseCode + ")'); }");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error checking updates: " + e.getMessage());
                if (isManual) {
                    dispatchJs(webView, "if(window.onUpdateError) { window.onUpdateError('Error de red al comprobar actualizaciones'); }");
                }
            }
        }
    }

    private static class DownloadUpdateRunnable implements Runnable {
        private final Context context;
        private final WebView webView;
        private final String apkUrl;
        private final String versionName;

        public DownloadUpdateRunnable(Context context, WebView webView, String apkUrl, String versionName) {
            this.context = context;
            this.webView = webView;
            this.apkUrl = apkUrl;
            this.versionName = versionName;
        }

        @Override
        public void run() {
            File targetApk = null;
            try {
                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 WiFiSentinel-Updater");
                conn.setInstanceFollowRedirects(true);

                int fileLength = conn.getContentLength();
                targetApk = new File(context.getCacheDir(), "wifisentinel_update_v" + versionName.replace(".", "_") + ".apk");
                if (targetApk.exists()) {
                    targetApk.delete();
                }

                InputStream input = conn.getInputStream();
                FileOutputStream output = new FileOutputStream(targetApk);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                int lastProgress = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    if (fileLength > 0) {
                        int progress = (int) (total * 100 / fileLength);
                        if (progress >= lastProgress + 5 || progress == 100) {
                            lastProgress = progress;
                            dispatchJs(webView, "if(window.onUpdateDownloadProgress) { window.onUpdateDownloadProgress(" + progress + "); }");
                        }
                    }
                }

                output.flush();
                output.close();
                input.close();

                isDownloading = false;
                MAIN_HANDLER.post(new TriggerInstallRunnable(context, targetApk));

            } catch (Exception e) {
                isDownloading = false;
                Log.e(TAG, "Download error: " + e.getMessage());
                dispatchJs(webView, "if(window.onUpdateDownloadError) { window.onUpdateDownloadError('" + e.getMessage() + "'); }");
            }
        }
    }

    private static class TriggerInstallRunnable implements Runnable {
        private final Context context;
        private final File apkFile;

        public TriggerInstallRunnable(Context context, File apkFile) {
            this.context = context;
            this.apkFile = apkFile;
        }

        @Override
        public void run() {
            installApkFile(context, apkFile);
        }
    }
}
