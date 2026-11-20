package com.aegis.wifisentinel;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;

/**
 * Adsterra Smartlinks (Direct Links) sin SDK. Se abren en el navegador con ACTION_VIEW.
 * Pool limpio por defecto; pool completo (+18) solo si el usuario lo activa.
 */
public final class AdNetworkManager {

    public static final String TAG = "AdsterraAds";
    public static final String PREFS = "ads_prefs";
    public static final String KEY_AGE_VERIFIED = "age_verified";
    public static final String KEY_ADULT = "is_adult_18_plus";
    private static final String KEY_INDEX_SAFE = "rot_idx_safe";
    private static final String KEY_INDEX_ALL = "rot_idx_all";
    private static final String KEY_ACTIONS = "main_action_count";
    public static final int ACTIONS_PER_AD = 2;

    public static final String[] SAFE_SMARTLINKS = {
        "https://asiafilm.org/4/ed7357907f05efc3d793c5aedbdf0c5b", // Smartlink_3 ID 31224747
        "https://asiafilm.org/4/b70dfeb9161b32fbda5a5d24daca1943", // Smartlink_2 ID 31224644
        "https://asiafilm.org/4/7f20a7584445d119b20cbbaa4fc4012c"  // Smartlink_5 ID 32351410
    };

    public static final String[] ALL_SMARTLINKS = {
        "https://asiafilm.org/4/ed7357907f05efc3d793c5aedbdf0c5b", // Smartlink_3 ID 31224747
        "https://asiafilm.org/4/b70dfeb9161b32fbda5a5d24daca1943", // Smartlink_2 ID 31224644
        "https://asiafilm.org/4/7f20a7584445d119b20cbbaa4fc4012c", // Smartlink_5 ID 32351410
        "https://auctionr.org/4/ceb82fb7e10796fc95547d9b50cfe003", // Smartlink_1 ID 31224274
        "https://auctionr.org/4/048d8aa6b801685694fdae38b9f9cb5b"  // Smartlink_4 ID 32351281
    };

    private AdNetworkManager() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isAgeVerified(Context ctx) {
        return prefs(ctx).getBoolean(KEY_AGE_VERIFIED, false);
    }

    public static boolean isAdultModeEnabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ADULT, false);
    }

    public static void setAgePreference(Context ctx, boolean adult) {
        prefs(ctx).edit()
            .putBoolean(KEY_AGE_VERIFIED, true)
            .putBoolean(KEY_ADULT, adult)
            .apply();
        Log.i(TAG, "Preferencia +18 guardada: " + adult);
    }

    private static boolean isSafeUrl(String url) {
        for (String s : SAFE_SMARTLINKS) {
            if (s.equals(url)) return true;
        }
        return false;
    }

    private static boolean isKnownUrl(String url) {
        for (String s : ALL_SMARTLINKS) {
            if (s.equals(url)) return true;
        }
        return false;
    }

    /** Siguiente enlace del pool activo con rotación circular persistente. */
    public static synchronized String nextSmartlink(Context ctx) {
        SharedPreferences p = prefs(ctx);
        boolean adult = p.getBoolean(KEY_ADULT, false); // releer siempre
        String[] pool = adult ? ALL_SMARTLINKS : SAFE_SMARTLINKS;
        String key = adult ? KEY_INDEX_ALL : KEY_INDEX_SAFE;
        int idx = p.getInt(key, 0);
        if (idx < 0 || idx >= pool.length) idx = 0;
        String url = pool[idx];
        p.edit().putInt(key, (idx + 1) % pool.length).apply();
        return url;
    }

    /**
     * Abre un Smartlink. Si url es vacío o no pertenece al pool permitido, se usa la rotación.
     * Con +18 desactivado nunca se abre un enlace auctionr.org.
     */
    public static synchronized boolean openSmartlink(Context ctx, String requestedUrl) {
        boolean adult = prefs(ctx).getBoolean(KEY_ADULT, false); // releer antes de cada apertura
        String url = requestedUrl;
        boolean allowed = url != null && isKnownUrl(url) && (adult || isSafeUrl(url));
        if (!allowed) {
            url = nextSmartlink(ctx);
        }
        if (!adult && !isSafeUrl(url)) {
            url = SAFE_SMARTLINKS[0];
        }
        int n = indexOf(url) + 1;
        Log.i(TAG, "Abriendo Smartlink (" + n + ", +18=" + adult + "): " + url);
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            ctx.startActivity(i);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "No se pudo abrir el Smartlink: " + e.getMessage());
            return false;
        }
    }

    /** Cuenta una acción principal y abre anuncio cada ACTIONS_PER_AD acciones. */
    public static synchronized boolean registerMainAction(Context ctx) {
        SharedPreferences p = prefs(ctx);
        int c = p.getInt(KEY_ACTIONS, 0) + 1;
        boolean fire = c >= ACTIONS_PER_AD;
        p.edit().putInt(KEY_ACTIONS, fire ? 0 : c).apply();
        Log.i(TAG, "Accion principal " + c + "/" + ACTIONS_PER_AD + (fire ? " -> anuncio" : ""));
        if (fire) {
            return openSmartlink(ctx, null);
        }
        return false;
    }

    private static int indexOf(String url) {
        for (int i = 0; i < ALL_SMARTLINKS.length; i++) {
            if (ALL_SMARTLINKS[i].equals(url)) return i;
        }
        return -1;
    }
}
