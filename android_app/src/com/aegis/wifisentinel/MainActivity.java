package com.aegis.wifisentinel;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.DhcpInfo;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.CookiePolicy;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private WebView webView;
    public static String pendingInjectMac = "";
    public static String pendingRouterUser = "admin";
    public static String pendingRouterPass = "admin";

    static {
        try {
            java.net.CookieManager cm = new java.net.CookieManager(null, CookiePolicy.ACCEPT_ALL);
            CookieHandler.setDefault(cm);
        } catch (Exception ignored) {}
    }

    public static int computeBoaChecksum(String str) {
        if (!str.endsWith("&")) {
            str = str + "&";
        }
        long csum = 0;
        int i = 0;
        int len = str.length();
        while (i < len) {
            if ((i + 4) > len) {
                if (i < len) csum += ((long) str.charAt(i) << 24);
                if ((i + 1) < len) csum += ((long) str.charAt(i + 1) << 16);
                if ((i + 2) < len) csum += ((long) str.charAt(i + 2) << 8);
                break;
            } else {
                csum += ((long) str.charAt(i) << 24)
                      + ((long) str.charAt(i + 1) << 16)
                      + ((long) str.charAt(i + 2) << 8)
                      + ((long) str.charAt(i + 3));
                i += 4;
            }
        }
        csum = (csum & 0xFFFFL) + (csum >> 16);
        csum = csum & 0xFFFFL;
        csum = (~csum) & 0xFFFFL;
        return (int) csum;
    }

    public static class SentinelWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url != null && url.contains("export-report")) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    view.getContext().startActivity(intent);
                    return true;
                } catch (Exception ignored) {}
            }
            view.loadUrl(url);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url != null && !url.startsWith("file:///android_asset")) {
                String cleanColonMac = (pendingInjectMac != null) ? pendingInjectMac.toLowerCase().replace("-", ":") : "";
                String js = "(function(){" +
                    "if(document.getElementById('sentinel-inject-bar'))return;" +
                    "var bar=document.createElement('div');" +
                    "bar.id='sentinel-inject-bar';" +
                    "bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999999;background:#09090b;color:#fff;padding:8px 10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;border-bottom:2px solid #22c55e;box-shadow:0 4px 16px rgba(0,0,0,0.6);';" +
                    "bar.innerHTML='<div style=\"display:flex;align-items:center;gap:6px;\">'+" +
                    "'<button id=\"sentinel-back-btn\" style=\"background:#22c55e;color:#000;border:none;padding:6px 10px;border-radius:6px;font-weight:800;font-size:11px;cursor:pointer;\">← Sentinel</button>'+" +
                    "'<span style=\"font-family:monospace;font-size:11px;background:#18181b;padding:4px 6px;border-radius:4px;border:1px solid #3f3f46;\">MAC: " + cleanColonMac + "</span>'+" +
                    "'</div>'+" +
                    "'<div style=\"display:flex;gap:4px;flex-wrap:wrap;align-items:center;\">'+" +
                    "'<button id=\"sentinel-autofill-btn\" style=\"background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;\">⚡ Auto-Pegar MAC</button>'+" +
                    "'<button onclick=\"window.location.href=\\'/secu_macfilter_src.asp\\'\" style=\"background:#27272a;color:#d4d4d8;border:1px solid #52525b;padding:4px 6px;border-radius:4px;font-size:10px;\">Boa/Fibra</button>'+" +
                    "'<button onclick=\"window.location.href=\\'/userRpm/WlanMacFilterRpm.htm\\'\" style=\"background:#27272a;color:#d4d4d8;border:1px solid #52525b;padding:4px 6px;border-radius:4px;font-size:10px;\">TP-Link</button>'+" +
                    "'<button onclick=\"window.location.href=\\'/main.html\\'\" style=\"background:#27272a;color:#d4d4d8;border:1px solid #52525b;padding:4px 6px;border-radius:4px;font-size:10px;\">Tenda</button>'+" +
                    "'<button onclick=\"window.location.href=\\'/html/bbsp/wlanmacfilter/wlanmacfilter.asp\\'\" style=\"background:#27272a;color:#d4d4d8;border:1px solid #52525b;padding:4px 6px;border-radius:4px;font-size:10px;\">Huawei</button>'+" +
                    "'<button onclick=\"window.location.href=\\'/getpage.gch?pid=1002&nextpage=net_wlan_macfilt_t.gch\\'\" style=\"background:#27272a;color:#d4d4d8;border:1px solid #52525b;padding:4px 6px;border-radius:4px;font-size:10px;\">ZTE</button>'+" +
                    "'</div>';" +
                    "document.body.appendChild(bar);" +
                    "document.body.style.paddingTop='54px';" +
                    "document.getElementById('sentinel-back-btn').onclick=function(){window.location.href='file:///android_asset/index.html';};" +
                    "var u=document.getElementById('userInput')||document.querySelector('input[name=\"username\"],input[name=\"user\"],input[id*=\"user\"]');" +
                    "var p=document.getElementById('psdInput')||document.querySelector('input[name=\"psd\"],input[name=\"password\"],input[type=\"password\"]');" +
                    "if(u&&!u.value){u.value='" + pendingRouterUser + "';}" +
                    "if(p&&!p.value){p.value='" + pendingRouterPass + "';}" +
                    "function autoCutMac(){" +
                    "  var targetMac='" + cleanColonMac + "';" +
                    "  if(window.location.pathname.indexOf('login.asp')!==-1&&document.cmlogin){document.cmlogin.submit();return;}" +
                    "  if(window.location.pathname.indexOf('secu_macfilter_src_add.asp')!==-1&&document.form){document.form.mac.value=targetMac;document.form.submit();return;}" +
                    "  if(window.location.pathname.indexOf('secu_macfilter_src.asp')!==-1){window.location.href='/secu_macfilter_src_add.asp';return;}" +
                    "  var inputs=document.querySelectorAll('input,textarea');var pasted=false;" +
                    "  for(var i=0;i<inputs.length;i++){" +
                    "    var inp=inputs[i];var n=(inp.name||'').toLowerCase();var id=(inp.id||'').toLowerCase();var ph=(inp.placeholder||'').toLowerCase();" +
                    "    if(n.indexOf('mac')!==-1||id.indexOf('mac')!==-1||ph.indexOf('mac')!==-1||n.indexOf('hw')!==-1){" +
                    "      inp.value=targetMac;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.style.border='2px solid #ef4444';pasted=true;" +
                    "    }" +
                    "  }" +
                    "  if(pasted){alert('¡MAC '+targetMac+' colocada en el formulario! Presiona Guardar / Aplicar en la pantalla.');}" +
                    "  else{navigator.clipboard.writeText(targetMac);alert('MAC '+targetMac+' copiada al portapapeles. Pégala en el campo de Filtro MAC de tu módem.');}" +
                    "}" +
                    "document.getElementById('sentinel-autofill-btn').onclick=autoCutMac;" +
                    "})();";
                view.evaluateJavascript(js, null);
            }
        }
    }

    public static class SentinelChromeClient extends WebChromeClient {
    }

    private static class ToastRunner implements Runnable {
        private final Activity act;
        private final String msg;

        public ToastRunner(Activity act, String msg) {
            this.act = act;
            this.msg = msg;
        }

        @Override
        public void run() {
            Toast.makeText(act, msg, Toast.LENGTH_SHORT).show();
        }
    }

    private static class LoadUrlRunner implements Runnable {
        private final WebView wv;
        private final String url;

        public LoadUrlRunner(WebView wv, String url) {
            this.wv = wv;
            this.url = url;
        }

        @Override
        public void run() {
            wv.loadUrl(url);
        }
    }

    private static class JsCallbackRunner implements Runnable {
        private final WebView wv;
        private final String reqId;
        private final String jsonPayload;

        public JsCallbackRunner(WebView wv, String reqId, String jsonPayload) {
            this.wv = wv;
            this.reqId = reqId;
            this.jsonPayload = jsonPayload;
        }

        @Override
        public void run() {
            try {
                String escaped = jsonPayload.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "").replace("\r", "");
                String script = "if(window.__onSentinelNativeResult){window.__onSentinelNativeResult('" + reqId + "','" + escaped + "');}";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    wv.evaluateJavascript(script, null);
                } else {
                    wv.loadUrl("javascript:" + script);
                }
            } catch (Exception ignored) {}
        }
    }

    private static class AsyncBgRunner implements Runnable {
        private final SentinelBridge bridge;
        private final String kind;
        private final String reqId;
        private final String arg1;
        private final String arg2;
        private final String arg3;
        private final String arg4;
        private final String arg5;

        public AsyncBgRunner(SentinelBridge bridge, String kind, String reqId, String arg1, String arg2, String arg3, String arg4, String arg5) {
            this.bridge = bridge;
            this.kind = kind;
            this.reqId = reqId;
            this.arg1 = arg1;
            this.arg2 = arg2;
            this.arg3 = arg3;
            this.arg4 = arg4;
            this.arg5 = arg5;
        }

        @Override
        public void run() {
            String res = "{}";
            try {
                if ("scan".equals(kind)) {
                    res = bridge.scanCurrentWifiNetworkNative();
                } else if ("ports".equals(kind)) {
                    res = bridge.scanPortsNative(arg1);
                } else if ("ping".equals(kind)) {
                    double ms = bridge.pingHostNative(arg1);
                    res = String.valueOf(ms);
                } else if ("router_inject".equals(kind)) {
                    res = bridge.injectRouterMacBlockNative(arg1, arg2, arg3, arg4, arg5);
                } else if ("router_verify".equals(kind)) {
                    res = bridge.verifyRouterAdminCredentials(arg1, arg2, arg3);
                } else if ("router_open".equals(kind)) {
                    bridge.openRouterConsoleSync(arg1, arg2, arg3, arg4);
                    return;
                }
            } catch (Exception ignored) {}
            bridge.deliverAsyncResult(reqId, res);
        }
    }

    private static class ThemeRunner implements Runnable {
        private final Activity act;
        private final boolean isDark;

        public ThemeRunner(Activity act, boolean isDark) {
            this.act = act;
            this.isDark = isDark;
        }

        @Override
        public void run() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    Window window = act.getWindow();
                    int bgColor = isDark ? 0xFF09090B : 0xFFFFFFFF;
                    window.setStatusBarColor(bgColor);
                    window.setNavigationBarColor(bgColor);
                    View decor = window.getDecorView();
                    int flags = decor.getSystemUiVisibility();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        if (isDark) {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        } else {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        if (isDark) {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        } else {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    }
                    decor.setSystemUiVisibility(flags);
                }
            } catch (Exception ignored) {}
        }
    }

    public static class HostProbeTask implements Callable<String> {
        private final String ip;
        private final String phoneIp;
        private final String gatewayIp;
        private final String gatewayBssid;
        private final String phoneMac;
        private final Map<String, String> arpMap;
        private final Map<String, String> routerNames;
        private final Set<String> routerBlockedMacs;

        public HostProbeTask(String ip, String phoneIp, String gatewayIp, String gatewayBssid, String phoneMac,
                             Map<String, String> arpMap, Map<String, String> routerNames, Set<String> routerBlockedMacs) {
            this.ip = ip;
            this.phoneIp = phoneIp;
            this.gatewayIp = gatewayIp;
            this.gatewayBssid = gatewayBssid;
            this.phoneMac = phoneMac;
            this.arpMap = arpMap;
            this.routerNames = routerNames;
            this.routerBlockedMacs = routerBlockedMacs;
        }

        public static String queryDnsPtr(String targetIp, String dnsServer, int port, int timeoutMs) {
            if (targetIp == null || dnsServer == null || !targetIp.contains(".")) return null;
            DatagramSocket sock = null;
            try {
                String[] octs = targetIp.split("\\.");
                if (octs.length != 4) return null;
                String qname = octs[3] + "." + octs[2] + "." + octs[1] + "." + octs[0] + ".in-addr.arpa";
                String[] labels = qname.split("\\.");

                byte[] pktBuf = new byte[128];
                int pos = 0;
                pktBuf[pos++] = 0x12;
                pktBuf[pos++] = 0x34;
                pktBuf[pos++] = 0x01;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x01; // QDCOUNT = 1
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;

                for (int i = 0; i < labels.length; i++) {
                    byte[] lb = labels[i].getBytes("ASCII");
                    pktBuf[pos++] = (byte) lb.length;
                    System.arraycopy(lb, 0, pktBuf, pos, lb.length);
                    pos += lb.length;
                }
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x0c; // TYPE PTR (12)
                pktBuf[pos++] = 0x00;
                pktBuf[pos++] = 0x01; // CLASS IN (1)

                sock = new DatagramSocket();
                sock.setSoTimeout(timeoutMs);
                DatagramPacket queryPkt = new DatagramPacket(pktBuf, pos, InetAddress.getByName(dnsServer), port);
                sock.send(queryPkt);

                byte[] respBuf = new byte[512];
                DatagramPacket respPkt = new DatagramPacket(respBuf, respBuf.length);
                sock.receive(respPkt);

                int len = respPkt.getLength();
                if (len < 16) return null;
                int ancount = ((respBuf[6] & 0xFF) << 8) | (respBuf[7] & 0xFF);
                if (ancount <= 0) return null;

                int idx = 12;
                while (idx < len && respBuf[idx] != 0) {
                    if ((respBuf[idx] & 0xC0) == 0xC0) {
                        idx += 2;
                        break;
                    }
                    idx += (respBuf[idx] & 0xFF) + 1;
                }
                if (idx < len && respBuf[idx] == 0) idx++;
                idx += 4; // QTYPE + QCLASS

                for (int a = 0; a < ancount && idx + 10 < len; a++) {
                    if ((respBuf[idx] & 0xC0) == 0xC0) {
                        idx += 2;
                    } else {
                        while (idx < len && respBuf[idx] != 0) {
                            idx += (respBuf[idx] & 0xFF) + 1;
                        }
                        idx++;
                    }
                    if (idx + 10 > len) break;
                    int rtype = ((respBuf[idx] & 0xFF) << 8) | (respBuf[idx + 1] & 0xFF);
                    int rdlen = ((respBuf[idx + 8] & 0xFF) << 8) | (respBuf[idx + 9] & 0xFF);
                    idx += 10;
                    if (rtype == 12 && idx + rdlen <= len) {
                        StringBuilder nameSb = new StringBuilder();
                        int p = idx;
                        int hops = 0;
                        while (p < len && respBuf[p] != 0 && hops < 10) {
                            int b = respBuf[p] & 0xFF;
                            if ((b & 0xC0) == 0xC0) {
                                if (p + 1 >= len) break;
                                p = ((b & 0x3F) << 8) | (respBuf[p + 1] & 0xFF);
                                hops++;
                                continue;
                            }
                            p++;
                            if (p + b > len) break;
                            if (nameSb.length() > 0) nameSb.append(".");
                            nameSb.append(new String(respBuf, p, b, "UTF-8"));
                            p += b;
                        }
                        String full = nameSb.toString()
                                .replace(".domain.name", "")
                                .replace(".local", "")
                                .replace(".lan", "")
                                .replace(".home", "")
                                .trim();
                        if (!full.isEmpty() && !full.equals(targetIp)) {
                            return full;
                        }
                    }
                    idx += rdlen;
                }
            } catch (Exception ignored) {
            } finally {
                if (sock != null) sock.close();
            }
            return null;
        }

        private static String queryNetbios(String targetIp) {
            DatagramSocket sock = null;
            try {
                byte[] query = new byte[]{
                    (byte)0x82, (byte)0x28, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x20, 0x43, 0x4b, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
                    0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
                    0x41, 0x41, 0x41, 0x41, 0x41, 0x00, 0x00, 0x21, 0x00, 0x01
                };
                sock = new DatagramSocket();
                sock.setSoTimeout(160);
                DatagramPacket pkt = new DatagramPacket(query, query.length, InetAddress.getByName(targetIp), 137);
                sock.send(pkt);
                byte[] buf = new byte[512];
                DatagramPacket resp = new DatagramPacket(buf, buf.length);
                sock.receive(resp);
                if (resp.getLength() > 57) {
                    int count = buf[56] & 0xFF;
                    if (count > 0) {
                        String name = new String(buf, 57, 15, "ASCII").trim();
                        if (!name.isEmpty()) return name;
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (sock != null) sock.close();
            }
            return null;
        }

        @Override
        public String call() {
            boolean isGateway = ip.equals(gatewayIp);
            boolean isSelf = ip.equals(phoneIp);
            boolean inArpOrRouter = arpMap.containsKey(ip);
            boolean alive = isGateway || isSelf || inArpOrRouter;
            double latencyMs = isSelf ? 0.8 : (isGateway ? 1.4 : 12.5);
            boolean measuredLatency = isSelf;
            List<Integer> openPorts = new ArrayList<Integer>();

            // Fase 1: Sonda rápida en puertos comunes (80, 62078, 445, 443)
            int[] discoveryPorts = new int[]{80, 62078, 445, 443};
            for (int i = 0; i < discoveryPorts.length; i++) {
                int p = discoveryPorts[i];
                Socket s = null;
                long tp = System.nanoTime();
                try {
                    s = new Socket();
                    s.connect(new InetSocketAddress(ip, p), 70);
                    double elapsed = (System.nanoTime() - tp) / 1000000.0;
                    if (!measuredLatency || elapsed < latencyMs) {
                        latencyMs = Math.max(0.4, Math.round(elapsed * 10.0) / 10.0);
                        measuredLatency = true;
                    }
                    alive = true;
                    openPorts.add(Integer.valueOf(p));
                } catch (Exception e) {
                    double elapsed = (System.nanoTime() - tp) / 1000000.0;
                    String msg = e.getMessage();
                    if (msg != null && (msg.contains("ECONNREFUSED") || msg.contains("refused"))) {
                        alive = true;
                        if (!measuredLatency || elapsed < latencyMs) {
                            latencyMs = Math.max(0.5, Math.min(60.0, Math.round(elapsed * 10.0) / 10.0));
                            measuredLatency = true;
                        }
                    }
                } finally {
                    if (s != null) {
                        try { s.close(); } catch (Exception ignored) {}
                    }
                }
            }

            if (!alive) {
                try {
                    long t1 = System.nanoTime();
                    InetAddress addr = InetAddress.getByName(ip);
                    if (addr.isReachable(75)) {
                        alive = true;
                        latencyMs = Math.max(0.6, Math.round(((System.nanoTime() - t1) / 1000000.0) * 10.0) / 10.0);
                        measuredLatency = true;
                    }
                } catch (Exception ignored) {}
            }

            if (!alive) return null;

            // Fase 2: Para equipos vivos, verificar puertos de servicio adicionales
            int[] extraPorts = new int[]{53, 22, 554, 8000, 8008, 8080};
            for (int i = 0; i < extraPorts.length; i++) {
                int p = extraPorts[i];
                if (openPorts.contains(Integer.valueOf(p))) continue;
                Socket s = null;
                try {
                    s = new Socket();
                    s.connect(new InetSocketAddress(ip, p), 60);
                    openPorts.add(Integer.valueOf(p));
                } catch (Exception ignored) {
                } finally {
                    if (s != null) {
                        try { s.close(); } catch (Exception ignored) {}
                    }
                }
            }

            // Resolver MAC real (priorizando tabla DHCP/ARP del router + kernel ARP)
            String mac = arpMap.get(ip);
            if (isGateway && (mac == null || mac.isEmpty()) && gatewayBssid != null && !gatewayBssid.isEmpty() && !"00:00:00:00:00:00".equals(gatewayBssid)) {
                mac = gatewayBssid.toLowerCase();
            } else if (isSelf && (mac == null || mac.isEmpty()) && phoneMac != null && !phoneMac.isEmpty()) {
                mac = phoneMac.toLowerCase();
            }
            if (mac == null || mac.isEmpty() || "00:00:00:00:00:00".equals(mac)) {
                String dynamicMac = SentinelBridge.getNeighMacForIp(ip);
                if (dynamicMac != null && !dynamicMac.isEmpty()) {
                    mac = dynamicMac;
                } else {
                    mac = "00:00:00:00:00:00";
                }
            }
            mac = mac.toLowerCase().replace("-", ":");
            boolean isRand = false;
            String cleanMac = mac.replace(":", "").replace("-", "").toLowerCase();
            if (cleanMac.length() == 12) {
                char c = cleanMac.charAt(1);
                if (c == '2' || c == '6' || c == 'a' || c == 'e') {
                    isRand = true;
                }
            }

            // Resolver Nombre Real del Celular / Equipo (1. DNS PTR directo al Router UDP 53, 2. mDNS UDP 5353, 3. NetBIOS UDP 137, 4. Nombre DHCP del Router)
            String hostname = "Desconocido";
            if (isGateway) {
                hostname = "Router Principal";
            } else if (isSelf) {
                String ptrSelf = queryDnsPtr(ip, gatewayIp, 53, 180);
                if (ptrSelf != null && !ptrSelf.isEmpty()) {
                    hostname = ptrSelf + " (Este Teléfono)";
                } else {
                    hostname = Build.MANUFACTURER + " " + Build.MODEL + " (Este Teléfono)";
                }
            } else {
                String ptrName = queryDnsPtr(ip, gatewayIp, 53, 220);
                if (ptrName != null && !ptrName.isEmpty() && !"Computer".equalsIgnoreCase(ptrName)) {
                    hostname = ptrName;
                }
                if ("Desconocido".equals(hostname)) {
                    String mdnsName = queryDnsPtr(ip, ip, 5353, 180);
                    if (mdnsName != null && !mdnsName.isEmpty()) {
                        hostname = mdnsName;
                    }
                }
                if ("Desconocido".equals(hostname)) {
                    String nb = queryNetbios(ip);
                    if (nb != null && !nb.isEmpty()) {
                        hostname = nb;
                    }
                }
                if ("Desconocido".equals(hostname) && routerNames != null && routerNames.containsKey(ip)) {
                    String rName = routerNames.get(ip);
                    if (rName != null && !rName.isEmpty() && !"Computer".equalsIgnoreCase(rName)) {
                        hostname = rName;
                    }
                }
                String lastOctet = ip.substring(ip.lastIndexOf('.') + 1);

                if ("Desconocido".equals(hostname)) {
                    String recognizedVendor = resolveVendorFromMac(mac, openPorts);
                    if (!recognizedVendor.isEmpty()) {
                        hostname = recognizedVendor + " (." + lastOctet + ")";
                    } else if (isRand) {
                        if (openPorts.contains(Integer.valueOf(62078))) {
                            hostname = "Apple iPhone (MAC Privada ." + lastOctet + ")";
                        } else if (openPorts.contains(Integer.valueOf(445)) || openPorts.contains(Integer.valueOf(3389))) {
                            hostname = "Ordenador PC (MAC Privada ." + lastOctet + ")";
                        } else if (openPorts.contains(Integer.valueOf(554)) || openPorts.contains(Integer.valueOf(8000))) {
                            hostname = "Cámara IP (MAC Privada ." + lastOctet + ")";
                        } else {
                            hostname = "Celular Android (MAC Privada ." + lastOctet + ")";
                        }
                    } else {
                        hostname = "Dispositivo WiFi (." + lastOctet + ")";
                    }
                }
            }

            String hLow = hostname.toLowerCase();
            String devType = "mobile";
            if (isGateway) devType = "router";
            else if (openPorts.contains(Integer.valueOf(445)) || hLow.contains("-pc") || hLow.contains("desktop") || hLow.contains("laptop") || mac.startsWith("fc:aa:14")) devType = "pc";
            else if (openPorts.contains(Integer.valueOf(554)) || hLow.contains("sr120") || hLow.contains("cam") || hLow.contains("tv")) devType = "iot";

            boolean isBlockedRouter = (routerBlockedMacs != null && routerBlockedMacs.contains(mac));

            StringBuilder portsJson = new StringBuilder("[");
            for (int i = 0; i < openPorts.size(); i++) {
                if (i > 0) portsJson.append(",");
                portsJson.append(openPorts.get(i));
            }
            portsJson.append("]");

            String safeHost = hostname.replace("\"", "");
            return "{\"ip\":\"" + ip + "\",\"mac\":\"" + mac + "\",\"hostname\":\"" + safeHost +
                   "\",\"dev_type\":\"" + devType + "\",\"latency_ms\":" + Math.max(0.4, latencyMs) +
                   ",\"is_gateway\":" + isGateway + ",\"is_local_host\":" + isSelf +
                   ",\"is_blocked\":" + isBlockedRouter +
                   ",\"is_randomized_mac\":" + isRand +
                   ",\"open_ports\":" + portsJson.toString() + "}";
        }

        private static String resolveVendorFromMac(String mac, List<Integer> openPorts) {
            if (mac == null || mac.length() < 8) return "";
            String m = mac.toLowerCase().replace("-", ":");
            if (m.startsWith("d4:58:00") || m.startsWith("b6:c7:1b") || m.startsWith("80:f7:a6") || m.startsWith("e4:b0:21") ||
                m.startsWith("50:01:d9") || m.startsWith("00:07:ab") || m.startsWith("00:12:47") || m.startsWith("18:3a:2d") ||
                m.startsWith("24:4b:03") || m.startsWith("34:c0:59") || m.startsWith("44:78:3e") || m.startsWith("5c:e8:eb") ||
                m.startsWith("94:35:0a") || m.startsWith("a8:06:00")) {
                return "Samsung Galaxy";
            }
            if (m.startsWith("00:03:93") || m.startsWith("00:05:02") || m.startsWith("00:0a:27") || m.startsWith("00:0a:95") ||
                m.startsWith("00:1c:b3") || m.startsWith("f0:18:98") || m.startsWith("b8:78:2e") || m.startsWith("38:f9:d3") ||
                m.startsWith("70:ec:e4") || m.startsWith("a4:83:e7") || m.startsWith("bc:d1:1f") || m.startsWith("dc:a9:04") ||
                openPorts.contains(Integer.valueOf(62078))) {
                return "Apple iPhone";
            }
            if (m.startsWith("28:7b:11") || m.startsWith("34:ce:00") || m.startsWith("64:90:c1") || m.startsWith("74:a7:ea") ||
                m.startsWith("80:64:9a") || m.startsWith("18:f0:e4") || m.startsWith("50:64:2b") || m.startsWith("68:54:5a") ||
                m.startsWith("78:11:dc") || m.startsWith("98:2c:bc") || m.startsWith("a4:cf:99") || m.startsWith("c4:0b:cb")) {
                return "Xiaomi Redmi";
            }
            if (m.startsWith("36:a3:bd") || m.startsWith("00:0c:e7") || m.startsWith("dc:02:8e") || m.startsWith("98:f5:37") ||
                m.startsWith("74:b5:7e") || m.startsWith("c8:7b:5b")) {
                return "ZTE Blade";
            }
            if (m.startsWith("00:0c:e5") || m.startsWith("00:14:9a") || m.startsWith("40:88:05") || m.startsWith("e4:90:7e") ||
                m.startsWith("00:23:68") || m.startsWith("04:4b:ed")) {
                return "Motorola Moto";
            }
            if (m.startsWith("00:18:82") || m.startsWith("00:1e:10") || m.startsWith("00:25:9e") || m.startsWith("00:e0:fc") ||
                m.startsWith("04:25:c5") || m.startsWith("10:51:72") || m.startsWith("40:4d:8e") || m.startsWith("68:a0:3e")) {
                return "Huawei Mobile";
            }
            if (m.startsWith("fc:aa:14") || m.startsWith("00:15:5d") || m.startsWith("00:50:56") || m.startsWith("a4:4c:c8") ||
                m.startsWith("b4:2e:99") || m.startsWith("00:1a:a0") || m.startsWith("18:66:da") || m.startsWith("34:17:eb") ||
                openPorts.contains(Integer.valueOf(445)) || openPorts.contains(Integer.valueOf(3389))) {
                return "Ordenador PC";
            }
            if (m.startsWith("10:52:1c") || m.startsWith("24:0a:c4") || m.startsWith("30:ae:a4") || m.startsWith("84:0d:8e") ||
                m.startsWith("00:1f:6b") || m.startsWith("00:26:e2") || m.startsWith("00:01:4a") || m.startsWith("cc:6e:a4") ||
                openPorts.contains(Integer.valueOf(554)) || openPorts.contains(Integer.valueOf(8000))) {
                return "Dispositivo Smart IoT";
            }
            return "";
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        setContentView(R.layout.activity_main);
        new ThemeRunner(this, false).run();

        CookieManager.getInstance().setAcceptCookie(true);
        webView = (WebView) findViewById(R.id.webview);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.setHorizontalScrollBarEnabled(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new SentinelWebViewClient());
        webView.setWebChromeClient(new SentinelChromeClient());
        webView.addJavascriptInterface(new SentinelBridge(this, webView), "SentinelNative");

        webView.loadUrl("file:///android_asset/index.html");

        // Comprobación de actualizaciones en segundo plano desde GitHub
        AppUpdateManager.checkForUpdates(this, webView, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> perms = new ArrayList<String>();
            if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                perms.add(android.Manifest.permission.ACCESS_FINE_LOCATION);
            }
            if (checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                perms.add(android.Manifest.permission.ACCESS_COARSE_LOCATION);
            }
            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.NEARBY_WIFI_DEVICES") != PackageManager.PERMISSION_GRANTED) {
                    perms.add("android.permission.NEARBY_WIFI_DEVICES");
                }
            }
            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), 1001);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001 && webView != null) {
            webView.evaluateJavascript("if (typeof refreshNativeWifiTelemetry === 'function') refreshNativeWifiTelemetry();", null);
        }
    }

    public static class SentinelBridge {
        private final Activity activity;
        private final WebView webView;

        public SentinelBridge(Activity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        // ===== Adsterra Smartlinks =====
        @JavascriptInterface
        public boolean openSponsorOffer(String url) {
            return AdNetworkManager.openSmartlink(activity, url);
        }

        @JavascriptInterface
        public boolean registerMainAction() {
            return AdNetworkManager.registerMainAction(activity);
        }

        @JavascriptInterface
        public boolean isAgeVerified() {
            return AdNetworkManager.isAgeVerified(activity);
        }

        @JavascriptInterface
        public boolean isAdultModeEnabled() {
            return AdNetworkManager.isAdultModeEnabled(activity);
        }

        @JavascriptInterface
        public void setAgePreference(boolean adult) {
            AdNetworkManager.setAgePreference(activity, adult);
        }

        // ===== Sistema de Actualizaciones OTA vía GitHub =====
        @JavascriptInterface
        public void checkForUpdates(boolean manual) {
            AppUpdateManager.checkForUpdates(activity, webView, manual);
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(String apkUrl, String versionName) {
            AppUpdateManager.downloadAndInstall(activity, webView, apkUrl, versionName);
        }

        @JavascriptInterface
        public String getAppVersionInfo() {
            try {
                android.content.pm.PackageInfo pInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                return "{\"versionCode\":" + pInfo.versionCode + ",\"versionName\":\"" + pInfo.versionName + "\"}";
            } catch (Exception e) {
                return "{\"versionCode\":4,\"versionName\":\"4.0.0\"}";
            }
        }

        private static String intToIp(int ip) {
            return (ip & 0xFF) + "." +
                   ((ip >> 8) & 0xFF) + "." +
                   ((ip >> 16) & 0xFF) + "." +
                   ((ip >> 24) & 0xFF);
        }

        private static String detectActiveIpv4() {
            try {
                Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
                while (interfaces.hasMoreElements()) {
                    NetworkInterface nif = interfaces.nextElement();
                    if (!nif.isUp() || nif.isLoopback()) continue;
                    String name = nif.getName().toLowerCase();
                    if (name.contains("wlan") || name.contains("eth") || name.contains("ap")) {
                        Enumeration<InetAddress> addrs = nif.getInetAddresses();
                        while (addrs.hasMoreElements()) {
                            InetAddress addr = addrs.nextElement();
                            if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                                return addr.getHostAddress();
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
            return null;
        }

        public static String detectActiveMac() {
            try {
                Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
                while (interfaces.hasMoreElements()) {
                    NetworkInterface nif = interfaces.nextElement();
                    if (!nif.isUp() || nif.isLoopback()) continue;
                    String name = nif.getName().toLowerCase();
                    if (name.contains("wlan") || name.contains("eth") || name.contains("ap")) {
                        byte[] macBytes = nif.getHardwareAddress();
                        if (macBytes != null && macBytes.length == 6) {
                            StringBuilder sb = new StringBuilder();
                            for (int i = 0; i < macBytes.length; i++) {
                                if (i > 0) sb.append(":");
                                sb.append(String.format("%02x", macBytes[i]));
                            }
                            String m = sb.toString().toLowerCase();
                            if (!"00:00:00:00:00:00".equals(m) && !"02:00:00:00:00:00".equals(m)) {
                                return m;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
            return null;
        }

        @JavascriptInterface
        public void setRouterCredentials(String user, String pass) {
            if (user != null && !user.trim().isEmpty()) {
                pendingRouterUser = user.trim();
            }
            if (pass != null && !pass.isEmpty()) {
                pendingRouterPass = pass;
            }
        }

        private static String fetchRouterNetworkState(String gatewayIp, Map<String, String> macMap, Map<String, String> nameMap, Set<String> blockedMacs) {
            String detectedRouterMac = null;
            if (gatewayIp == null || gatewayIp.isEmpty() || "0.0.0.0".equals(gatewayIp)) return null;
            try {
                String u = (pendingRouterUser != null && !pendingRouterUser.isEmpty()) ? pendingRouterUser : "admin";
                String p = (pendingRouterPass != null && !pendingRouterPass.isEmpty()) ? pendingRouterPass : "admin";

                // 1. Intentar leer status_ethernet_info.asp directamente (o iniciar sesión si devuelve página de login)
                String ethHtml = fetchHttpText("http://" + gatewayIp + "/status_ethernet_info.asp");
                boolean loggedInNow = false;
                if (ethHtml == null || !ethHtml.contains("clts.push")) {
                    String loginBody = "challenge=&username=" + URLEncoder.encode(u, "UTF-8") +
                                       "&psd=" + URLEncoder.encode(p, "UTF-8") +
                                       "&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag=";
                    postRawForm("http://" + gatewayIp + "/boaform/admin/formLogin", loginBody, "http://" + gatewayIp + "/admin/login.asp");
                    loggedInNow = true;
                    ethHtml = fetchHttpText("http://" + gatewayIp + "/status_ethernet_info.asp");
                }

                if (ethHtml != null && !ethHtml.isEmpty()) {
                    // Parsear clts.push(new it_nr("0", new it("devname", "..."), new it("macAddr", "..."), new it("ipAddr", "...")))
                    Pattern cltPat = Pattern.compile("it\\(\"devname\",\\s*\"([^\"]*)\"\\).*?it\\(\"macAddr\",\\s*\"([0-9a-fA-F:-]{17})\"\\).*?it\\(\"ipAddr\",\\s*\"(\\d+\\.\\d+\\.\\d+\\.\\d+)\"\\)");
                    Matcher m = cltPat.matcher(ethHtml);
                    while (m.find()) {
                        String dname = m.group(1).trim();
                        String mac = m.group(2).toLowerCase().replace("-", ":");
                        String ip = m.group(3).trim();
                        if (mac.length() == 17 && !"00:00:00:00:00:00".equals(mac)) {
                            macMap.put(ip, mac);
                        }
                        if (!dname.isEmpty() && !"Computer".equalsIgnoreCase(dname)) {
                            nameMap.put(ip, dname);
                        }
                    }
                }

                // 2. Leer lista negra real activa en el router (secu_macfilter_src.asp)
                String filterHtml = fetchHttpText("http://" + gatewayIp + "/secu_macfilter_src.asp");
                if (filterHtml != null && filterHtml.contains("cgi.macFilterEnble = true")) {
                    Pattern macRulePat = Pattern.compile("it\\(\"mac\",\\s*\"([0-9a-fA-F:-]{17})\"\\)");
                    Matcher rm = macRulePat.matcher(filterHtml);
                    while (rm.find()) {
                        String bMac = rm.group(1).toLowerCase().replace("-", ":");
                        if (!bMac.startsWith("02:5a:2d:a1:")) {
                            blockedMacs.add(bMac);
                        }
                    }
                }

                // 3. Obtener MAC real del propio router desde status_device_basic_info.asp si aún no se conoce
                String basicHtml = fetchHttpText("http://" + gatewayIp + "/status_device_basic_info.asp");
                if (basicHtml != null && !basicHtml.isEmpty()) {
                    Pattern ponPat = Pattern.compile("PON MAC</td>\\s*<td>([0-9a-fA-F]{12})</td>", Pattern.CASE_INSENSITIVE);
                    Matcher pm = ponPat.matcher(basicHtml);
                    if (pm.find()) {
                        String rawHex = pm.group(1).toLowerCase();
                        detectedRouterMac = rawHex.substring(0, 2) + ":" + rawHex.substring(2, 4) + ":" +
                                            rawHex.substring(4, 6) + ":" + rawHex.substring(6, 8) + ":" +
                                            rawHex.substring(8, 10) + ":" + rawHex.substring(10, 12);
                    }
                }

                if (loggedInNow) {
                    postRawForm("http://" + gatewayIp + "/boaform/admin/formLogout", "save=Logout&submit-url=%2Fadmin%2Flogin.asp", "http://" + gatewayIp + "/");
                }
            } catch (Exception ignored) {}
            return detectedRouterMac;
        }

        public static String getNeighMacForIp(String targetIp) {
            if (targetIp == null || targetIp.isEmpty()) return null;
            try {
                Process p = Runtime.getRuntime().exec("ip neigh show " + targetIp);
                BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()));
                String line;
                while ((line = r.readLine()) != null) {
                    String[] parts = line.trim().split("\\s+");
                    for (int i = 0; i < parts.length - 1; i++) {
                        if ("lladdr".equals(parts[i])) {
                            String m = parts[i + 1].toLowerCase();
                            if (m.length() == 17 && !"00:00:00:00:00:00".equals(m)) {
                                r.close();
                                return m;
                            }
                        }
                    }
                }
                r.close();
            } catch (Exception ignored) {}
            return null;
        }

        private static Map<String, String> readKernelArpTable() {
            Map<String, String> map = new HashMap<String, String>();
            BufferedReader br = null;
            try {
                br = new BufferedReader(new FileReader("/proc/net/arp"));
                String line;
                while ((line = br.readLine()) != null) {
                    String[] parts = line.trim().split("\\s+");
                    if (parts.length >= 4 && parts[0].matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                        String mac = parts[3].toLowerCase();
                        if (mac.length() == 17 && !"00:00:00:00:00:00".equals(mac)) {
                            map.put(parts[0], mac);
                        }
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (br != null) {
                    try { br.close(); } catch (Exception ignored) {}
                }
            }
            try {
                Process p = Runtime.getRuntime().exec("ip neigh show");
                BufferedReader nr = new BufferedReader(new InputStreamReader(p.getInputStream()));
                String line;
                while ((line = nr.readLine()) != null) {
                    String[] parts = line.trim().split("\\s+");
                    if (parts.length >= 5 && parts[0].matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                        for (int i = 1; i < parts.length - 1; i++) {
                            if ("lladdr".equals(parts[i])) {
                                String mac = parts[i + 1].toLowerCase();
                                if (mac.length() == 17) {
                                    map.put(parts[0], mac);
                                }
                            }
                        }
                    }
                }
                nr.close();
            } catch (Exception ignored) {}
            return map;
        }

        private static boolean postRawForm(String urlStr, String rawBody, String referer) {
            HttpURLConnection conn = null;
            try {
                byte[] bytes = rawBody.getBytes("UTF-8");
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(2200);
                conn.setReadTimeout(2200);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                if (referer != null) {
                    conn.setRequestProperty("Referer", referer);
                }
                OutputStream os = conn.getOutputStream();
                os.write(bytes);
                os.flush();
                os.close();
                int code = conn.getResponseCode();
                return (code >= 200 && code < 400);
            } catch (Exception ignored) {
                return false;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }

        private static String fetchHttpText(String urlStr) {
            HttpURLConnection conn = null;
            BufferedReader br = null;
            try {
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(2200);
                conn.setReadTimeout(2200);
                br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                return sb.toString();
            } catch (Exception ignored) {
                return "";
            } finally {
                if (br != null) {
                    try { br.close(); } catch (Exception ignored) {}
                }
                if (conn != null) conn.disconnect();
            }
        }

        public static String detectRouterBrand(String gatewayIp) {
            if (gatewayIp == null || gatewayIp.isEmpty()) return "universal";
            HttpURLConnection conn = null;
            try {
                URL url = new URL("http://" + gatewayIp + "/");
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(1800);
                conn.setReadTimeout(1800);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestMethod("GET");
                String server = conn.getHeaderField("Server");
                String auth = conn.getHeaderField("WWW-Authenticate");
                int code = conn.getResponseCode();

                BufferedReader br = null;
                StringBuilder sb = new StringBuilder();
                try {
                    InputStream is = (code >= 400) ? conn.getErrorStream() : conn.getInputStream();
                    if (is != null) {
                        br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                        String l;
                        int c = 0;
                        while ((l = br.readLine()) != null && c < 50) {
                            sb.append(l).append("\n");
                            c++;
                        }
                    }
                } catch (Exception ignored) {
                } finally {
                    if (br != null) {
                        try { br.close(); } catch (Exception ignored) {}
                    }
                }

                String sLow = (server != null) ? server.toLowerCase() : "";
                String bLow = sb.toString().toLowerCase();
                String aLow = (auth != null) ? auth.toLowerCase() : "";

                if (sLow.contains("boa") || bLow.contains("realtek") || bLow.contains("boaform") || bLow.contains("secu_macfilter")) {
                    return "realtek_boa";
                }
                if (sLow.contains("tp-link") || bLow.contains("tp-link") || bLow.contains("tplinkwifi") || bLow.contains("wlanmacfilter") || aLow.contains("tp-link")) {
                    return "tplink";
                }
                if (sLow.contains("tenda") || bLow.contains("tenda") || bLow.contains("tendawifi") || bLow.contains("goform")) {
                    return "tenda";
                }
                if (sLow.contains("huawei") || bLow.contains("huawei") || bLow.contains("echolife") || bLow.contains("bbsp")) {
                    return "huawei";
                }
                if (sLow.contains("zte") || bLow.contains("zxhn") || bLow.contains("getpage.gch")) {
                    return "zte";
                }
                return "universal";
            } catch (Exception e) {
                return "universal";
            } finally {
                if (conn != null) conn.disconnect();
            }
        }

        private static boolean postRawFormWithAuth(String urlStr, String rawBody, String referer, String user, String pass) {
            HttpURLConnection conn = null;
            try {
                byte[] bytes = (rawBody != null) ? rawBody.getBytes("UTF-8") : new byte[0];
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(2500);
                conn.setReadTimeout(2500);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestMethod(rawBody != null ? "POST" : "GET");
                if (rawBody != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                }
                if (referer != null) conn.setRequestProperty("Referer", referer);
                if (user != null && pass != null && (!user.isEmpty() || !pass.isEmpty())) {
                    String basic = Base64.encodeToString((user + ":" + pass).getBytes("UTF-8"), Base64.NO_WRAP);
                    conn.setRequestProperty("Authorization", "Basic " + basic);
                }
                if (rawBody != null && bytes.length > 0) {
                    OutputStream os = conn.getOutputStream();
                    os.write(bytes);
                    os.flush();
                    os.close();
                }
                int code = conn.getResponseCode();
                return (code >= 200 && code < 400);
            } catch (Exception ignored) {
                return false;
            } finally {
                if (conn != null) conn.disconnect();
            }
        }

        private static boolean injectTpLink(String gatewayIp, String macDashed, String action, String user, String pass) {
            try {
                String subUrl;
                if ("unblock".equalsIgnoreCase(action) || "unblock_all".equalsIgnoreCase(action)) {
                    subUrl = "http://" + gatewayIp + "/userRpm/WlanMacFilterRpm.htm?Page=1&Del=Del&mac=" + URLEncoder.encode(macDashed, "UTF-8");
                } else {
                    subUrl = "http://" + gatewayIp + "/userRpm/WlanMacFilterRpm.htm?Page=1&Add=Add&mac=" + URLEncoder.encode(macDashed, "UTF-8") + "&desc=SentinelCut&action=1";
                }
                return postRawFormWithAuth(subUrl, null, "http://" + gatewayIp + "/userRpm/WlanMacFilterRpm.htm", user, pass);
            } catch (Exception e) {
                return false;
            }
        }

        private static boolean injectTenda(String gatewayIp, String macColons, String action, String user, String pass) {
            try {
                String body;
                if ("unblock".equalsIgnoreCase(action) || "unblock_all".equalsIgnoreCase(action)) {
                    body = "module1=macFilter&macFilterType=none&mac=" + URLEncoder.encode(macColons, "UTF-8");
                } else {
                    body = "module1=macFilter&macFilterType=black&mac=" + URLEncoder.encode(macColons, "UTF-8");
                }
                return postRawForm("http://" + gatewayIp + "/goform/setMacFilterCfg", body, "http://" + gatewayIp + "/");
            } catch (Exception e) {
                return false;
            }
        }

        private static boolean injectHuawei(String gatewayIp, String macColons, String action, String user, String pass) {
            try {
                String body = "Action=" + ("unblock".equalsIgnoreCase(action) ? "del" : "add") + "&Mac=" + URLEncoder.encode(macColons, "UTF-8");
                return postRawForm("http://" + gatewayIp + "/html/bbsp/wlanmacfilter/wlanmacfilter.asp", body, "http://" + gatewayIp + "/");
            } catch (Exception e) {
                return false;
            }
        }

        private static boolean injectZte(String gatewayIp, String macColons, String action, String user, String pass) {
            try {
                String body = "action=" + ("unblock".equalsIgnoreCase(action) ? "del" : "add") + "&mac=" + URLEncoder.encode(macColons, "UTF-8");
                return postRawForm("http://" + gatewayIp + "/getpage.gch?pid=1002&nextpage=net_wlan_macfilt_t.gch", body, "http://" + gatewayIp + "/");
            } catch (Exception e) {
                return false;
            }
        }

        private static boolean injectRealtekBoa(String gatewayIp, String macColons, String macDashed, String action, String user, String pass) {
            try {
                postRawForm("http://" + gatewayIp + "/boaform/admin/formLogout", "save=Logout&submit-url=%2Fadmin%2Flogin.asp", "http://" + gatewayIp + "/");
                String loginBody = "challenge=&username=" + URLEncoder.encode(user, "UTF-8") +
                                   "&psd=" + URLEncoder.encode(pass, "UTF-8") +
                                   "&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag=";
                postRawForm("http://" + gatewayIp + "/boaform/admin/formLogin", loginBody, "http://" + gatewayIp + "/admin/login.asp");

                String rteUrl = "http://" + gatewayIp + "/boaform/admin/formRteMacFilter";
                String rteRef = "http://" + gatewayIp + "/secu_macfilter_src.asp";
                boolean ruleOk = false;
                Pattern ruleEntryPat = Pattern.compile("it_nr\\(\"(\\d+)\",\\s*new it\\(\"devname\",\\s*\"([^\"]*)\"\\),\\s*new it\\(\"mac\",\\s*\"([^\"]+)\"\\)");

                if ("unblock_all".equalsIgnoreCase(action)) {
                    String html = fetchHttpText(rteRef);
                    if (html != null && !html.isEmpty()) {
                        Matcher m = ruleEntryPat.matcher(html);
                        StringBuilder bc = new StringBuilder("l");
                        boolean hasAny = false;
                        while (m.find()) {
                            hasAny = true;
                            String idxStr = m.group(1);
                            String dname = m.group(2);
                            String rMac = m.group(3);
                            bc.append("d4:name").append(idxStr.length()).append(":").append(idxStr)
                              .append("7:devname").append(dname.length()).append(":").append(dname)
                              .append("3:mac").append(rMac.length()).append(":").append(rMac).append("e");
                        }
                        bc.append("e");
                        if (hasAny) {
                            String rmBody = "action=rm&bcdata=" + URLEncoder.encode(bc.toString(), "UTF-8") + "&submit-url=%2Fsecu_macfilter_src.asp";
                            postRawForm(rteUrl, rmBody, rteRef);
                        }
                    }
                    ruleOk = postRawForm(rteUrl, "macFilterEnble=off&action=sw&bcdata=le&submit-url=%2Fsecu_macfilter_src.asp", rteRef);
                } else if ("unblock".equalsIgnoreCase(action)) {
                    String html = fetchHttpText(rteRef);
                    if (html != null && !html.isEmpty()) {
                        Matcher m = ruleEntryPat.matcher(html);
                        StringBuilder bc = new StringBuilder("l");
                        boolean foundTarget = false;
                        while (m.find()) {
                            String idxStr = m.group(1);
                            String dname = m.group(2);
                            String rMac = m.group(3);
                            if (rMac.equalsIgnoreCase(macDashed) || rMac.equalsIgnoreCase(macColons) || rMac.toLowerCase().startsWith("02-5a-2d-a1-")) {
                                foundTarget = true;
                                bc.append("d4:name").append(idxStr.length()).append(":").append(idxStr)
                                  .append("7:devname").append(dname.length()).append(":").append(dname)
                                  .append("3:mac").append(rMac.length()).append(":").append(rMac).append("e");
                            }
                        }
                        bc.append("e");
                        if (foundTarget) {
                            String rmBody = "action=rm&bcdata=" + URLEncoder.encode(bc.toString(), "UTF-8") + "&submit-url=%2Fsecu_macfilter_src.asp";
                            ruleOk = postRawForm(rteUrl, rmBody, rteRef);
                        } else {
                            ruleOk = true;
                        }
                    }
                } else {
                    postRawForm(rteUrl, "macFilterEnble=on&action=sw&submit-url=%2Fsecu_macfilter_src.asp", rteRef);
                    postRawForm(rteUrl, "macFilterMode=off&action=md&submit-url=%2Fsecu_macfilter_src.asp", rteRef);

                    String htmlBefore = fetchHttpText(rteRef);
                    boolean alreadyExists = false;
                    if (htmlBefore != null && !htmlBefore.isEmpty()) {
                        Matcher m = ruleEntryPat.matcher(htmlBefore);
                        StringBuilder fakeBc = new StringBuilder("l");
                        boolean hasFake = false;
                        while (m.find()) {
                            String idxStr = m.group(1);
                            String dname = m.group(2);
                            String rMac = m.group(3);
                            if (rMac.equalsIgnoreCase(macDashed) || rMac.equalsIgnoreCase(macColons)) {
                                alreadyExists = true;
                            } else if (rMac.toLowerCase().startsWith("02-5a-2d-a1-")) {
                                hasFake = true;
                                fakeBc.append("d4:name").append(idxStr.length()).append(":").append(idxStr)
                                      .append("7:devname").append(dname.length()).append(":").append(dname)
                                      .append("3:mac").append(rMac.length()).append(":").append(rMac).append("e");
                            }
                        }
                        fakeBc.append("e");
                        if (hasFake) {
                            String rmBody = "action=rm&bcdata=" + URLEncoder.encode(fakeBc.toString(), "UTF-8") + "&submit-url=%2Fsecu_macfilter_src.asp";
                            postRawForm(rteUrl, rmBody, rteRef);
                        }
                    }

                    if (!alreadyExists) {
                        String addBody = "action=ad&mac=" + URLEncoder.encode(macColons, "UTF-8") + "&devname=SentinelCut&submit-url=%2Fsecu_macfilter_src.asp";
                        ruleOk = postRawForm(rteUrl, addBody, rteRef);
                    } else {
                        ruleOk = true;
                    }

                    String htmlAfter = fetchHttpText(rteRef);
                    if (htmlAfter != null && (htmlAfter.toLowerCase().contains(macDashed) || htmlAfter.toLowerCase().contains(macColons))) {
                        ruleOk = true;
                    }
                }

                postRawForm("http://" + gatewayIp + "/boaform/admin/formLogout", "save=Logout&submit-url=%2Fadmin%2Flogin.asp", "http://" + gatewayIp + "/");
                return ruleOk;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String detectRouterModelNative(String gatewayIp) {
            return detectRouterBrand(gatewayIp);
        }

        @JavascriptInterface
        public String injectRouterMacBlockNative(String gatewayIp, String mac, String action, String user, String pass) {
            try {
                if (user != null && !user.isEmpty()) pendingRouterUser = user;
                if (pass != null && !pass.isEmpty()) pendingRouterPass = pass;
                pendingInjectMac = mac;

                String cleanHex = (mac != null) ? mac.replace(":", "").replace("-", "").toLowerCase() : "";
                String selfDynamicMac = detectActiveMac();
                String selfClean = (selfDynamicMac != null) ? selfDynamicMac.replace(":", "").toLowerCase() : "";
                if ("block".equalsIgnoreCase(action) &&
                    ("b6c71be6d241".equals(cleanHex) || "80f7a662a5dc".equals(cleanHex) || "80f7a662a5db".equals(cleanHex) ||
                     "fcaa145d9f68".equals(cleanHex) || (!selfClean.isEmpty() && selfClean.equals(cleanHex)))) {
                    return "{\"router_reached\":true,\"mac_hex\":\"" + cleanHex + "\",\"gateway\":\"" + gatewayIp + "\",\"rule_ok\":false,\"message\":\"Protección activa: Equipo propio protegido contra autobloqueo\"}";
                }
                if ("block".equalsIgnoreCase(action) && (cleanHex.startsWith("025a2da1") || "000000000000".equals(cleanHex) || cleanHex.length() != 12)) {
                    return "{\"router_reached\":true,\"mac_hex\":\"" + cleanHex + "\",\"gateway\":\"" + gatewayIp + "\",\"rule_ok\":false,\"message\":\"Actualizando tabla MAC real del router... Ejecuta Escanear e inténtalo de nuevo.\"}";
                }

                String macColons = mac.toLowerCase().replace("-", ":");
                String macDashed = mac.toLowerCase().replace(":", "-");
                if (cleanHex.length() == 12) {
                    macColons = cleanHex.substring(0, 2) + ":" + cleanHex.substring(2, 4) + ":" +
                                cleanHex.substring(4, 6) + ":" + cleanHex.substring(6, 8) + ":" +
                                cleanHex.substring(8, 10) + ":" + cleanHex.substring(10, 12);
                    macDashed = macColons.replace(":", "-");
                }

                String detectedBrand = detectRouterBrand(gatewayIp);
                boolean ruleOk = false;
                String brandName = "Realtek Boa / Fibra ONT";

                if ("tplink".equals(detectedBrand)) {
                    brandName = "TP-Link Archer / WR";
                    ruleOk = injectTpLink(gatewayIp, macDashed, action, pendingRouterUser, pendingRouterPass);
                } else if ("tenda".equals(detectedBrand)) {
                    brandName = "Tenda Wireless";
                    ruleOk = injectTenda(gatewayIp, macColons, action, pendingRouterUser, pendingRouterPass);
                } else if ("huawei".equals(detectedBrand)) {
                    brandName = "Huawei EchoLife";
                    ruleOk = injectHuawei(gatewayIp, macColons, action, pendingRouterUser, pendingRouterPass);
                } else if ("zte".equals(detectedBrand)) {
                    brandName = "ZTE ZXHN";
                    ruleOk = injectZte(gatewayIp, macColons, action, pendingRouterUser, pendingRouterPass);
                } else {
                    brandName = "Realtek Boa / Fibra ONT";
                    ruleOk = injectRealtekBoa(gatewayIp, macColons, macDashed, action, pendingRouterUser, pendingRouterPass);
                    if (!ruleOk && !"realtek_boa".equals(detectedBrand)) {
                        ruleOk = injectTpLink(gatewayIp, macDashed, action, pendingRouterUser, pendingRouterPass);
                        if (ruleOk) brandName = "TP-Link Universal";
                    }
                }

                vibrate(40);
                String msg;
                if (ruleOk) {
                    msg = "Módem [" + brandName + " " + gatewayIp + "]: MAC " + macDashed + ("unblock".equalsIgnoreCase(action) ? " liberada de Lista Negra" : " bloqueada en Lista Negra del router");
                } else {
                    msg = "Módem [" + brandName + " " + gatewayIp + "]: Si la inyección directa no aplicó por panel personalizado, usa el botón Auto-MAC Router para inyección asistida.";
                }
                return "{\"router_reached\":" + (ruleOk || !"universal".equals(detectedBrand)) +
                       ",\"mac_hex\":\"" + macDashed + "\",\"gateway\":\"" + gatewayIp +
                       "\",\"rule_ok\":" + ruleOk + ",\"driver\":\"" + detectedBrand + "\",\"message\":\"" + msg + "\"}";
            } catch (Exception e) {
                return "{\"router_reached\":false,\"mac_hex\":\"\",\"gateway\":\"" + gatewayIp + "\"}";
            }
        }

        public void openRouterConsoleSync(String gatewayIp, String mac, String user, String pass) {
            if (mac != null && !mac.isEmpty()) pendingInjectMac = mac;
            if (user != null && !user.isEmpty()) pendingRouterUser = user;
            if (pass != null && !pass.isEmpty()) pendingRouterPass = pass;
            String brand = detectRouterBrand(gatewayIp);
            String targetUrl = "http://" + gatewayIp + "/";
            if ("realtek_boa".equals(brand)) {
                try {
                    postRawForm("http://" + gatewayIp + "/boaform/admin/formLogout", "save=Logout&submit-url=%2Fadmin%2Flogin.asp", "http://" + gatewayIp + "/");
                    String loginBody = "challenge=&username=" + URLEncoder.encode(pendingRouterUser, "UTF-8") +
                                       "&psd=" + URLEncoder.encode(pendingRouterPass, "UTF-8") +
                                       "&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag=";
                    postRawForm("http://" + gatewayIp + "/boaform/admin/formLogin", loginBody, "http://" + gatewayIp + "/admin/login.asp");
                } catch (Exception ignored) {}
                targetUrl = "http://" + gatewayIp + "/secu_macfilter_src.asp";
            } else if ("tplink".equals(brand)) {
                targetUrl = "http://" + gatewayIp + "/userRpm/WlanMacFilterRpm.htm";
            } else if ("tenda".equals(brand)) {
                targetUrl = "http://" + gatewayIp + "/main.html";
            } else if ("huawei".equals(brand)) {
                targetUrl = "http://" + gatewayIp + "/html/bbsp/wlanmacfilter/wlanmacfilter.asp";
            } else if ("zte".equals(brand)) {
                targetUrl = "http://" + gatewayIp + "/getpage.gch?pid=1002&nextpage=net_wlan_macfilt_t.gch";
            }
            activity.runOnUiThread(new LoadUrlRunner(webView, targetUrl));
        }

        @JavascriptInterface
        public void openRouterAutoInjectorConsole(String gatewayIp, String mac, String user, String pass) {
            vibrate(25);
            new Thread(new AsyncBgRunner(this, "router_open", "open", gatewayIp, mac, user, pass, "")).start();
        }

        @JavascriptInterface
        public void setSystemTheme(String theme) {
            boolean isDark = "dark".equalsIgnoreCase(theme);
            activity.runOnUiThread(new ThemeRunner(activity, isDark));
        }

        @JavascriptInterface
        public void vibrate(int durationMs) {
            try {
                Vibrator vib = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
                if (vib != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vib.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vib.vibrate(durationMs);
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void showToast(String message) {
            activity.runOnUiThread(new ToastRunner(activity, message));
        }

        @JavascriptInterface
        public boolean copyToClipboard(String label, String text) {
            try {
                ClipboardManager cb = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cb != null) {
                    ClipData clip = ClipData.newPlainText(label, text);
                    cb.setPrimaryClip(clip);
                    showToast("Copiado: " + text);
                    vibrate(25);
                    return true;
                }
            } catch (Exception ignored) {}
            return false;
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                activity.startActivity(intent);
            } catch (Exception e) {
                showToast("No se pudo abrir: " + url);
            }
        }

        @JavascriptInterface
        public String getWifiDetailsJson() {
            try {
                WifiManager wm = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                String ssid = "WiFi Activo";
                String bssid = "00:00:00:00:00:00";
                int rssi = -52;
                int speed = 130;
                int freq = 2432;
                String ip = detectActiveIpv4();
                boolean isConnected = false;

                if (wm != null && wm.isWifiEnabled()) {
                    WifiInfo info = wm.getConnectionInfo();
                    DhcpInfo dhcp = wm.getDhcpInfo();

                    if (info != null) {
                        int netId = info.getNetworkId();
                        int ipInt = info.getIpAddress();
                        int curRssi = info.getRssi();
                        if (netId != -1 || ipInt != 0 || (curRssi > -127 && curRssi < 0) || (ip != null && !ip.equals("127.0.0.1") && !ip.equals("0.0.0.0"))) {
                            isConnected = true;
                        }
                        if (info.getSSID() != null && !info.getSSID().equals("<unknown ssid>") && !info.getSSID().trim().isEmpty()) {
                            ssid = info.getSSID().replace("\"", "");
                        }
                        if (info.getBSSID() != null && !info.getBSSID().equals("02:00:00:00:00:00")) {
                            bssid = info.getBSSID().toLowerCase();
                        }
                        if (curRssi > -127 && curRssi < 0) {
                            rssi = curRssi;
                        }
                        if (info.getLinkSpeed() > 0) {
                            speed = info.getLinkSpeed();
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && info.getFrequency() > 0) {
                            freq = info.getFrequency();
                        }
                        if (ipInt != 0) {
                            ip = intToIp(ipInt);
                        }
                    }
                    if (!isConnected && ip != null && !ip.equals("127.0.0.1") && !ip.equals("0.0.0.0")) {
                        isConnected = true;
                    }
                    if (ssid.equals("WiFi Activo") || ssid.equals("<unknown ssid>")) {
                        if (bssid.equalsIgnoreCase("d4:58:00:a9:07:9b") || bssid.equalsIgnoreCase("80:f7:a6:62:a5:dc")) {
                            ssid = "FAMILIASH";
                        }
                    }
                    String gw = "0.0.0.0";
                    if (dhcp != null && dhcp.gateway != 0) {
                        gw = intToIp(dhcp.gateway);
                    } else if (ip != null && ip.contains(".")) {
                        gw = ip.substring(0, ip.lastIndexOf('.')) + ".1";
                    }

                    int quality = WifiManager.calculateSignalLevel(rssi, 100);
                    String band = (freq >= 4900) ? "5 GHz" : "2.4 GHz";
                    String subnet = (ip != null && ip.contains(".")) ? (ip.substring(0, ip.lastIndexOf('.')) + ".0/24") : "0.0.0.0/0";
                    String devModel = Build.MANUFACTURER + " " + Build.MODEL;

                    return "{\"connected\":" + isConnected + ",\"ssid\":\"" + ssid + "\",\"bssid\":\"" + bssid + "\",\"rssi\":" + rssi +
                           ",\"quality\":" + quality + ",\"speed\":" + speed + ",\"freq\":" + freq +
                           ",\"band\":\"" + band + "\",\"phone_ip\":\"" + (ip != null ? ip : "0.0.0.0") + "\",\"gateway\":\"" + gw +
                           "\",\"subnet\":\"" + subnet + "\",\"device_model\":\"" + devModel + "\"}";
                }
                String fallbackModel = Build.MANUFACTURER + " " + Build.MODEL;
                return "{\"connected\":false,\"ssid\":\"Sin conexión WiFi\",\"bssid\":\"00:00:00:00:00:00\",\"rssi\":0,\"quality\":0,\"speed\":0,\"freq\":0,\"band\":\"N/A\",\"phone_ip\":\"0.0.0.0\",\"gateway\":\"0.0.0.0\",\"subnet\":\"0.0.0.0/0\",\"device_model\":\"" + fallbackModel + "\"}";
            } catch (Exception ignored) {}
            return "{\"connected\":false,\"ssid\":\"WiFi Desconectado\",\"bssid\":\"00:00:00:00:00:00\",\"rssi\":0,\"quality\":0,\"speed\":0,\"freq\":0,\"band\":\"N/A\",\"phone_ip\":\"0.0.0.0\",\"gateway\":\"0.0.0.0\",\"subnet\":\"0.0.0.0/0\",\"device_model\":\"Android\"}";
        }

        public void deliverAsyncResult(String reqId, String jsonPayload) {
            activity.runOnUiThread(new JsCallbackRunner(webView, reqId, jsonPayload));
        }

        @JavascriptInterface
        public void scanCurrentWifiNetworkAsync(String reqId) {
            new Thread(new AsyncBgRunner(this, "scan", reqId, "", "", "", "", "")).start();
        }

        @JavascriptInterface
        public void scanPortsAsync(String reqId, String ip) {
            new Thread(new AsyncBgRunner(this, "ports", reqId, ip, "", "", "", "")).start();
        }

        @JavascriptInterface
        public void pingHostAsync(String reqId, String ip) {
            new Thread(new AsyncBgRunner(this, "ping", reqId, ip, "", "", "", "")).start();
        }

        @JavascriptInterface
        public void injectRouterMacBlockAsync(String reqId, String gatewayIp, String mac, String action, String user, String pass) {
            new Thread(new AsyncBgRunner(this, "router_inject", reqId, gatewayIp, mac, action, user, pass)).start();
        }

        @JavascriptInterface
        public void verifyRouterAdminAsync(String reqId, String gatewayIp, String user, String pass) {
            new Thread(new AsyncBgRunner(this, "router_verify", reqId, gatewayIp, user, pass, "", "")).start();
        }

        public String verifyRouterAdminCredentials(String gatewayIp, String user, String pass) {
            try {
                if (gatewayIp == null || gatewayIp.trim().isEmpty()) gatewayIp = "192.168.101.1";
                if (user == null || user.trim().isEmpty()) user = "admin";
                if (pass == null) pass = "";

                URL url = new URL("http://" + gatewayIp + "/boaform/admin/formLogin");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(3500);
                conn.setReadTimeout(3500);
                conn.setDoOutput(true);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("Referer", "http://" + gatewayIp + "/admin/login.asp");
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 12) WiFiSentinel/4.0");

                String postData = "challenge=&username=" + URLEncoder.encode(user, "UTF-8") +
                                  "&psd=" + URLEncoder.encode(pass, "UTF-8") +
                                  "&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag=";
                OutputStream os = conn.getOutputStream();
                os.write(postData.getBytes("UTF-8"));
                os.flush();
                os.close();

                InputStream is = null;
                try {
                    is = conn.getInputStream();
                } catch (Exception e) {
                    is = conn.getErrorStream();
                }

                String responseBody = "";
                if (is != null) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    br.close();
                    responseBody = sb.toString();
                }

                int respCode = -1;
                try {
                    respCode = conn.getResponseCode();
                } catch (Exception ignored) {}

                if (respCode == 404 || respCode == 405 || (responseBody.isEmpty() && respCode >= 400)) {
                    // El router no responde a formulario Boa. Probar autenticación HTTP Basic / Digest
                    try {
                        URL rootUrl = new URL("http://" + gatewayIp + "/");
                        HttpURLConnection basicConn = (HttpURLConnection) rootUrl.openConnection();
                        String userPass = user + ":" + pass;
                        String basicAuth = "Basic " + android.util.Base64.encodeToString(userPass.getBytes("UTF-8"), android.util.Base64.NO_WRAP);
                        basicConn.setRequestProperty("Authorization", basicAuth);
                        basicConn.setConnectTimeout(2500);
                        basicConn.setReadTimeout(2500);
                        int bCode = basicConn.getResponseCode();
                        if (bCode == 200 || bCode == 301 || bCode == 302) {
                            return "{\"valid\":true,\"message\":\"Identidad de Dueño verificada con router (" + gatewayIp + ")\"}";
                        }
                    } catch (Exception ignored) {}
                }

                String lower = responseBody.toLowerCase();
                if (lower.contains("bad password")) {
                    return "{\"valid\":false,\"error\":\"Contraseña incorrecta del módem. Revisa la etiqueta física bajo tu router.\"}";
                }
                if (lower.contains("another user have logined")) {
                    return "{\"valid\":false,\"error\":\"El módem tiene otra sesión de administrador activa. Espera 1 minuto o cierra la sesión en el navegador.\"}";
                }

                boolean isBroadband = lower.contains("broadband") || lower.contains("main.asp") || lower.contains("it_nr");
                boolean isNotLoginPage = !lower.contains("login.asp") && !lower.contains("psdinput") && responseBody.length() > 500;

                if (isBroadband || isNotLoginPage) {
                    try {
                        URL logoutUrl = new URL("http://" + gatewayIp + "/boaform/admin/formLogout");
                        HttpURLConnection outConn = (HttpURLConnection) logoutUrl.openConnection();
                        outConn.setRequestMethod("POST");
                        outConn.setConnectTimeout(2000);
                        outConn.setReadTimeout(2000);
                        outConn.setDoOutput(true);
                        outConn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                        OutputStream outOs = outConn.getOutputStream();
                        outOs.write("save=Logout&submit-url=%2Fadmin%2Flogin.asp".getBytes("UTF-8"));
                        outOs.flush();
                        outOs.close();
                        outConn.getResponseCode();
                        outConn.disconnect();
                    } catch (Exception ignored) {}

                    return "{\"valid\":true,\"message\":\"Identidad de Dueño verificada con el módem (" + gatewayIp + ")\"}";
                }

                return "{\"valid\":false,\"error\":\"Contraseña incorrecta para el router " + gatewayIp + ". Verifica la etiqueta física del módem.\"}";
            } catch (Exception e) {
                return "{\"valid\":false,\"error\":\"No se pudo contactar al router en " + gatewayIp + ". Comprueba que estás conectado a su red WiFi.\"}";
            }
        }

        @JavascriptInterface
        public String scanCurrentWifiNetworkNative() {
            try {
                WifiManager wm = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                String phoneIp = detectActiveIpv4();
                String gwIp = null;
                String gwBssid = "00:00:00:00:00:00";
                if (wm != null) {
                    WifiInfo info = wm.getConnectionInfo();
                    DhcpInfo dhcp = wm.getDhcpInfo();
                    if (info != null) {
                        if (phoneIp == null && info.getIpAddress() != 0) {
                            phoneIp = intToIp(info.getIpAddress());
                        }
                        if (info.getBSSID() != null && !info.getBSSID().equals("02:00:00:00:00:00")) {
                            gwBssid = info.getBSSID().toLowerCase();
                        }
                    }
                    if (dhcp != null && dhcp.gateway != 0) {
                        gwIp = intToIp(dhcp.gateway);
                    }
                }
                if (phoneIp == null || phoneIp.trim().isEmpty()) {
                    phoneIp = detectActiveIpv4();
                }
                if (phoneIp == null || !phoneIp.contains(".")) {
                    phoneIp = "192.168.1.100";
                }
                String prefix = phoneIp.substring(0, phoneIp.lastIndexOf('.'));
                if (gwIp == null || gwIp.trim().isEmpty()) {
                    gwIp = prefix + ".1";
                }

                Map<String, String> arpMap = readKernelArpTable();
                Map<String, String> routerNames = new HashMap<String, String>();
                Set<String> routerBlockedMacs = new HashSet<String>();
                String routerMac = fetchRouterNetworkState(gwIp, arpMap, routerNames, routerBlockedMacs);

                if (gwBssid.equals("00:00:00:00:00:00")) {
                    if (arpMap.containsKey(gwIp)) {
                        gwBssid = arpMap.get(gwIp);
                    } else if (routerMac != null && !routerMac.isEmpty()) {
                        gwBssid = routerMac;
                    } else if ("192.168.101.1".equals(gwIp)) {
                        gwBssid = "80:f7:a6:62:a5:dc";
                    }
                }
                arpMap.put(gwIp, gwBssid);

                String selfMac = detectActiveMac();
                if (selfMac == null || selfMac.isEmpty()) {
                    if (arpMap.containsKey(phoneIp)) {
                        selfMac = arpMap.get(phoneIp);
                    }
                }

                ExecutorService pool = Executors.newFixedThreadPool(48);
                List<Future<String>> futures = new ArrayList<Future<String>>();

                for (int i = 1; i <= 254; i++) {
                    String targetIp = prefix + "." + i;
                    futures.add(pool.submit(new HostProbeTask(targetIp, phoneIp, gwIp, gwBssid, selfMac, arpMap, routerNames, routerBlockedMacs)));
                }
                pool.shutdown();
                if (!pool.awaitTermination(8, TimeUnit.SECONDS)) {
                    pool.shutdownNow();
                }

                StringBuilder sb = new StringBuilder("[");
                boolean first = true;
                for (int i = 0; i < futures.size(); i++) {
                    try {
                        Future<String> f = futures.get(i);
                        if (f.isDone()) {
                            String res = f.get();
                            if (res != null) {
                                if (!first) sb.append(",");
                                sb.append(res);
                                first = false;
                            }
                        }
                    } catch (Exception ignored) {}
                }
                sb.append("]");
                return sb.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public String scanPortsNative(String ip) {
            int[] ports = new int[]{21, 22, 23, 53, 80, 443, 445, 554, 3389, 8000, 8008, 8080, 62078};
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (int i = 0; i < ports.length; i++) {
                int p = ports[i];
                Socket s = null;
                try {
                    s = new Socket();
                    s.connect(new InetSocketAddress(ip, p), 80);
                    if (!first) sb.append(",");
                    sb.append(p);
                    first = false;
                } catch (Exception ignored) {
                } finally {
                    if (s != null) {
                        try { s.close(); } catch (Exception ignored) {}
                    }
                }
            }
            sb.append("]");
            return sb.toString();
        }

        @JavascriptInterface
        public double pingHostNative(String ip) {
            int[] probePorts = new int[]{80, 62078, 443, 445, 53};
            for (int i = 0; i < probePorts.length; i++) {
                int p = probePorts[i];
                long t0 = System.nanoTime();
                Socket s = null;
                try {
                    s = new Socket();
                    s.connect(new InetSocketAddress(ip, p), 110);
                    double ms = (System.nanoTime() - t0) / 1000000.0;
                    return Math.max(0.4, Math.round(ms * 10.0) / 10.0);
                } catch (Exception e) {
                    double ms = (System.nanoTime() - t0) / 1000000.0;
                    String msg = e.getMessage();
                    if (msg != null && (msg.contains("ECONNREFUSED") || msg.contains("refused"))) {
                        return Math.max(0.4, Math.round(ms * 10.0) / 10.0);
                    }
                } finally {
                    if (s != null) {
                        try { s.close(); } catch (Exception ignored) {}
                    }
                }
            }
            try {
                Process proc = Runtime.getRuntime().exec("/system/bin/ping -c 1 -W 1 " + ip);
                BufferedReader r = new BufferedReader(new InputStreamReader(proc.getInputStream()));
                String line;
                while ((line = r.readLine()) != null) {
                    int tIdx = line.indexOf("time=");
                    if (tIdx != -1) {
                        int endIdx = line.indexOf(" ", tIdx + 5);
                        String valStr = (endIdx != -1) ? line.substring(tIdx + 5, endIdx) : line.substring(tIdx + 5);
                        double parsed = Double.parseDouble(valStr.trim());
                        r.close();
                        return Math.max(0.4, Math.round(parsed * 10.0) / 10.0);
                    }
                }
                r.close();
            } catch (Exception ignored) {}
            try {
                long t1 = System.nanoTime();
                InetAddress addr = InetAddress.getByName(ip);
                if (addr.isReachable(180)) {
                    double ms = (System.nanoTime() - t1) / 1000000.0;
                    return Math.max(0.5, Math.round(ms * 10.0) / 10.0);
                }
            } catch (Exception ignored) {}
            return -1.0;
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.clearHistory();
            webView.clearCache(true);
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.getUrl() != null && !webView.getUrl().startsWith("file:///android_asset")) {
            webView.loadUrl("file:///android_asset/index.html");

        // Comprobación de actualizaciones en segundo plano desde GitHub
        AppUpdateManager.checkForUpdates(this, webView, false);
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
