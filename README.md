# WiFi Sentinel 🛡️

**Escáner de Red Inteligente, Radar en Tiempo Real y Control de Acceso Router para Android.**

WiFi Sentinel es una aplicación nativa/híbrida para Android diseñada para auditar redes WiFi, detectar intrusos con identificación de marcas y modelos reales, auditar puertos/cámaras espía y bloquear o cortar el acceso a internet directamente en el módem/router principal.

---

## 🚀 Descargar la Aplicación

Puedes descargar directamente el instalador oficial compilado y firmado:

- 📥 **[Descargar WiFi Sentinel APK (Última Versión)](https://raw.githubusercontent.com/juanherrerasandoval70-eng/wifi-sentinel/main/dist/wifi-sentinel.apk)**

---

## ✨ Características Principales

1. **Radar en Tiempo Real:**
   - Visualización interactiva de nodos con medición de latencia (ping) y ángulo de señal.
   - Indicadores visuales de estado: Verificado (verde), Revisión / MAC Privada (ámbar), Riesgo / Desconocido (rojo), Aislado / Cortado (cuadrado).

2. **Detección Real de Marcas y Modelos:**
   - Resolución automática mediante tabla DHCP del router y consultas binarias DNS PTR / mDNS UDP 53 y 5353.
   - Muestra nombres exactos como `Samsung Galaxy A07 (Eva)`, `Redmi 13C`, `Xiaomi Redmi Note 10 Pro`, `ZTE Blade A51`, `Smart Device`, `Ordenador PC`, eliminando el texto genérico "Teléfono".

3. **Corte de Internet Real por Router:**
   - Inyección directa en la Lista Negra (MAC Filtering / ACL) de routers Realtek Boa y estándares.
   - Utiliza direcciones MAC físicas de hardware obtenidas directamente de la tabla ARP/DHCP del router, evitando MACs sintéticas y garantizando que el intruso quede sin navegación.

4. **Modo Dueño con Seguridad por Módem:**
   - Cada módem/router tiene su propio perfil de credenciales protegido y aislado.
   - No propaga contraseñas a redes ajenas; al conectarse a una nueva red, inicia en Modo Monitor y requiere la contraseña de la etiqueta física de ese router específico.

5. **Actualizaciones Automáticas (OTA vía GitHub):**
   - Sistema de actualización en la nube conectado a este repositorio.
   - Al publicar una nueva versión, la app avisa a los usuarios y descarga/instala la actualización directamente en el celular.

6. **Monetización Adsterra Smartlinks:**
   - Integración nativa de enlaces directos sin SDK con rotación circular y selector de edad (+18) en ajustes.

---

## 🛠️ Publicar Nuevas Actualizaciones

Para subir una nueva versión a GitHub y que todos los usuarios la reciban automáticamente:

```powershell
.\publish_version.ps1 -VersionName "4.1.0" -Changelog "Nuevas mejoras de escaneo y optimización."
```

---

## 📱 Compatibilidad
- **Android:** API 21 (Android 5.0 Lollipop) hasta API 34+ (Android 14+).
- **Firma:** Esquemas V1 (JAR), V2 y V3 habilitados y verificados con `apksigner`.
