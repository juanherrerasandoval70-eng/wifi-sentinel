# WiFi Sentinel — Release Final

Versión final y definitiva de **WiFi Sentinel** (`com.aegis.wifisentinel`).

## 1. Componentes Principales Entregados

- **APK de Producción Firmado:** `wifi-sentinel.apk` (78 KB, firmado con esquemas V1, V2 y V3).
- **Copia Local en Dispositivo:** `/sdcard/Download/WiFi-Sentinel.apk` en Samsung Galaxy S10.
- **Código Fuente Java Nativo:**
  - `src/com/aegis/wifisentinel/MainActivity.java`: Escaneo de red ARP/UDP multihilo, resolución de nombres reales por DHCP/PTR nativo, inyección directa de corte en router Realtek Boa (`secu_macfilter_src.asp`), bypass de SELinux con lectura de tabla `/status_ethernet_info.asp`.
  - `src/com/aegis/wifisentinel/AdNetworkManager.java`: Integración directa de Adsterra Smartlinks sin SDK, pool seguro y pool +18, rotación circular, persistencia en `SharedPreferences` (`ads_prefs`), apertura con `Intent.ACTION_VIEW`.
- **Frontend Web & UI:**
  - `assets/index.html` y `static/index.html`: Radar interactivo, barra superior limpia sin texto de versión, vista de equipos con nombres de modelos reales, ajustes de anuncios con switch +18 y tarjetas de patrocinio.
  - `assets/style.css` y `static/style.css`: Sistema de diseño oscuro y limpio con tokens CSS, modales accesibles y badges de estado.
  - `assets/app.js` y `static/app.js`: Lógica de radar, detección y sincronización bidireccional JS-Native (`SentinelNative`).

## 2. Publicidad Integrada (Adsterra Smartlinks)

- **Pool Mainstream / Limpio (Por defecto):**
  - `https://asiafilm.org/4/ed7357907f05efc3d793c5aedbdf0c5b`
  - `https://asiafilm.org/4/b70dfeb9161b32fbda5a5d24daca1943`
  - `https://asiafilm.org/4/7f20a7584445d119b20cbbaa4fc4012c`
- **Pool +18 Adultos (Opcional):**
  - `https://auctionr.org/4/ceb82fb7e10796fc95547d9b50cfe003`
  - `https://auctionr.org/4/048d8aa6b801685694fdae38b9f9cb5b`
- **Frecuencia:** Cada 2 acciones clave (escaneos, cortes, pruebas de red) o toque directo en tarjetas de anuncio.

## 3. Estado de Pruebas en Vivo (Samsung Galaxy S10)
- Conexión vía WiFi ADB (`192.168.101.74:5555`): Exitosa.
- Instalación de APK: Exitosa.
- Reconocimiento de equipos: Modelos reales detectados (ZTE Blade A51, Samsung Galaxy A07, Xiaomi Redmi Note 10 Pro, Redmi 13C, PC KernelOS).
- Corte de internet: MACs de hardware reales inyectadas al router sin generar MACs sintéticas.
- Publicidad: Diálogo de verificación de edad y switch en Ajustes funcionando y verificado vía `logcat -s AdsterraAds`.
