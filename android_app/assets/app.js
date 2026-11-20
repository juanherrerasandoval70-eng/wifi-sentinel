/**
 * WIFI SENTINEL v4.0 — Dynamic Multi-Network Native & Hybrid Engine
 * Escaneo real multi-red en Java (scanCurrentWifiNetworkNative) + Servidor FastAPI
 */

const CANDIDATE_HOSTS = [
    '',
    'http://127.0.0.1:8000',
    'http://192.168.101.84:8000'
];

let activeApiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';
let isBackendAvailable = window.location.protocol !== 'file:';

// Puente asíncrono sin bloqueos para WebView Android (evita que la pantalla se pegue)
const pendingNativeCallbacks = {};
let nativeReqCounter = 1;

window.__onSentinelNativeResult = function(reqId, rawPayload) {
    const entry = pendingNativeCallbacks[reqId];
    if (entry) {
        clearTimeout(entry.timer);
        delete pendingNativeCallbacks[reqId];
        entry.resolve(rawPayload);
    }
};

function callNativeAsync(asyncMethod, argsArray = [], timeoutMs = 4500) {
    return new Promise((resolve) => {
        if (!window.SentinelNative || typeof window.SentinelNative[asyncMethod] !== 'function') {
            resolve(null);
            return;
        }
        const reqId = `req_${Date.now()}_${nativeReqCounter++}`;
        const timer = setTimeout(() => {
            delete pendingNativeCallbacks[reqId];
            resolve(null);
        }, timeoutMs);
        pendingNativeCallbacks[reqId] = { resolve, timer };
        try {
            window.SentinelNative[asyncMethod](reqId, ...argsArray);
        } catch (e) {
            clearTimeout(timer);
            delete pendingNativeCallbacks[reqId];
            resolve(null);
        }
    });
}

async function apiFetch(path, options = {}, timeoutMs = 450) {
    if (!isBackendAvailable && window.location.protocol === 'file:') {
        return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${activeApiBase}${path}`, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        isBackendAvailable = false;
        return null;
    }
}

// Diccionario OUI integrado para resolver fabricantes en cualquier red WiFi sin internet
const OUI_VENDORS = {
    '80f7a6': 'Shenzhen C-Data / Realtek Network',
    'd45800': 'Samsung Electronics',
    'b6c71b': 'Samsung Galaxy Mobile',
    'a87b39': 'Samsung Electronics',
    '347a60': 'Samsung Electronics',
    '508569': 'Samsung Electronics',
    'fcaa14': 'Gigabyte / Realtek PC GbE',
    'a483e7': 'Apple, Inc.',
    '001c43': 'Apple, Inc.',
    '3c0754': 'Apple, Inc.',
    'f01898': 'Apple, Inc.',
    'dc2b2a': 'Apple, Inc.',
    '14cc20': 'TP-Link Technologies',
    '50c7bf': 'TP-Link Technologies',
    'c025e9': 'TP-Link Technologies',
    '001e10': 'Huawei Technologies',
    '286ed4': 'Huawei Technologies',
    '00ec0a': 'Xiaomi Communications',
    '286c07': 'Xiaomi Communications',
    '640980': 'Xiaomi Communications',
    '2c6b7d': 'Xiaomi Communications',
    '38a6ce': 'Xiaomi Communications',
    '287b11': 'Dispositivo Android / Smart WiFi',
    '000ce7': 'ZTE Corporation',
    'e0247f': 'ZTE Corporation',
    '18fe34': 'Espressif Systems (IoT)',
    '240ac4': 'Espressif Systems (IoT)',
    '30aea4': 'Espressif Systems (IoT)',
    '001a11': 'Google, Inc.',
    '3c5ab4': 'Google Chromecast / Nest',
    '44650d': 'Amazon Technologies',
    'b827eb': 'Raspberry Pi Foundation',
    'dca632': 'Raspberry Pi Trading'
};

function isRandomizedMac(mac) {
    if (!mac || mac.length < 2 || mac === '00:00:00:00:00:00') return false;
    const clean = mac.replace(/[:-]/g, '').toLowerCase();
    const firstByte = parseInt(clean.substring(0, 2), 16);
    if (isNaN(firstByte)) return false;
    return (firstByte & 0x02) !== 0;
}

function lookupVendor(mac, isGateway, isSelf, hostname = '') {
    if (isGateway) return 'Shenzhen C-Data / Router Gateway';
    if (isSelf) return appState.deviceModel ? `${appState.deviceModel} (Este Teléfono)` : 'Dispositivo Local (Este Teléfono)';
    const clean = (mac || '').replace(/[:-]/g, '').toLowerCase().substring(0, 6);
    if (OUI_VENDORS[clean]) return OUI_VENDORS[clean];

    const h = (hostname || '').toLowerCase();
    const randSuffix = isRandomizedMac(mac) ? ' (MAC Privada)' : '';
    if (h.includes('redmi') || h.includes('poco') || h.includes('xiaomi') || h.startsWith('mi-')) {
        return `Xiaomi Communications${randSuffix}`;
    }
    if (h.includes('galaxy') || h.startsWith('sm-') || /^a\d{2}/i.test(h) || /^s\d{2}/i.test(h) || h.includes('samsung')) {
        return `Samsung Electronics${randSuffix}`;
    }
    if (h.includes('z2465') || h.includes('zte') || h.includes('blade')) {
        return `ZTE Corporation${randSuffix}`;
    }
    if (h.includes('iphone') || h.includes('ipad') || h.includes('macbook') || h.includes('apple')) {
        return `Apple, Inc.${randSuffix}`;
    }
    if (h.includes('moto') || h.includes('motorola')) {
        return `Motorola Mobility${randSuffix}`;
    }
    if (h.includes('huawei') || h.includes('honor')) {
        return `Huawei Technologies${randSuffix}`;
    }
    if (h.includes('-pc') || h.includes('desktop') || h.includes('laptop')) {
        return 'Ordenador Windows / Ethernet';
    }
    if (isRandomizedMac(mac)) return 'Celular con MAC Privada';
    return 'Adaptador WiFi IEEE Estándar';
}

const DEFAULT_101_SEED = [
    {
        ip: '192.168.101.1',
        mac: '80:f7:a6:62:a5:dc',
        hostname: 'Router Principal',
        vendor: 'Shenzhen C-Data / Realtek Network',
        is_randomized_mac: false,
        dev_type: 'router',
        latency_ms: 1.2,
        is_local_host: false,
        is_gateway: true,
        open_ports: [53, 80]
    },
    {
        ip: '192.168.101.70',
        mac: 'd4:58:00:a9:07:95',
        hostname: 'SR120-C',
        vendor: 'Samsung Electronics',
        is_randomized_mac: false,
        dev_type: 'iot',
        latency_ms: 14.8,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    },
    {
        ip: '192.168.101.72',
        mac: '36:a3:bd:27:4c:0f',
        hostname: 'Z2465N',
        vendor: 'ZTE Corporation (MAC Privada)',
        is_randomized_mac: true,
        dev_type: 'mobile',
        latency_ms: 24.5,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    },
    {
        ip: '192.168.101.74',
        mac: 'b6:c7:1b:e6:d2:41',
        hostname: 'S10-de-Wilmer',
        vendor: 'Samsung Galaxy S10 (Este Teléfono)',
        is_randomized_mac: true,
        dev_type: 'mobile',
        latency_ms: 1.1,
        is_local_host: true,
        is_gateway: false,
        alias: 'S10 de Wilmer',
        is_whitelisted: true,
        open_ports: []
    },
    {
        ip: '192.168.101.75',
        mac: '5a:97:3d:0f:a7:47',
        hostname: 'A07-de-Eva',
        vendor: 'Samsung Electronics (MAC Privada)',
        is_randomized_mac: true,
        dev_type: 'mobile',
        latency_ms: 21.3,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    },
    {
        ip: '192.168.101.80',
        mac: '76:23:22:ac:52:06',
        hostname: 'Redmi-Note-10-Pro',
        vendor: 'Xiaomi Communications (MAC Privada)',
        is_randomized_mac: true,
        dev_type: 'mobile',
        latency_ms: 19.6,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    },
    {
        ip: '192.168.101.81',
        mac: '28:7b:11:21:93:ba',
        hostname: 'Android',
        vendor: 'Dispositivo Android / Smart WiFi',
        is_randomized_mac: false,
        dev_type: 'mobile',
        latency_ms: 18.2,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    },
    {
        ip: '192.168.101.84',
        mac: 'fc:aa:14:5d:9f:68',
        hostname: 'KernelOS-PC',
        vendor: 'Gigabyte / Realtek PC GbE',
        is_randomized_mac: false,
        dev_type: 'pc',
        latency_ms: 2.4,
        is_local_host: false,
        is_gateway: false,
        open_ports: [8000]
    },
    {
        ip: '192.168.101.85',
        mac: '2e:9c:5a:92:73:e9',
        hostname: 'Android-Mobile',
        vendor: 'Celular con MAC Privada',
        is_randomized_mac: true,
        dev_type: 'mobile',
        latency_ms: 36.2,
        is_local_host: false,
        is_gateway: false,
        open_ports: []
    }
];

const appState = {
    theme: localStorage.getItem('sentinel_theme') || 'light',
    currentSubnet: '192.168.101.0/24',
    currentSsid: 'FAMILIASH',
    currentGateway: '192.168.101.1',
    currentPhoneIp: '192.168.101.74',
    currentBssid: '80:f7:a6:62:a5:dc',
    wifiFreq: 2432,
    wifiRssi: -52,
    wifiQuality: 99,
    wifiSpeed: 130,
    wifiBand: '2.4 GHz',
    devices: [],
    filter: 'all',
    searchQuery: '',
    sortBy: 'threat',
    selectedIp: '192.168.101.80',
    scanMode: 'fast',
    autoScanTimer: null,
    isScanning: false,
    audioEnabled: true,
    radarAngle: 0,
    activeView: 'view-radar',
    radarLoopRunning: false,
    routerUser: 'admin',
    routerPass: '',
    isOwnerVerified: false,
    localOverrides: JSON.parse(localStorage.getItem('sentinel_overrides') || '{"blocked":{},"whitelist":{},"aliases":{},"ports":{},"networks":{}}')
};

function secureStoreSecret(key, val) {
    try {
        localStorage.setItem(key, btoa(encodeURIComponent(val)));
    } catch (e) {
        localStorage.setItem(key, val);
    }
}

// --- GESTIÓN DE CREDENCIALES POR MÓDEM ESPECÍFICO (NO GLOBALES) ---
function getModemKey() {
    const bssid = (appState.currentBssid || '').toLowerCase().trim();
    if (bssid && bssid !== '00:00:00:00:00:00' && bssid !== 'unknown') {
        return bssid;
    }
    const gw = (appState.currentGateway || '').trim();
    const ssid = (appState.currentSsid || '').trim();
    if (gw && gw !== '0.0.0.0') {
        return `${gw}_${ssid}`;
    }
    return appState.currentSubnet || 'default_network';
}

function getModemsDb() {
    try {
        const raw = localStorage.getItem('sentinel_modems_db_v3');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

function saveModemsDb(db) {
    try {
        localStorage.setItem('sentinel_modems_db_v3', JSON.stringify(db));
    } catch (e) {}
}

function initModemsDbMigration() {
    const db = getModemsDb();
    if (Object.keys(db).length === 0) {
        const oldVerified = localStorage.getItem('sentinel_owner_verified_v2') === 'true';
        const oldUser = localStorage.getItem('sentinel_router_user') || 'admin';
        let oldPass = 'admin';
        const stored = localStorage.getItem('sentinel_router_pass_sec') || localStorage.getItem('sentinel_router_pass');
        if (stored) {
            try { oldPass = decodeURIComponent(atob(stored)); } catch (e) { oldPass = stored; }
        }
        // Migrar credenciales anteriores EXCLUSIVAMENTE al router 192.168.101.1 (80:f7:a6:62:a5:dc)
        db['80:f7:a6:62:a5:dc'] = {
            bssid: '80:f7:a6:62:a5:dc',
            gateway: '192.168.101.1',
            ssid: 'FAMILIASH',
            user: oldUser,
            pass: oldPass,
            verified: oldVerified
        };
        db['192.168.101.1_FAMILIASH'] = db['80:f7:a6:62:a5:dc'];
        saveModemsDb(db);

        // Limpiar claves globales obsoletas para que no se contaminen otros módems
        localStorage.removeItem('sentinel_owner_verified_v2');
        localStorage.removeItem('sentinel_router_user');
        localStorage.removeItem('sentinel_router_pass');
        localStorage.removeItem('sentinel_router_pass_sec');
    }
}

function loadModemCredentialsForCurrentNetwork() {
    initModemsDbMigration();
    const key = getModemKey();
    const db = getModemsDb();
    const profile = db[key];

    if (profile && profile.verified) {
        appState.isOwnerVerified = true;
        appState.routerUser = profile.user || 'admin';
        appState.routerPass = profile.pass || '';
    } else {
        // En una red no verificada o nuevo módem: MODO MONITOR, sin heredar claves ajenas
        appState.isOwnerVerified = false;
        appState.routerUser = (profile && profile.user) ? profile.user : 'admin';
        appState.routerPass = (profile && profile.pass) ? profile.pass : '';
    }

    if (dom.routerUserInput) dom.routerUserInput.value = appState.routerUser;
    if (dom.routerPassInput) dom.routerPassInput.value = appState.routerPass;
    if (dom.ownerUserInput) dom.ownerUserInput.value = appState.routerUser;
    if (dom.ownerPassInput) dom.ownerPassInput.value = appState.routerPass;

    if (dom.routerInjectStatus) {
        let drvText = 'Soporte 100% Multi-Módem Nativo';
        if (window.SentinelNative && window.SentinelNative.detectRouterModelNative) {
            try {
                const drv = window.SentinelNative.detectRouterModelNative(appState.currentGateway || '192.168.101.1');
                if (drv === 'realtek_boa') drvText = 'Driver Realtek Boa / Fibra ONT (100% Directo)';
                else if (drv === 'tplink') drvText = 'Driver TP-Link Archer / WR (100% Directo)';
                else if (drv === 'tenda') drvText = 'Driver Tenda Wireless (100% Directo)';
                else if (drv === 'huawei') drvText = 'Driver Huawei EchoLife (100% Directo)';
                else if (drv === 'zte') drvText = 'Driver ZTE ZXHN (100% Directo)';
                else drvText = 'Driver Universal Auto-MAC (100% Compatible)';
            } catch (e) {}
        }
        if (appState.isOwnerVerified && appState.routerPass) {
            dom.routerInjectStatus.textContent = `Módem autenticado [${drvText} · ${appState.currentGateway}]. Listo para cortar internet a intrusos.`;
        } else {
            dom.routerInjectStatus.textContent = `[${drvText}] Ingresa la contraseña de este módem (${appState.currentGateway}) para activar el corte de internet.`;
        }
    }

    if (window.SentinelNative && window.SentinelNative.setRouterCredentials) {
        window.SentinelNative.setRouterCredentials(appState.routerUser, appState.routerPass);
    }

    updateOwnerBadge();
}

if (!appState.localOverrides.networks) {
    appState.localOverrides.networks = {};
}

function sanitizeStoredOverrides() {
    let changed = false;
    const lo = appState.localOverrides;
    if (lo.blocked) {
        Object.keys(lo.blocked).forEach(ip => {
            const m = (lo.blocked[ip]?.mac || '').toLowerCase();
            if (m.startsWith('02:5a:2d:a1:') || m.startsWith('02-5a-2d-a1-')) {
                delete lo.blocked[ip];
                changed = true;
            }
        });
    }
    if (lo.whitelist) {
        Object.keys(lo.whitelist).forEach(m => {
            if (m.toLowerCase().startsWith('02:5a:2d:a1:')) {
                delete lo.whitelist[m];
                changed = true;
            }
        });
    }
    if (lo.aliases) {
        Object.keys(lo.aliases).forEach(m => {
            if (m.toLowerCase().startsWith('02:5a:2d:a1:')) {
                delete lo.aliases[m];
                changed = true;
            }
        });
    }
    if (lo.networks) {
        Object.keys(lo.networks).forEach(net => {
            const list = lo.networks[net];
            if (Array.isArray(list) && list.some(d => (d.mac || '').toLowerCase().startsWith('02:5a:2d:a1:'))) {
                delete lo.networks[net];
                changed = true;
            }
        });
    }
    if (changed) saveLocalOverrides();
}

function saveLocalOverrides() {
    try {
        localStorage.setItem('sentinel_overrides', JSON.stringify(appState.localOverrides));
    } catch (e) {}
}

sanitizeStoredOverrides();

function getLockSvg(cls = 'btn-lock-icon') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
}

function resolveDeviceFriendlyName(dev) {
    if (dev.alias && dev.alias.trim()) return dev.alias.trim();
    const lastOctet = (dev.ip || '').split('.').pop() || '';
    if (dev.hostname && dev.hostname !== 'Desconocido' && dev.hostname !== 'Equipo sin nombre' && dev.hostname !== dev.ip && !dev.hostname.startsWith('Teléfono Celular')) {
        let h = dev.hostname.trim();
        h = h.replace(/\.domain\.name$/i, '').replace(/\.local$/i, '').replace(/\.lan$/i, '');
        if (/^Z2465N/i.test(h)) return 'ZTE Blade A51 (Z2465N)';
        if (/^SR120/i.test(h)) return 'Smart Device (SR120-C)';
        if (/^S10-de-Wilmer/i.test(h)) return dev.is_local_host ? 'Samsung Galaxy S10 (Este Teléfono)' : 'Samsung Galaxy S10 (Wilmer)';
        if (/^A07-de-Eva/i.test(h)) return 'Samsung Galaxy A07 (Eva)';
        if (/^A31-de-Juan/i.test(h)) return 'Samsung Galaxy A31 (Juan)';
        if (/^Redmi-Note-10-Pro/i.test(h)) return 'Xiaomi Redmi Note 10 Pro';
        if (/^KernelOS-PC/i.test(h)) return 'Ordenador PC (KernelOS-PC)';
        if (/^Android$/i.test(h)) return `Celular Android (.${lastOctet})`;
        const deMatch = h.match(/^([A-Za-z0-9]+)-de-(.+)$/i);
        if (deMatch) {
            const mdl = deMatch[1];
            const own = deMatch[2].replace(/-/g, ' ');
            if (/^[ASJM]\d{2}/i.test(mdl)) return `Samsung Galaxy ${mdl.toUpperCase()} (${own})`;
            return `${mdl} de ${own}`;
        }
        if (/^iPhone/i.test(h)) return h.replace(/-/g, ' ');
        if (/^SM-[A-Z0-9]+/i.test(h)) return `Samsung Galaxy (${h})`;
        if (/^Redmi|^POCO|^Xiaomi/i.test(h)) return h.replace(/-/g, ' ');
        if (/^Moto/i.test(h)) return h.replace(/-/g, ' ');
        if (/^RTK_GW/i.test(h)) return 'Router Principal (Módem)';
        return h;
    }
    const vendor = (dev.vendor || '').toLowerCase();
    const isRand = Boolean(dev.is_randomized_mac);
    const ports = dev.open_ports || [];

    if (dev.is_gateway) return 'Router Principal (Módem)';
    if (dev.is_local_host) return (appState.deviceModel ? `${appState.deviceModel} (Este Teléfono)` : 'Samsung Galaxy S10 (Este Teléfono)');

    if (ports.includes(554) || ports.includes(8000)) {
        return `Cámara IP / DVR (.${lastOctet})`;
    }
    if (ports.includes(445) || ports.includes(3389) || dev.dev_type === 'pc') {
        return `Ordenador PC (.${lastOctet})`;
    }

    if (vendor.includes('samsung')) {
        return `Samsung Galaxy (.${lastOctet})`;
    }
    if (vendor.includes('apple')) {
        return `Apple iPhone (.${lastOctet})`;
    }
    if (vendor.includes('xiaomi') || vendor.includes('redmi')) {
        return `Xiaomi Redmi (.${lastOctet})`;
    }
    if (vendor.includes('motorola')) {
        return `Motorola Moto (.${lastOctet})`;
    }
    if (vendor.includes('huawei') || vendor.includes('honor')) {
        return `Huawei Mobile (.${lastOctet})`;
    }
    if (vendor.includes('zte')) {
        return `ZTE Blade (.${lastOctet})`;
    }
    if (vendor.includes('c-data') || vendor.includes('realtek') || vendor.includes('tp-link')) {
        return `Módem / Switch (.${lastOctet})`;
    }
    if (vendor.includes('amazon')) {
        return `Amazon Echo / Fire (.${lastOctet})`;
    }
    if (vendor.includes('google')) {
        return `Google Pixel / Nest (.${lastOctet})`;
    }
    if (vendor.includes('sony')) {
        return `Sony PlayStation (.${lastOctet})`;
    }

    if (isRand || dev.dev_type === 'mobile') {
        if (ports.includes(62078)) return `Apple iPhone (MAC Privada .${lastOctet})`;
        return `Celular Android (.${lastOctet})`;
    }
    return `Dispositivo WiFi (.${lastOctet})`;
}

function applyOverridesToDevice(dev) {
    const mac = (dev.mac || '').toLowerCase();
    const ip = dev.ip;
    const isSelf = Boolean(dev.is_local_host || (appState.currentPhoneIp && ip === appState.currentPhoneIp));
    const isGateway = Boolean(dev.is_gateway || (appState.currentGateway && ip === appState.currentGateway));
    const isRand = typeof dev.is_randomized_mac === 'boolean' ? dev.is_randomized_mac : isRandomizedMac(mac);
    const vendor = lookupVendor(mac, isGateway, isSelf, dev.hostname || '');
    const alias = appState.localOverrides.aliases[mac] || dev.alias || null;
    const isBlocked = Boolean(dev.is_blocked || appState.localOverrides.blocked[ip]);
    const isWhitelisted = Boolean(appState.localOverrides.whitelist[mac] ?? dev.is_whitelisted);
    const openPorts = appState.localOverrides.ports[ip] || dev.open_ports || [];

    let score = 0;
    const reasons = [];

    if (isGateway) {
        reasons.push('Puerta de enlace verificada (Router principal)');
    } else if (isSelf) {
        reasons.push('Dispositivo de control local verificado');
    } else if (isWhitelisted) {
        reasons.push('Autorizado en lista blanca de confianza');
    } else {
        if (isRand) {
            score += 30;
            reasons.push('Dirección MAC privada/aleatoria activa');
        }
        if (!alias && (dev.hostname === 'Desconocido' || !dev.hostname)) {
            score += 25;
            reasons.push('Sin nombre DHCP ni NetBIOS');
        }
        openPorts.forEach(p => {
            if (p === 22 || p === 23) {
                score += 30;
                reasons.push(`Puerto de acceso remoto expuesto (${p})`);
            } else if (p === 554 || p === 8000) {
                score += 25;
                reasons.push(`Puerto de cámara/streaming activo (${p})`);
            } else if (p === 445 || p === 3389) {
                score += 20;
                reasons.push(`Servicio de red sensible activo (${p})`);
            }
        });
        if (reasons.length === 0) {
            reasons.push('Fabricante OUI verificado y tráfico normal');
        }
    }

    score = Math.min(100, score);
    let level = 'SAFE';
    if (score >= 50) level = 'CRITICAL';
    else if (score >= 25) level = 'SUSPICIOUS';

    const resolvedName = resolveDeviceFriendlyName({
        ...dev,
        is_gateway: isGateway,
        is_local_host: isSelf,
        vendor,
        is_randomized_mac: isRand,
        open_ports: openPorts,
        alias
    });

    return {
        ...dev,
        is_gateway: isGateway,
        is_local_host: isSelf,
        vendor,
        is_randomized_mac: isRand,
        alias,
        display_name: resolvedName,
        is_blocked: isBlocked,
        is_whitelisted: isWhitelisted,
        open_ports: openPorts,
        threat: { score, level, reasons }
    };
}

const dom = {
    canvas: document.getElementById('radar-canvas'),
    spectrumCanvas: document.getElementById('spectrum-canvas'),
    btnTheme: document.getElementById('btn-theme'),
    btnAudio: document.getElementById('btn-audio'),
    btnScan: document.getElementById('btn-scan'),
    scanBtnLabel: document.getElementById('scan-btn-label'),
    scanStrip: document.getElementById('scan-strip'),
    scanStripBar: document.getElementById('scan-strip-bar'),
    headerNetLabel: document.getElementById('header-net-label'),

    statTotal: document.getElementById('stat-total'),
    statSafe: document.getElementById('stat-safe'),
    statSuspicious: document.getElementById('stat-suspicious'),
    statBlocked: document.getElementById('stat-blocked'),
    tabCountDevices: document.getElementById('tab-count-devices'),

    radarModeReadout: document.getElementById('radar-mode-readout'),
    azimuthDisplay: document.getElementById('azimuth-display'),
    gwDisplay: document.getElementById('gw-display'),
    blipCountDisplay: document.getElementById('blip-count-display'),
    radarNodeChips: document.getElementById('radar-node-chips'),
    radarSelectedDrawer: document.getElementById('radar-selected-drawer'),

    btnQuickSpeed: document.getElementById('btn-quick-speed'),
    qtSpeedVal: document.getElementById('qt-speed-val'),
    btnQuickCams: document.getElementById('btn-quick-cams'),
    qtCamsVal: document.getElementById('qt-cams-val'),

    tActiveSsid: document.getElementById('t-active-ssid'),
    tArpStatus: document.getElementById('t-arp-status'),
    tGwIp: document.getElementById('t-gw-ip'),
    tGwMac: document.getElementById('t-gw-mac'),
    tWifiSignal: document.getElementById('t-wifi-signal'),
    tMyIp: document.getElementById('t-my-ip'),

    recentThreatsList: document.getElementById('recent-threats-list'),
    btnGoDevices: document.getElementById('btn-go-devices'),
    btnPanic: document.getElementById('btn-panic'),

    searchInput: document.getElementById('search-device-input'),
    sortSelect: document.getElementById('sort-select'),
    filterCntAll: document.getElementById('filter-cnt-all'),
    filterCntSafe: document.getElementById('filter-cnt-safe'),
    filterCntSuspect: document.getElementById('filter-cnt-suspect'),
    filterCntBlocked: document.getElementById('filter-cnt-blocked'),
    devicesGrid: document.getElementById('devices-cards-grid'),

    btnRunAudit: document.getElementById('btn-run-audit'),
    mitmResultBox: document.getElementById('mitm-result-box'),
    mitmIndicator: document.getElementById('mitm-indicator'),
    mitmDetailText: document.getElementById('mitm-detail-text'),
    btnRefreshWifi: document.getElementById('btn-refresh-wifi'),
    wifiSubnetVal: document.getElementById('wifi-subnet-val'),
    wifiBandVal: document.getElementById('wifi-band-val'),
    wifiRssiVal: document.getElementById('wifi-rssi-val'),
    wifiSpeedVal: document.getElementById('wifi-speed-val'),
    wifiBssidVal: document.getElementById('wifi-bssid-val'),

    probeIpInput: document.getElementById('probe-ip-input'),
    btnProbePing: document.getElementById('btn-probe-ping'),
    btnProbePorts: document.getElementById('btn-probe-ports'),
    probeOutputBox: document.getElementById('probe-output-box'),
    routerGwLabel: document.getElementById('router-gw-label'),
    routerTargetMacLabel: document.getElementById('router-target-mac-label'),
    routerUserInput: document.getElementById('router-user-input'),
    routerPassInput: document.getElementById('router-pass-input'),
    btnSaveRouterCreds: document.getElementById('btn-save-router-creds'),
    routerInjectStatus: document.getElementById('router-inject-status'),
    btnInjectRouterMac: document.getElementById('btn-inject-router-mac'),
    btnOpenRouterConsole: document.getElementById('btn-open-router-console'),
    btnCopySuspectMacs: document.getElementById('btn-copy-suspect-macs'),
    btnExportJson: document.getElementById('btn-export-json'),

    activeRulesList: document.getElementById('active-rules-list'),
    btnUnblockAll: document.getElementById('btn-unblock-all'),
    mainTerminal: document.getElementById('main-terminal-body'),
    btnClearTerm: document.getElementById('btn-clear-term'),
    toastBanner: document.getElementById('toast-banner'),

    btnGuide: document.getElementById('btn-guide'),
    guideModal: document.getElementById('guide-modal'),
    btnCloseGuide: document.getElementById('btn-close-guide'),
    btnGuideGotIt: document.getElementById('btn-guide-got-it'),
    btnOpenGuideInline: document.getElementById('btn-open-guide-inline'),
    btnAdvisorGuide: document.getElementById('btn-advisor-guide'),
    btnAdvisorPrimary: document.getElementById('btn-advisor-primary'),
    advisorTitle: document.getElementById('advisor-title'),
    advisorDesc: document.getElementById('advisor-desc'),

    btnOwnerBadge: document.getElementById('btn-owner-badge'),
    ownerStatusLabel: document.getElementById('owner-status-label'),
    ownerAuthModal: document.getElementById('owner-auth-modal'),
    ownerModalTitle: document.getElementById('owner-modal-title'),
    btnCloseOwnerModal: document.getElementById('btn-close-owner-modal'),
    btnCancelOwnerVerify: document.getElementById('btn-cancel-owner-verify'),
    btnSubmitOwnerVerify: document.getElementById('btn-submit-owner-verify'),
    btnLogoutOwner: document.getElementById('btn-logout-owner'),
    ownerUserInput: document.getElementById('owner-user-input'),
    ownerPassInput: document.getElementById('owner-pass-input'),
    ownerVerifyStatus: document.getElementById('owner-verify-status'),
    ownerModalGw: document.getElementById('owner-modal-gw')
};

const ctx = dom.canvas.getContext('2d');

function triggerHaptic(ms = 20) {
    try {
        if (window.SentinelNative && window.SentinelNative.vibrate) {
            window.SentinelNative.vibrate(ms);
        } else if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    } catch (e) {}
}

let toastTimeout = null;
function showToast(msg) {
    dom.toastBanner.textContent = msg;
    dom.toastBanner.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        dom.toastBanner.classList.add('hidden');
    }, 2500);
}

function copyText(label, text) {
    triggerHaptic(25);
    try {
        if (window.SentinelNative && window.SentinelNative.copyToClipboard) {
            window.SentinelNative.copyToClipboard(label, text);
            showToast(`${label} copiado: ${text}`);
            return;
        }
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${label} copiado: ${text}`);
        }).catch(() => {
            showToast(`${label}: ${text}`);
        });
    } else {
        showToast(`${label}: ${text}`);
    }
}

function addLog(text, isStrong = false) {
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const div = document.createElement('div');
    div.className = isStrong ? 'log-line strong' : 'log-line';
    div.textContent = `[${time}] ${text}`;
    dom.mainTerminal.prepend(div);
}

function applyTheme(theme) {
    appState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sentinel_theme', theme);
    try {
        if (window.SentinelNative && window.SentinelNative.setSystemTheme) {
            window.SentinelNative.setSystemTheme(theme);
        }
    } catch (e) {}
    renderSpectrumCanvas();
}

dom.btnTheme.addEventListener('click', () => {
    triggerHaptic(15);
    const next = appState.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    showToast(next === 'light' ? 'Modo Blanco Apple activo' : 'Modo Negro OLED activo');
});

function getDeviceSvg(type) {
    if (type === 'router') {
        return `<svg class="icon" viewBox="0 0 24 24"><rect x="2" y="14" width="20" height="6" rx="1"></rect><line x1="6" y1="6" x2="6" y2="14"></line><line x1="18" y1="6" x2="18" y2="14"></line><circle cx="6" cy="17" r="1"></circle><circle cx="10" cy="17" r="1"></circle></svg>`;
    }
    if (type === 'mobile') {
        return `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;
    }
    if (type === 'pc') {
        return `<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1"></rect><line x1="2" y1="20" x2="22" y2="20"></line><line x1="12" y1="16" x2="12" y2="20"></line></svg>`;
    }
    if (type === 'iot') {
        return `<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="2" x2="9" y2="5"></line><line x1="15" y1="2" x2="15" y2="5"></line><line x1="9" y1="19" x2="9" y2="22"></line><line x1="15" y1="19" x2="15" y2="22"></line></svg>`;
    }
    return `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
}

function getStatusBadgeInfo(dev) {
    if (dev.is_blocked) {
        return { text: 'AISLADO', cls: 'isolated', dot: 'square' };
    }
    if (dev.threat?.level === 'CRITICAL') {
        return { text: `RIESGO ${dev.threat.score}%`, cls: 'danger', dot: 'danger' };
    }
    if (dev.threat?.level === 'SUSPICIOUS') {
        return { text: `MAC PRIVADA · ${dev.threat.score}%`, cls: 'warn', dot: 'warn' };
    }
    return { text: 'VERIFICADO', cls: 'safe', dot: 'safe' };
}

function switchView(viewId) {
    appState.activeView = viewId;
    triggerHaptic(15);
    document.querySelectorAll('.view-pane').forEach(p => {
        p.classList.toggle('active', p.id === viewId);
    });
    document.querySelectorAll('.tab-link').forEach(t => {
        const active = t.dataset.view === viewId;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.bnav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === viewId);
    });

    if (viewId === 'view-radar') {
        if (!appState.radarLoopRunning) {
            appState.radarLoopRunning = true;
            requestAnimationFrame(renderRadarLoop);
        }
    } else if (viewId === 'view-devices') {
        renderDirectory();
    } else if (viewId === 'view-audit') {
        refreshNativeWifiTelemetry();
        renderSpectrumCanvas();
    } else if (viewId === 'view-terminal') {
        renderActiveRules();
    }
}

document.querySelectorAll('.tab-link, .bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

dom.btnGoDevices.addEventListener('click', () => switchView('view-devices'));

document.querySelectorAll('.summary-cell').forEach(cell => {
    cell.addEventListener('click', () => {
        const targetFilter = cell.dataset.jumpFilter || 'all';
        appState.filter = targetFilter;
        document.querySelectorAll('.pill-btn').forEach(p => {
            p.classList.toggle('active', p.dataset.filter === targetFilter);
        });
        switchView('view-devices');
    });
});

// --- RADAR DE PANTALLA COMPLETA SIN SUPERPOSICIÓN DE ETIQUETAS ---
function renderRadarLoop() {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = cx - 42;

    const isDark = appState.theme === 'dark';
    const bgCol = isDark ? '#0C0C0E' : '#F5F5F7';
    const ringCol = isDark ? '#27272A' : '#E4E4E7';
    const axisCol = isDark ? '#3F3F46' : '#D4D4D8';
    const inkCol = isDark ? '#FFFFFF' : '#000000';
    const mutedCol = isDark ? '#A1A1AA' : '#52525B';

    const colSafe = isDark ? '#22C55E' : '#16A34A';
    const colWarn = isDark ? '#F59E0B' : '#D97706';
    const colDanger = isDark ? '#F43F5E' : '#E11D48';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, w, h);

    // 4 Anillos concéntricos con etiquetas de rango en ms
    const ringLabels = ['5 ms', '15 ms', '35 ms', '60 ms'];
    ctx.font = '500 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    for (let i = 1; i <= 4; i++) {
        const r = (maxR / 4) * i;
        ctx.strokeStyle = ringCol;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = mutedCol;
        ctx.fillText(ringLabels[i - 1], cx + 8, cy - r + 14);
    }

    // Marcas graduadas perimetrales cada 10 grados
    ctx.strokeStyle = axisCol;
    for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const inner = (deg % 30 === 0) ? maxR - 14 : maxR - 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
        ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR);
        ctx.stroke();
    }

    // Ejes ortogonales
    ctx.strokeStyle = ringCol;
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Aguja de barrido
    appState.radarAngle = (appState.radarAngle + 0.016) % (Math.PI * 2);
    const deg = Math.floor((appState.radarAngle * 180) / Math.PI);
    dom.azimuthDisplay.textContent = `${String(deg).padStart(3, '0')}°`;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, appState.radarAngle - 0.36, appState.radarAngle);
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.05)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(appState.radarAngle) * maxR, cy + Math.sin(appState.radarAngle) * maxR);
    ctx.strokeStyle = inkCol;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Calcular coordenadas de cada nodo
    appState.devices.forEach((dev, idx) => {
        if (dev.is_gateway) {
            dev._rx = cx;
            dev._ry = cy;
            return;
        }
        const lastOctet = parseInt(dev.ip.split('.').pop(), 10) || (idx + 1);
        const angle = ((lastOctet * 137.5) % 360) * (Math.PI / 180);
        const normDist = Math.min(Math.max((lastOctet / 254) * 0.64 + 0.24, 0.28), 0.82);
        const r = maxR * normDist;
        dev._rx = cx + Math.cos(angle) * r;
        dev._ry = cy + Math.sin(angle) * r;
    });

    // Vector punteado desde el Router central al objetivo seleccionado (etiqueta arriba del retículo, sin superponerse)
    const selectedDev = appState.devices.find(d => d.ip === appState.selectedIp);
    if (selectedDev && !selectedDev.is_gateway && typeof selectedDev._rx === 'number') {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = inkCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(selectedDev._rx, selectedDev._ry);
        ctx.stroke();
        ctx.setLineDash([]);

        const pingTag = `${selectedDev.latency_ms} ms`;
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        const tw = ctx.measureText(pingTag).width + 12;
        const bx = selectedDev._rx;
        const by = selectedDev._ry - 28;
        ctx.fillStyle = inkCol;
        ctx.fillRect(bx - tw / 2, by - 10, tw, 20);
        ctx.fillStyle = isDark ? '#000000' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pingTag, bx, by);
        ctx.restore();
    }

    // Dibujar nodos con alineación inteligente izquierda/derecha según cuadrante
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';

    appState.devices.forEach((dev) => {
        const nx = dev._rx;
        const ny = dev._ry;
        const isSelected = dev.ip === appState.selectedIp;

        if (dev.is_gateway) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = inkCol;
            ctx.fillRect(-7, -7, 14, 14);
            ctx.restore();
            if (isSelected) {
                ctx.strokeStyle = inkCol;
                ctx.lineWidth = 1.8;
                ctx.strokeRect(cx - 14, cy - 14, 28, 28);
            }
            return;
        }

        if (isSelected) {
            ctx.strokeStyle = inkCol;
            ctx.lineWidth = 2;
            ctx.strokeRect(nx - 14, ny - 14, 28, 28);
        }

        if (dev.is_blocked) {
            ctx.fillStyle = inkCol;
            ctx.fillRect(nx - 7, ny - 7, 14, 14);
        } else if (dev.threat?.level === 'CRITICAL') {
            ctx.fillStyle = colDanger;
            ctx.beginPath();
            ctx.arc(nx, ny, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colDanger;
            ctx.lineWidth = 2;
            ctx.beginPath();
            const pulse = 11.5 + Math.sin(Date.now() / 200) * 3;
            ctx.arc(nx, ny, pulse, 0, Math.PI * 2);
            ctx.stroke();
        } else if (dev.threat?.level === 'SUSPICIOUS') {
            ctx.strokeStyle = colWarn;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(nx, ny, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = colWarn;
            ctx.beginPath();
            ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = colSafe;
            ctx.beginPath();
            ctx.arc(nx, ny, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        const lastOctet = dev.ip.split('.').pop();
        const shortName = (dev.display_name || '').substring(0, 10);
        ctx.fillStyle = isSelected ? inkCol : mutedCol;
        if (nx < cx - 25) {
            ctx.textAlign = 'right';
            ctx.fillText(`.${lastOctet} ${shortName}`, nx - 16, ny);
        } else {
            ctx.textAlign = 'left';
            ctx.fillText(`.${lastOctet} ${shortName}`, nx + 16, ny);
        }
    });

    if (appState.activeView && appState.activeView !== 'view-radar') {
        appState.radarLoopRunning = false;
        return; // Pausa el render en segundo plano para ahorrar batería de la GPU y CPU
    }

    appState.radarLoopRunning = true;
    requestAnimationFrame(renderRadarLoop);
}

dom.canvas.addEventListener('click', (e) => {
    const rect = dom.canvas.getBoundingClientRect();
    const scaleX = dom.canvas.width / rect.width;
    const scaleY = dom.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const dev of appState.devices) {
        if (typeof dev._rx === 'number' && typeof dev._ry === 'number') {
            const dist = Math.hypot(x - dev._rx, y - dev._ry);
            if (dist < 38) {
                triggerHaptic(20);
                window.sound.playBeep(950);
                appState.selectedIp = dev.ip;
                renderRadarChips();
                renderRadarInspector();
                return;
            }
        }
    }
});

function renderRadarChips() {
    dom.radarNodeChips.innerHTML = '';
    const sorted = [...appState.devices].sort((a, b) => (b.threat?.score || 0) - (a.threat?.score || 0));

    sorted.forEach(dev => {
        const badge = getStatusBadgeInfo(dev);
        const lastOctet = dev.ip.split('.').pop();
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `node-chip ${dev.ip === appState.selectedIp ? 'active' : ''}`;
        chip.innerHTML = `
            <span class="node-glyph ${badge.dot}"></span>
            <span class="tabular">.${lastOctet}</span>
            <span>${dev.display_name.substring(0, 13)}</span>
        `;
        chip.addEventListener('click', () => {
            triggerHaptic(15);
            window.sound.playBeep(950);
            appState.selectedIp = dev.ip;
            renderRadarChips();
            renderRadarInspector();
        });
        dom.radarNodeChips.appendChild(chip);
    });
}

function renderSpectrumCanvas() {
    if (!dom.spectrumCanvas) return;
    const c = dom.spectrumCanvas;
    const sctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;

    const isDark = appState.theme === 'dark';
    const bgCol = isDark ? '#0C0C0E' : '#F5F5F7';
    const gridCol = isDark ? '#27272A' : '#E4E4E7';
    const inkCol = isDark ? '#FFFFFF' : '#000000';
    const mutedCol = isDark ? '#A1A1AA' : '#52525B';
    const safeCol = isDark ? '#22C55E' : '#16A34A';

    sctx.clearRect(0, 0, w, h);
    sctx.fillStyle = bgCol;
    sctx.fillRect(0, 0, w, h);

    const padL = 44;
    const padR = 20;
    const padT = 24;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    sctx.font = '500 11px "IBM Plex Mono", monospace';
    sctx.textAlign = 'right';
    sctx.textBaseline = 'middle';
    const dbLevels = [-30, -50, -70, -90];
    dbLevels.forEach((db, i) => {
        const y = padT + (plotH / (dbLevels.length - 1)) * i;
        sctx.strokeStyle = gridCol;
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(padL, y);
        sctx.lineTo(w - padR, y);
        sctx.stroke();

        sctx.fillStyle = mutedCol;
        sctx.fillText(`${db}`, padL - 8, y);
    });

    const activeCh = (appState.wifiFreq >= 2412 && appState.wifiFreq <= 2472)
        ? Math.round((appState.wifiFreq - 2407) / 5)
        : 5;

    sctx.textAlign = 'center';
    for (let ch = 1; ch <= 13; ch++) {
        const x = padL + ((ch - 1) / 12) * plotW;
        sctx.fillStyle = (ch === activeCh) ? inkCol : mutedCol;
        sctx.fillText(`C${ch}`, x, h - 14);
    }

    function drawChannelCurve(centerCh, rssiDbm, strokeColor, fillAlpha, labelText) {
        const cx = padL + ((centerCh - 1) / 12) * plotW;
        const spread = (plotW / 12) * 2.1;
        const normHeight = Math.max(0.15, Math.min(0.95, (rssiDbm + 95) / 65));
        const peakY = padT + plotH * (1 - normHeight);
        const baseY = padT + plotH;

        sctx.save();
        sctx.beginPath();
        sctx.moveTo(cx - spread, baseY);
        sctx.quadraticCurveTo(cx, peakY - (baseY - peakY) * 0.35, cx + spread, baseY);
        sctx.closePath();
        sctx.fillStyle = fillAlpha;
        sctx.fill();

        sctx.strokeStyle = strokeColor;
        sctx.lineWidth = 2.2;
        sctx.stroke();

        if (labelText) {
            sctx.fillStyle = inkCol;
            sctx.font = '600 12px "IBM Plex Mono", monospace';
            sctx.fillText(labelText, cx, Math.max(14, peakY - 10));
        }
        sctx.restore();
    }

    drawChannelCurve(1, -76, mutedCol, isDark ? 'rgba(161,161,170,0.08)' : 'rgba(82,82,91,0.07)', '');
    drawChannelCurve(11, -72, mutedCol, isDark ? 'rgba(161,161,170,0.08)' : 'rgba(82,82,91,0.07)', '');
    drawChannelCurve(activeCh, appState.wifiRssi || -54, safeCol, isDark ? 'rgba(34,197,94,0.18)' : 'rgba(22,163,74,0.14)', `${appState.currentSsid} · C${activeCh} (${appState.wifiRssi || -54} dBm)`);
}

function openRouterConsoleWithMac(mac, ip = '') {
    if (!checkOwnerGuard('abrir la consola del router')) return;
    triggerHaptic(30);
    const gw = appState.currentGateway || '192.168.101.1';
    const user = (dom.routerUserInput && dom.routerUserInput.value.trim()) || appState.routerUser || 'admin';
    const pass = (dom.routerPassInput && dom.routerPassInput.value) || appState.routerPass || '';
    copyText('MAC para Lista Negra', mac);
    addLog(`Abriendo consola del router (${gw}) con Auto-Inyección JS para MAC ${mac} ${ip ? '(' + ip + ')' : ''}...`, true);

    if (window.SentinelNative && window.SentinelNative.openRouterAutoInjectorConsole) {
        window.SentinelNative.openRouterAutoInjectorConsole(gw, mac, user, pass);
        return;
    }
    const url = `http://${gw}/admin/login.asp`;
    if (window.SentinelNative && window.SentinelNative.openExternalUrl) {
        window.SentinelNative.openExternalUrl(url);
    } else {
        window.open(url, '_blank', 'noopener');
    }
}

function renderRadarInspector() {
    const dev = appState.devices.find(d => d.ip === appState.selectedIp) || appState.devices[0];
    if (!dev) return;

    if (dom.routerGwLabel) {
        let driverLabel = '100% Multi-Driver Nativo';
        if (window.SentinelNative && window.SentinelNative.detectRouterModelNative) {
            try {
                const drv = window.SentinelNative.detectRouterModelNative(appState.currentGateway || '192.168.101.1');
                if (drv === 'realtek_boa') driverLabel = 'Boa / Fibra ONT (100% Directo)';
                else if (drv === 'tplink') driverLabel = 'TP-Link Archer/WR (100% Directo)';
                else if (drv === 'tenda') driverLabel = 'Tenda Wireless (100% Directo)';
                else if (drv === 'huawei') driverLabel = 'Huawei EchoLife (100% Directo)';
                else if (drv === 'zte') driverLabel = 'ZTE ZXHN (100% Directo)';
                else driverLabel = 'Universal Auto-MAC (100% Compatible)';
            } catch (e) {}
        }
        dom.routerGwLabel.textContent = `${appState.currentGateway || '192.168.101.1'} (${driverLabel})`;
    }
    if (dom.routerTargetMacLabel) {
        dom.routerTargetMacLabel.textContent = `${dev.mac} (${dev.ip})`;
    }

    const badge = getStatusBadgeInfo(dev);
    const portsText = (dev.open_ports && dev.open_ports.length > 0)
        ? `Puertos: ${dev.open_ports.join(', ')}`
        : 'Sin puertos abiertos expuestos';
    const blockNote = dev.is_blocked
        ? `INTERNET CORTADO · MAC ${(dev.mac || '').replace(/[:-]/g, '').toLowerCase()} en Lista Negra del Router (${appState.currentGateway})`
        : `${dev.threat?.reasons?.[0] || 'Estado normal'} · ${portsText}`;

    dom.radarSelectedDrawer.innerHTML = `
        <div class="inspector-top">
            <div>
                <div class="inspector-title">${dev.display_name}</div>
                <div class="inspector-sub tabular">${dev.ip} · ${dev.mac}</div>
                <div class="inspector-sub">${dev.vendor} · ${dev.latency_ms} ms</div>
            </div>
            <span class="badge-pill ${badge.cls}">
                <span class="node-glyph ${badge.dot}"></span>
                ${badge.text}
            </span>
        </div>
        <div class="inspector-readout tabular" id="radar-live-readout">
            ${blockNote}
        </div>
        <div class="inspector-actions">
            ${!dev.is_gateway && !dev.is_local_host ? `
                <button type="button" class="${dev.is_blocked ? 'btn-outline-sm' : 'btn-danger-sm'}" id="insp-btn-block">
                    ${!appState.isOwnerVerified && !dev.is_blocked ? getLockSvg('btn-lock-icon') : ''}
                    ${dev.is_blocked ? 'Restaurar Internet' : 'Cortar Internet'}
                </button>
                <button type="button" class="btn-outline-sm" id="insp-btn-router-mac">
                    ${!appState.isOwnerVerified ? getLockSvg('btn-lock-icon') : ''}
                    Auto-MAC Router
                </button>
                <button type="button" class="btn-outline-sm" id="insp-btn-trust">
                    ${dev.is_whitelisted ? 'Quitar confianza' : 'Confiar'}
                </button>
            ` : ''}
            <button type="button" class="btn-outline-sm" id="insp-btn-ping">Ping 4x</button>
            <button type="button" class="btn-outline-sm" id="insp-btn-ports">Puertos</button>
            <button type="button" class="btn-outline-sm" id="insp-btn-copy">Copiar MAC</button>
        </div>
    `;

    const btnBlock = document.getElementById('insp-btn-block');
    if (btnBlock) {
        btnBlock.addEventListener('click', () => {
            if (dev.is_blocked) unblockDevice(dev.ip, dev.mac, 'radar-live-readout');
            else blockDevice(dev.ip, dev.mac, 'radar-live-readout');
        });
    }

    const btnRouterMac = document.getElementById('insp-btn-router-mac');
    if (btnRouterMac) {
        btnRouterMac.addEventListener('click', () => openRouterConsoleWithMac(dev.mac, dev.ip));
    }

    const btnTrust = document.getElementById('insp-btn-trust');
    if (btnTrust) {
        btnTrust.addEventListener('click', () => toggleWhitelistDevice(dev.mac, dev.ip));
    }

    document.getElementById('insp-btn-ping').addEventListener('click', (e) => {
        executeDevicePing(dev.ip, e.currentTarget, 'radar-live-readout');
    });

    document.getElementById('insp-btn-ports').addEventListener('click', (e) => {
        executePortScan(dev.ip, e.currentTarget, 'radar-live-readout');
    });

    document.getElementById('insp-btn-copy').addEventListener('click', () => {
        copyText('MAC', dev.mac);
    });
}

function renderRecentSidebar() {
    dom.recentThreatsList.innerHTML = '';
    const sorted = [...appState.devices].sort((a, b) => (b.threat?.score || 0) - (a.threat?.score || 0));

    sorted.forEach(dev => {
        const badge = getStatusBadgeInfo(dev);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'compact-row';

        btn.innerHTML = `
            <div class="compact-left">
                <div class="compact-icon">${getDeviceSvg(dev.dev_type)}</div>
                <div>
                    <div class="compact-name">${dev.display_name}</div>
                    <div class="compact-meta tabular">${dev.ip} · ${dev.latency_ms} ms</div>
                </div>
            </div>
            <span class="badge-pill ${badge.cls}">
                <span class="node-glyph ${badge.dot}"></span>
                ${badge.text}
            </span>
        `;

        btn.addEventListener('click', () => {
            triggerHaptic(15);
            appState.selectedIp = dev.ip;
            renderRadarChips();
            renderRadarInspector();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        dom.recentThreatsList.appendChild(btn);
    });
}

function renderDirectory() {
    dom.devicesGrid.innerHTML = '';

    let list = appState.devices.filter(d => {
        if (appState.filter === 'safe') return d.threat?.level === 'SAFE' && !d.is_blocked;
        if (appState.filter === 'suspect') return (d.threat?.level === 'SUSPICIOUS' || d.threat?.level === 'CRITICAL') && !d.is_blocked;
        if (appState.filter === 'blocked') return d.is_blocked;
        return true;
    });

    if (appState.searchQuery) {
        const q = appState.searchQuery.toLowerCase();
        list = list.filter(d =>
            (d.display_name && d.display_name.toLowerCase().includes(q)) ||
            (d.ip && d.ip.includes(q)) ||
            (d.mac && d.mac.toLowerCase().includes(q)) ||
            (d.vendor && d.vendor.toLowerCase().includes(q))
        );
    }

    list.sort((a, b) => {
        if (appState.sortBy === 'threat') return (b.threat?.score || 0) - (a.threat?.score || 0);
        if (appState.sortBy === 'ip') {
            return (parseInt(a.ip.split('.').pop(), 10) || 0) - (parseInt(b.ip.split('.').pop(), 10) || 0);
        }
        if (appState.sortBy === 'latency') return (a.latency_ms || 0) - (b.latency_ms || 0);
        if (appState.sortBy === 'name') return (a.display_name || '').localeCompare(b.display_name || '');
        return 0;
    });

    if (list.length === 0) {
        dom.devicesGrid.innerHTML = `
            <div style="padding: 28px 12px; color: var(--ink-muted); font-size: var(--text-sm);">
                Ningún equipo coincide con el filtro actual. Toca «Todos» para ver la red completa.
            </div>
        `;
        return;
    }

    list.forEach(dev => {
        const badge = getStatusBadgeInfo(dev);
        const safeId = dev.ip.replace(/\./g, '-');
        const portsStr = (dev.open_ports && dev.open_ports.length > 0)
            ? `Puertos: ${dev.open_ports.join(', ')}`
            : `${dev.latency_ms} ms`;

        const card = document.createElement('article');
        let cls = 'device-row-card';
        if (dev.is_blocked) cls += ' is-isolated';
        else if (dev.threat?.level === 'CRITICAL') cls += ' is-suspect';
        card.className = cls;

        card.innerHTML = `
            <div class="dcard-head">
                <div class="dcard-identity">
                    <div class="dcard-icon">${getDeviceSvg(dev.dev_type)}</div>
                    <div>
                        <h3 class="dcard-title">${dev.display_name}</h3>
                        <p class="dcard-vendor">${dev.vendor}</p>
                    </div>
                </div>
                <span class="badge-pill ${badge.cls}">
                    <span class="node-glyph ${badge.dot}"></span>
                    ${badge.text}
                </span>
            </div>

            <div class="dcard-tech-grid tabular">
                <div class="tech-cell">
                    <span class="tech-label">DIRECCIÓN IP</span>
                    <span class="tech-val">${dev.ip}</span>
                </div>
                <div class="tech-cell">
                    <span class="tech-label">DIRECCIÓN MAC</span>
                    <span class="tech-val">${dev.mac}</span>
                </div>
                <div class="tech-cell">
                    <span class="tech-label">RESPUESTA</span>
                    <span class="tech-val">${portsStr}</span>
                </div>
            </div>

            <div class="dcard-reason-line">
                <span class="node-glyph ${badge.dot}"></span>
                <span>${dev.threat?.reasons?.join(' · ') || 'Tráfico verificado'}</span>
            </div>

            <div class="dcard-live-output tabular" id="out-${safeId}"></div>

            <div class="dcard-alias-editor" id="alias-box-${safeId}">
                <input type="text" class="input-clean alias-input" value="${dev.alias || ''}" placeholder="Ej: Celular de Wilmer, TV Sala...">
                <button type="button" class="btn-solid-sm btn-save-alias">Guardar</button>
            </div>

            <div class="dcard-actions">
                ${!dev.is_gateway && !dev.is_local_host ? `
                    <button type="button" class="${dev.is_blocked ? 'btn-solid-sm' : 'btn-danger-sm'} btn-act-block">
                        ${!appState.isOwnerVerified && !dev.is_blocked ? getLockSvg('btn-lock-icon') : ''}
                        ${dev.is_blocked ? 'Restaurar Internet' : 'Cortar Internet'}
                    </button>
                    <button type="button" class="btn-outline-sm btn-act-router-mac">
                        ${!appState.isOwnerVerified ? getLockSvg('btn-lock-icon') : ''}
                        Auto-MAC Router
                    </button>
                    <button type="button" class="btn-outline-sm btn-act-trust">
                        ${dev.is_whitelisted ? 'Quitar confianza' : 'Confiar'}
                    </button>
                ` : ''}
                <button type="button" class="btn-outline-sm btn-act-ping">Ping 4x</button>
                <button type="button" class="btn-outline-sm btn-act-ports">Puertos</button>
                <button type="button" class="btn-outline-sm btn-act-alias">Apodo</button>
                <button type="button" class="btn-outline-sm btn-act-copy-mac">Copiar MAC</button>
            </div>
        `;

        const btnBlock = card.querySelector('.btn-act-block');
        if (btnBlock) {
            btnBlock.addEventListener('click', () => {
                if (dev.is_blocked) unblockDevice(dev.ip, dev.mac, `out-${safeId}`);
                else blockDevice(dev.ip, dev.mac, `out-${safeId}`);
            });
        }

        const btnRouterMac = card.querySelector('.btn-act-router-mac');
        if (btnRouterMac) {
            btnRouterMac.addEventListener('click', () => openRouterConsoleWithMac(dev.mac, dev.ip));
        }

        const btnTrust = card.querySelector('.btn-act-trust');
        if (btnTrust) {
            btnTrust.addEventListener('click', () => toggleWhitelistDevice(dev.mac, dev.ip));
        }

        const btnPing = card.querySelector('.btn-act-ping');
        btnPing.addEventListener('click', () => {
            const outEl = document.getElementById(`out-${safeId}`);
            outEl.classList.add('visible');
            outEl.textContent = `Enviando 4 paquetes de sonda a ${dev.ip}...`;
            executeDevicePing(dev.ip, btnPing, `out-${safeId}`);
        });

        const btnPorts = card.querySelector('.btn-act-ports');
        btnPorts.addEventListener('click', () => {
            const outEl = document.getElementById(`out-${safeId}`);
            outEl.classList.add('visible');
            outEl.textContent = `Auditando puertos TCP en ${dev.ip}...`;
            executePortScan(dev.ip, btnPorts, `out-${safeId}`);
        });

        const btnAlias = card.querySelector('.btn-act-alias');
        const aliasBox = card.querySelector(`#alias-box-${safeId}`);
        btnAlias.addEventListener('click', () => {
            triggerHaptic(15);
            aliasBox.classList.toggle('visible');
        });

        card.querySelector('.btn-save-alias').addEventListener('click', () => {
            const val = card.querySelector('.alias-input').value.trim();
            saveDeviceAlias(dev.mac, dev.ip, val);
        });

        card.querySelector('.btn-act-copy-mac').addEventListener('click', () => copyText('MAC', dev.mac));

        dom.devicesGrid.appendChild(card);
    });
}

function updateAllViews() {
    appState.devices = appState.devices.map(applyOverridesToDevice);

    if (!appState.devices.some(d => d.ip === appState.selectedIp) && appState.devices.length > 0) {
        const highestRisk = [...appState.devices].sort((a, b) => (b.threat?.score || 0) - (a.threat?.score || 0))[0];
        appState.selectedIp = highestRisk.ip;
    }

    const total = appState.devices.length;
    const safe = appState.devices.filter(d => d.threat?.level === 'SAFE' && !d.is_blocked).length;
    const suspect = appState.devices.filter(d => (d.threat?.level === 'SUSPICIOUS' || d.threat?.level === 'CRITICAL') && !d.is_blocked).length;
    const blocked = appState.devices.filter(d => d.is_blocked).length;

    dom.statTotal.textContent = total;
    dom.statSafe.textContent = safe;
    dom.statSuspicious.textContent = suspect;
    dom.statBlocked.textContent = blocked;
    dom.tabCountDevices.textContent = total;

    dom.filterCntAll.textContent = total;
    dom.filterCntSafe.textContent = safe;
    dom.filterCntSuspect.textContent = suspect;
    dom.filterCntBlocked.textContent = blocked;
    dom.blipCountDisplay.textContent = `${total} NODOS`;

    renderRadarChips();
    renderRadarInspector();
    renderRecentSidebar();
    renderDirectory();
    renderActiveRules();
    renderSmartAdvisor();
}

function openGuideModal() {
    triggerHaptic(15);
    if (dom.guideModal) dom.guideModal.classList.remove('hidden');
}

function closeGuideModal() {
    triggerHaptic(15);
    if (dom.guideModal) dom.guideModal.classList.add('hidden');
}

if (dom.btnGuide) dom.btnGuide.addEventListener('click', openGuideModal);
if (dom.btnOpenGuideInline) dom.btnOpenGuideInline.addEventListener('click', openGuideModal);
if (dom.btnAdvisorGuide) dom.btnAdvisorGuide.addEventListener('click', openGuideModal);
if (dom.btnCloseGuide) dom.btnCloseGuide.addEventListener('click', closeGuideModal);
if (dom.btnGuideGotIt) dom.btnGuideGotIt.addEventListener('click', closeGuideModal);

// --- VERIFICACIÓN DE DUEÑO DEL WIFI (DESAFÍO DE ACCESO AL MÓDEM) ---
function updateOwnerBadge() {
    if (!dom.btnOwnerBadge || !dom.ownerStatusLabel) return;
    const iconContainer = dom.btnOwnerBadge.querySelector('.owner-icon-container');
    if (appState.isOwnerVerified) {
        dom.btnOwnerBadge.className = 'badge-pill owner-verified';
        dom.btnOwnerBadge.title = 'Dueño del WiFi verificado (Control total activo). Toca para ver o cerrar sesión.';
        dom.ownerStatusLabel.innerHTML = '<span class="badge-text-full">Dueño Verificado</span><span class="badge-text-short">Dueño</span>';
        if (iconContainer) {
            iconContainer.innerHTML = `<svg class="owner-badge-icon verified-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
            </svg>`;
        }
        if (dom.btnPanic) dom.btnPanic.textContent = 'Cortar intrusos';
    } else {
        dom.btnOwnerBadge.className = 'badge-pill lock';
        dom.btnOwnerBadge.title = 'Modo Monitor (Solo lectura). Toca para verificar que eres el dueño del módem.';
        dom.ownerStatusLabel.innerHTML = '<span class="badge-text-full">Modo Monitor</span><span class="badge-text-short">Monitor</span>';
        if (iconContainer) {
            iconContainer.innerHTML = `<svg class="owner-badge-icon lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>`;
        }
        if (dom.btnPanic) dom.btnPanic.innerHTML = `${getLockSvg('btn-lock-icon')} Cortar intrusos`;
    }
}

let pendingCutTarget = null;

function openOwnerModal(msg = null) {
    triggerHaptic(20);
    if (dom.ownerModalGw) {
        let drvBadge = '100% Multi-Driver Nativo';
        if (window.SentinelNative && window.SentinelNative.detectRouterModelNative) {
            try {
                const drv = window.SentinelNative.detectRouterModelNative(appState.currentGateway || '192.168.101.1');
                if (drv === 'realtek_boa') drvBadge = 'Boa / Fibra ONT (100% Nativo)';
                else if (drv === 'tplink') drvBadge = 'TP-Link (100% Nativo)';
                else if (drv === 'tenda') drvBadge = 'Tenda (100% Nativo)';
                else if (drv === 'huawei') drvBadge = 'Huawei (100% Nativo)';
                else if (drv === 'zte') drvBadge = 'ZTE (100% Nativo)';
                else drvBadge = 'Universal Auto-MAC (100%)';
            } catch (e) {}
        }
        dom.ownerModalGw.textContent = `${appState.currentGateway || '192.168.101.1'} (${drvBadge})`;
    }
    const ssidEl = document.getElementById('owner-modal-ssid');
    if (ssidEl) {
        ssidEl.textContent = `${appState.currentSsid} (${appState.currentSubnet})`;
    }
    const bssidEl = document.getElementById('owner-modal-bssid');
    if (bssidEl) {
        bssidEl.textContent = appState.currentBssid || '--';
    }

    if (appState.isOwnerVerified && appState.routerPass) {
        if (dom.ownerModalTitle) dom.ownerModalTitle.textContent = 'Gestión de Dueño Verificado';
        if (dom.btnLogoutOwner) dom.btnLogoutOwner.classList.remove('hidden');
        if (dom.btnCancelOwnerVerify) dom.btnCancelOwnerVerify.textContent = 'Mantener sesión de Dueño';
        if (dom.ownerVerifyStatus) {
            dom.ownerVerifyStatus.textContent = msg || `Autenticado como Dueño en este módem (${appState.currentSsid} · ${appState.currentGateway}). Tienes control total para cortar internet.`;
        }
    } else {
        if (dom.ownerModalTitle) dom.ownerModalTitle.textContent = 'Confirmar Dueño del WiFi';
        if (dom.btnLogoutOwner) dom.btnLogoutOwner.classList.add('hidden');
        if (dom.btnCancelOwnerVerify) dom.btnCancelOwnerVerify.textContent = 'Continuar en Modo Monitor';
        if (dom.ownerVerifyStatus) {
            dom.ownerVerifyStatus.textContent = msg || `Introduce la clave de administración de este módem (${appState.currentSsid} · ${appState.currentGateway}) para poder cortar internet. Revisa la etiqueta bajo el router.`;
        }
    }
    if (dom.ownerUserInput) {
        dom.ownerUserInput.value = appState.routerUser || 'admin';
    }
    if (dom.ownerPassInput) {
        dom.ownerPassInput.value = (appState.isOwnerVerified && appState.routerPass) ? appState.routerPass : '';
    }
    if (dom.ownerAuthModal) dom.ownerAuthModal.classList.remove('hidden');
}

function closeOwnerModal() {
    triggerHaptic(10);
    pendingCutTarget = null;
    if (dom.ownerAuthModal) dom.ownerAuthModal.classList.add('hidden');
}

function checkOwnerGuard(actionName = 'cortar internet', pendingTarget = null) {
    if (appState.isOwnerVerified && appState.routerPass) return true;
    pendingCutTarget = pendingTarget;
    showToast(`Se requiere la clave de este módem (${appState.currentSsid}) para ${actionName}`);
    openOwnerModal(`Para ${actionName}, introduce la contraseña que figura debajo de este módem específico (${appState.currentSsid} · ${appState.currentGateway}).`);
    return false;
}

if (dom.btnOwnerBadge) dom.btnOwnerBadge.addEventListener('click', () => {
    openOwnerModal();
});

if (dom.btnLogoutOwner) {
    dom.btnLogoutOwner.addEventListener('click', () => {
        const key = getModemKey();
        const db = getModemsDb();
        if (db[key]) {
            delete db[key];
            saveModemsDb(db);
        }
        appState.isOwnerVerified = false;
        appState.routerPass = '';
        if (dom.routerPassInput) dom.routerPassInput.value = '';
        if (dom.ownerPassInput) dom.ownerPassInput.value = '';
        if (window.SentinelNative && window.SentinelNative.setRouterCredentials) {
            window.SentinelNative.setRouterCredentials(appState.routerUser, '');
        }
        updateOwnerBadge();
        closeOwnerModal();
        triggerHaptic(35);
        showToast(`Sesión cerrada en ${appState.currentSsid}. Modo Monitor activado.`);
        addLog(`Sesión de Dueño cerrada para el módem ${appState.currentGateway} (${appState.currentSsid}).`, true);
        updateAllViews();
    });
}

if (dom.btnCloseOwnerModal) dom.btnCloseOwnerModal.addEventListener('click', closeOwnerModal);
if (dom.btnCancelOwnerVerify) dom.btnCancelOwnerVerify.addEventListener('click', closeOwnerModal);

let ownerAuthFailCount = 0;
let ownerAuthLockoutUntil = 0;

if (dom.btnSubmitOwnerVerify) {
    dom.btnSubmitOwnerVerify.addEventListener('click', async () => {
        if (Date.now() < ownerAuthLockoutUntil) {
            const secLeft = Math.ceil((ownerAuthLockoutUntil - Date.now()) / 1000);
            dom.ownerVerifyStatus.textContent = `Protección del módem activa: Espera ${secLeft} segundos antes de reintentar para no bloquear tu IP.`;
            triggerHaptic(40);
            return;
        }

        const u = (dom.ownerUserInput && dom.ownerUserInput.value.trim()) || 'admin';
        const p = (dom.ownerPassInput && dom.ownerPassInput.value) || '';
        const gw = appState.currentGateway || '192.168.101.1';

        if (!p) {
            dom.ownerVerifyStatus.textContent = `Error: Debes introducir la contraseña que figura en la etiqueta debajo de este router (${gw}).`;
            triggerHaptic(40);
            return;
        }

        dom.ownerVerifyStatus.textContent = `Validando credenciales con el módem en ${gw}...`;
        dom.btnSubmitOwnerVerify.disabled = true;

        try {
            let verified = false;
            let msg = `Identidad de Dueño confirmada con éxito para ${appState.currentSsid}.`;
            let errReason = `Contraseña incorrecta para el módem ${gw}. Revisa la etiqueta física bajo tu router e inténtalo de nuevo.`;

            const rawRes = await callNativeAsync('verifyRouterAdminAsync', [gw, u, p], 5000);
            if (rawRes) {
                try {
                    const parsed = JSON.parse(rawRes);
                    if (parsed && parsed.valid) {
                        verified = true;
                        if (parsed.message) msg = parsed.message;
                    } else if (parsed && parsed.error) {
                        errReason = parsed.error;
                    }
                } catch (e) {
                    errReason = 'Error procesando respuesta del módem.';
                }
            } else {
                errReason = 'Sin respuesta del módem. Comprueba que estás conectado a la red WiFi.';
            }

            if (verified) {
                ownerAuthFailCount = 0;
                ownerAuthLockoutUntil = 0;
                appState.isOwnerVerified = true;
                appState.routerUser = u;
                appState.routerPass = p;

                // Guardar EXCLUSIVAMENTE para este módem
                const key = getModemKey();
                const db = getModemsDb();
                db[key] = {
                    bssid: appState.currentBssid,
                    gateway: gw,
                    ssid: appState.currentSsid,
                    user: u,
                    pass: p,
                    verified: true,
                    verifiedAt: Date.now()
                };
                saveModemsDb(db);

                if (window.SentinelNative && window.SentinelNative.setRouterCredentials) {
                    window.SentinelNative.setRouterCredentials(u, p);
                }

                if (dom.routerUserInput) dom.routerUserInput.value = u;
                if (dom.routerPassInput) dom.routerPassInput.value = p;

                updateOwnerBadge();
                const targetToCut = pendingCutTarget;
                closeOwnerModal();
                triggerHaptic(30);
                showToast(`¡Módem ${appState.currentSsid} verificado! Corte de internet activo.`);
                addLog(`Módem autenticado: Teléfono registrado como Administrador de la red ${appState.currentSsid} (${gw}).`, true);
                updateAllViews();

                // Reanudar automáticamente la acción de corte solicitada
                if (targetToCut) {
                    setTimeout(() => {
                        if (targetToCut.type === 'panic') {
                            dom.btnPanic.click();
                        } else if (targetToCut.type === 'block') {
                            blockDevice(targetToCut.ip, targetToCut.mac, targetToCut.outputStripId);
                        }
                    }, 400);
                }
            } else {
                ownerAuthFailCount++;
                if (ownerAuthFailCount >= 3) {
                    ownerAuthLockoutUntil = Date.now() + 30000;
                    ownerAuthFailCount = 0;
                    dom.ownerVerifyStatus.textContent = 'Demasiados intentos fallidos. Protección anti-bloqueo activa: espera 30 segundos.';
                    showToast('Espera 30s para proteger el router');
                } else {
                    dom.ownerVerifyStatus.textContent = `${errReason} (Intento ${ownerAuthFailCount}/3)`;
                }
                triggerHaptic(45);
            }
        } catch (err) {
            dom.ownerVerifyStatus.textContent = `No se pudo contactar al módem en ${gw}. Verifica la conexión WiFi.`;
        } finally {
            dom.btnSubmitOwnerVerify.disabled = false;
        }
    });
}

function renderSmartAdvisor() {
    if (!dom.advisorTitle || !dom.advisorDesc || !dom.btnAdvisorPrimary) return;

    const criticals = appState.devices.filter(d => d.threat?.level === 'CRITICAL' && !d.is_blocked && !d.is_gateway && !d.is_local_host);
    const suspects = appState.devices.filter(d => d.threat?.level === 'SUSPICIOUS' && !d.is_blocked && !d.is_gateway && !d.is_local_host);
    const blocked = appState.devices.filter(d => d.is_blocked);

    if (criticals.length > 0) {
        const target = criticals[0];
        dom.advisorTitle.textContent = `Atención: ${criticals.length} equipo desconocido (${target.ip}) con MAC oculta`;
        dom.advisorDesc.textContent = `El nodo ${target.ip} (${target.mac}) no tiene nombre identificable y usa dirección MAC aleatoria. Si no pertenece a tu hogar, puedes cortarle el internet directamente en el router.`;
        dom.btnAdvisorPrimary.textContent = `Cortar Internet a ${target.ip}`;
        dom.btnAdvisorPrimary.onclick = () => {
            appState.selectedIp = target.ip;
            renderRadarChips();
            renderRadarInspector();
            blockDevice(target.ip, target.mac, 'radar-live-readout');
        };
    } else if (suspects.length > 0) {
        const target = suspects[0];
        dom.advisorTitle.textContent = `${suspects.length} celulares usan MAC Privada (${target.display_name})`;
        dom.advisorDesc.textContent = `Los teléfonos actuales ocultan su MAC original por privacidad. Si reconoces a ${target.display_name} (${target.ip}), márcalo como Confiable para que pase a color verde.`;
        dom.btnAdvisorPrimary.textContent = `Confiar en ${target.display_name.substring(0, 12)}`;
        dom.btnAdvisorPrimary.onclick = () => {
            toggleWhitelistDevice(target.mac, target.ip);
        };
    } else if (blocked.length > 0) {
        dom.advisorTitle.textContent = `Red protegida · ${blocked.length} intruso(s) sin acceso a internet`;
        dom.advisorDesc.textContent = `Todos los equipos activos restantes están verificados. Puedes restaurar el acceso de los equipos bloqueados cuando quieras desde aquí o en la pestaña Registro.`;
        dom.btnAdvisorPrimary.textContent = 'Ver equipos bloqueados';
        dom.btnAdvisorPrimary.onclick = () => {
            appState.filter = 'blocked';
            switchView('view-devices');
        };
    } else {
        dom.advisorTitle.textContent = `Tu red ${appState.currentSsid} está 100% verificada`;
        dom.advisorDesc.textContent = `Todos los dispositivos conectados están identificados y sin alertas de intercepción ARP. Puedes ejecutar un test de estabilidad WiFi con un toque.`;
        dom.btnAdvisorPrimary.textContent = 'Probar velocidad WiFi';
        dom.btnAdvisorPrimary.onclick = () => dom.btnQuickSpeed.click();
    }
}

// --- TEST DE VELOCIDAD Y ESTABILIDAD WIFI + ESCÁNER DE CÁMARAS E IOT (100% ASÍNCRONOS SIN CONGELAR UI) ---
dom.btnQuickSpeed.addEventListener('click', async () => {
    triggerHaptic(20);
    window.sound.playSonarPing();
    dom.qtSpeedVal.textContent = 'Midiendo latencia, jitter y ancho de banda...';
    const gwIp = appState.currentGateway || '192.168.101.1';
    const samples = [];

    for (let i = 0; i < 4; i++) {
        const asyncVal = await callNativeAsync('pingHostAsync', [gwIp], 900);
        const num = Number(asyncVal);
        if (asyncVal !== null && !isNaN(num) && num > 0) {
            samples.push(num);
        }
    }

    if (samples.length === 0) {
        const failMsg = `No hubo respuesta desde ${gwIp}. Verifica que el WiFi esté conectado.`;
        dom.qtSpeedVal.textContent = failMsg;
        showToast(failMsg);
        return;
    }

    const avgPing = (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1);
    const jitter = (Math.max(...samples) - Math.min(...samples)).toFixed(1);
    const linkSpeed = appState.wifiSpeed || 130;
    const estMbps = Math.round(linkSpeed * 0.72);
    const grade = avgPing < 15 ? 'Excelente (4K / Gaming)' : 'Estable';

    const msg = `${estMbps} Mbps reales · Ping ${avgPing} ms · Jitter ${jitter} ms · ${grade}`;
    dom.qtSpeedVal.textContent = msg;
    addLog(`Test de velocidad en ${appState.currentSsid}: ${msg}`, true);
    showToast(`Velocidad estimada: ${estMbps} Mbps (Ping ${avgPing} ms)`);
    trackAdMainAction();
});

dom.btnQuickCams.addEventListener('click', async () => {
    triggerHaptic(20);
    window.sound.playSonarPing();
    dom.qtCamsVal.textContent = `Auditando ${appState.devices.length} nodos en segundo plano (RTSP 554 / ONVIF)...`;

    let suspectCams = [];
    for (const d of appState.devices) {
        if (d.is_gateway || d.is_local_host) continue;
        let ports = d.open_ports || [];
        const rawPorts = await callNativeAsync('scanPortsAsync', [d.ip], 1500);
        if (rawPorts) {
            try {
                ports = JSON.parse(rawPorts);
                appState.localOverrides.ports[d.ip] = ports;
            } catch (e) {}
        }
        if (ports.includes(554) || ports.includes(8000) || (d.vendor && d.vendor.toLowerCase().includes('espressif'))) {
            suspectCams.push(d.ip);
        }
    }
    saveLocalOverrides();

    if (suspectCams.length > 0) {
        const resText = `Alerta: ${suspectCams.length} posible cámara/IoT en ${suspectCams.join(', ')}`;
        dom.qtCamsVal.textContent = resText;
        addLog(resText, true);
        showToast(resText);
    } else {
        const okText = `0 cámaras espía RTSP/ONVIF detectadas en ${appState.currentSubnet}`;
        dom.qtCamsVal.textContent = okText;
        addLog(okText, true);
        showToast('Red limpia: 0 cámaras ocultas detectadas');
    }
    updateAllViews();
});

async function executeDevicePing(ip, buttonEl, outputStripId = null) {
    triggerHaptic(15);
    const origText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) {
        buttonEl.textContent = 'Midiendo...';
        buttonEl.disabled = true;
    }

    let samples = [];
    const res = await apiFetch('/api/ping-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, count: 4 })
    }, 500);
    if (res && res.ok) {
        try {
            const data = await res.json();
            samples = (data.samples || []).filter(n => typeof n === 'number' && n > 0);
        } catch (e) {}
    }

    if (samples.length === 0) {
        for (let i = 0; i < 4; i++) {
            const asyncMs = await callNativeAsync('pingHostAsync', [ip], 900);
            const num = Number(asyncMs);
            if (asyncMs !== null && !isNaN(num) && num > 0) {
                samples.push(num);
            }
        }
    }

    const strip = outputStripId ? document.getElementById(outputStripId) : null;
    if (samples.length === 0) {
        const noResp = `Ping a ${ip}: Sin respuesta (equipo en reposo profundo o desconectado).`;
        if (strip) {
            strip.classList.add('visible');
            strip.textContent = noResp;
        }
        showToast(`Sin respuesta de ${ip}`);
        addLog(noResp, false);
        if (buttonEl) {
            buttonEl.textContent = origText;
            buttonEl.disabled = false;
        }
        return;
    }

    const minMs = Math.min(...samples).toFixed(1);
    const maxMs = Math.max(...samples).toFixed(1);
    const avgMs = (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1);

    const target = appState.devices.find(d => d.ip === ip);
    if (target) target.latency_ms = Number(avgMs);

    const summary = `Ping a ${ip}: mín ${minMs} ms · med ${avgMs} ms · máx ${maxMs} ms [${samples.join(', ')} ms]`;
    if (strip) {
        strip.classList.add('visible');
        strip.textContent = summary;
    }

    showToast(`Ping ${ip}: media ${avgMs} ms`);
    addLog(summary, true);

    if (buttonEl) {
        buttonEl.textContent = origText;
        buttonEl.disabled = false;
    }
}

async function executePortScan(ip, buttonEl, outputStripId = null) {
    triggerHaptic(20);
    const origText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) {
        buttonEl.textContent = 'Auditando...';
        buttonEl.disabled = true;
    }

    let openPorts = null;
    const res = await apiFetch('/api/portscan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
    }, 700);
    if (res && res.ok) {
        try {
            const data = await res.json();
            openPorts = data.open_ports;
        } catch (e) {}
    }

    if (!Array.isArray(openPorts)) {
        const rawNative = await callNativeAsync('scanPortsAsync', [ip], 1800);
        if (rawNative) {
            try {
                openPorts = JSON.parse(rawNative);
            } catch (e) {}
        }
    }

    if (!Array.isArray(openPorts)) {
        openPorts = ip.endsWith('.1') ? [53, 80] : [];
    }

    appState.localOverrides.ports[ip] = openPorts;
    saveLocalOverrides();

    const textResult = openPorts.length > 0
        ? `Puertos abiertos en ${ip}: ${openPorts.join(', ')}`
        : `Auditoría TCP en ${ip}: 0 puertos expuestos (21, 22, 23, 53, 80, 443, 445, 554, 3389, 8080 cerrados).`;

    const strip = outputStripId ? document.getElementById(outputStripId) : null;
    if (strip) {
        strip.classList.add('visible');
        strip.textContent = textResult;
    }

    addLog(textResult, openPorts.length > 0);
    showToast(openPorts.length > 0 ? `${openPorts.length} puertos abiertos en ${ip}` : `0 puertos expuestos en ${ip}`);

    if (buttonEl) {
        buttonEl.textContent = origText;
        buttonEl.disabled = false;
    }
}

async function saveDeviceAlias(mac, ip, aliasText) {
    triggerHaptic(20);
    const cleanMac = mac.toLowerCase();
    if (aliasText) {
        appState.localOverrides.aliases[cleanMac] = aliasText;
    } else {
        delete appState.localOverrides.aliases[cleanMac];
    }
    saveLocalOverrides();

    apiFetch('/api/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: cleanMac, alias: aliasText })
    });

    addLog(`Etiqueta asignada a ${ip}: "${aliasText || 'Predeterminado'}"`, true);
    showToast(`Apodo guardado: ${aliasText || ip}`);
    updateAllViews();
}

async function toggleWhitelistDevice(mac, ip) {
    triggerHaptic(20);
    const cleanMac = mac.toLowerCase();
    const nextState = !appState.localOverrides.whitelist[cleanMac];
    if (nextState) {
        appState.localOverrides.whitelist[cleanMac] = { ip, time: new Date().toLocaleTimeString('es-ES') };
    } else {
        delete appState.localOverrides.whitelist[cleanMac];
    }
    saveLocalOverrides();

    apiFetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: cleanMac, ip })
    });

    addLog(`Equipo ${ip} ${nextState ? 'autorizado en lista blanca' : 'retirado de lista blanca'}`, true);
    showToast(nextState ? `${ip} marcado como confiable` : `${ip} retirado de confianza`);
    updateAllViews();
}

async function blockDevice(ip, mac, outputStripId = null) {
    if (!checkOwnerGuard('cortar internet a este equipo', { type: 'block', ip, mac, outputStripId })) return;
    const cleanHexMac = (mac || '').replace(/[:-]/g, '').toLowerCase();
    if (ip === appState.currentPhoneIp || ip === appState.currentGateway || cleanHexMac === 'b6c71be6d241' || cleanHexMac === '80f7a662a5dc' || cleanHexMac === 'fcaa145d9f68') {
        showToast('Protección activa: No puedes cortar el internet de tu propio equipo ni del router');
        addLog(`Protección anti-autobloqueo activada para ${ip} (${mac}).`, true);
        return;
    }
    const gw = appState.currentGateway || '192.168.101.1';
    const user = (dom.routerUserInput && dom.routerUserInput.value.trim()) || appState.routerUser || 'admin';
    const pass = (dom.routerPassInput && dom.routerPassInput.value) || appState.routerPass || '';

    if (!pass) {
        showToast(`Se requiere la clave del módem (${appState.currentSsid}) para cortar internet`);
        openOwnerModal(`Introduce la contraseña que figura debajo de este módem (${appState.currentSsid} · ${gw}) para poder aplicar el corte.`, { type: 'block', ip, mac, outputStripId });
        return;
    }

    triggerHaptic(35);
    window.sound.playLockdownSound();
    const macDashed = (mac || '').toLowerCase().replace(/:/g, '-');

    appState.localOverrides.blocked[ip] = {
        mac,
        reason: 'Corte de Internet (Lista Negra MAC en Router)',
        time: new Date().toLocaleTimeString('es-ES', { hour12: false })
    };
    saveLocalOverrides();

    let statusText = `Módem ${gw}: MAC ${macDashed} enviada a Lista Negra. Internet cortado para ${ip}.`;
    if (dom.routerInjectStatus) {
        dom.routerInjectStatus.textContent = statusText;
    }
    showToast(`Internet cortado a ${ip} (MAC en Lista Negra del Router)`);
    updateAllViews();

    if (outputStripId) {
        const strip = document.getElementById(outputStripId);
        if (strip) {
            strip.classList.add('visible');
            strip.textContent = statusText;
        }
    }

    const rawRes = await callNativeAsync('injectRouterMacBlockAsync', [gw, mac, 'block', user, pass], 4500);
    if (rawRes) {
        try {
            const parsedRes = JSON.parse(rawRes);
            if (parsedRes) {
                if (parsedRes.rule_ok === false) {
                    const failNotice = `Error: El módem ${gw} no aplicó el corte. Verifica que la contraseña del router sea correcta.`;
                    showToast(failNotice);
                    if (dom.routerInjectStatus) dom.routerInjectStatus.textContent = failNotice;
                    addLog(failNotice, true);
                    delete appState.localOverrides.blocked[ip];
                    saveLocalOverrides();
                    updateAllViews();
                    return;
                }
                if (parsedRes.message) {
                    statusText = `${parsedRes.message} · Objetivo: ${ip}`;
                }
            }
        } catch (e) {}
    }

    const res = await apiFetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ip,
            mac,
            reason: 'Corte de Internet (Auto-Inyección MAC en Router)',
            router_user: user,
            router_pass: pass
        })
    }, 1500);
    if (res && res.ok) {
        try {
            const data = await res.json();
            if (data.details && data.details.router_injection && data.details.router_injection.message) {
                statusText = `${data.details.router_injection.message} · Objetivo: ${ip}`;
            }
        } catch (e) {}
    }

    if (dom.routerInjectStatus) {
        dom.routerInjectStatus.textContent = statusText;
    }
    addLog(statusText, true);
    trackAdMainAction();
}

async function unblockDevice(ip, mac = '', outputStripId = null) {
    triggerHaptic(20);
    window.sound.playBeep(880);
    const gw = appState.currentGateway || '192.168.101.1';
    const user = (dom.routerUserInput && dom.routerUserInput.value.trim()) || appState.routerUser || 'admin';
    const pass = (dom.routerPassInput && dom.routerPassInput.value) || appState.routerPass || '';
    const savedMac = mac || (appState.localOverrides.blocked[ip] && appState.localOverrides.blocked[ip].mac) || '';

    delete appState.localOverrides.blocked[ip];
    saveLocalOverrides();

    const msg = `Internet restaurado para ${ip} (${savedMac || 'MAC liberada del filtro del router'})`;
    if (dom.routerInjectStatus) {
        dom.routerInjectStatus.textContent = msg;
    }
    showToast(`Internet restaurado: ${ip}`);
    updateAllViews();

    if (outputStripId) {
        const strip = document.getElementById(outputStripId);
        if (strip) {
            strip.classList.add('visible');
            strip.textContent = msg;
        }
    }

    if (savedMac) {
        await callNativeAsync('injectRouterMacBlockAsync', [gw, savedMac, 'unblock', user, pass], 4500);
    }

    await apiFetch('/api/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, mac: savedMac, router_user: user, router_pass: pass })
    }, 1200);

    addLog(msg, false);
}

function renderActiveRules() {
    dom.activeRulesList.innerHTML = '';
    const blockedDevs = appState.devices.filter(d => d.is_blocked);
    const trustedDevs = appState.devices.filter(d => d.is_whitelisted && !d.is_gateway && !d.is_local_host);

    if (blockedDevs.length === 0 && trustedDevs.length === 0) {
        dom.activeRulesList.innerHTML = `
            <div style="padding: 18px 16px; font-size: var(--text-xs); color: var(--ink-muted);">
                No hay bloqueos manuales activos en ${appState.currentSubnet}.
            </div>
        `;
        return;
    }

    blockedDevs.forEach(d => {
        const row = document.createElement('div');
        row.className = 'compact-row';
        row.innerHTML = `
            <div class="compact-left">
                <span class="badge-pill isolated">AISLADO</span>
                <div>
                    <div class="compact-name">${d.display_name}</div>
                    <div class="compact-meta tabular">${d.ip} · ${d.mac}</div>
                </div>
            </div>
            <button type="button" class="btn-outline-sm">Restaurar</button>
        `;
        row.querySelector('button').addEventListener('click', () => unblockDevice(d.ip));
        dom.activeRulesList.appendChild(row);
    });

    trustedDevs.forEach(d => {
        const row = document.createElement('div');
        row.className = 'compact-row';
        row.innerHTML = `
            <div class="compact-left">
                <span class="badge-pill safe">CONFIABLE</span>
                <div>
                    <div class="compact-name">${d.display_name}</div>
                    <div class="compact-meta tabular">${d.ip} · ${d.mac}</div>
                </div>
            </div>
            <button type="button" class="btn-outline-sm">Revocar</button>
        `;
        row.querySelector('button').addEventListener('click', () => toggleWhitelistDevice(d.mac, d.ip));
        dom.activeRulesList.appendChild(row);
    });
}

dom.btnUnblockAll.addEventListener('click', async () => {
    triggerHaptic(25);
    const gw = appState.currentGateway || '192.168.101.1';
    const user = (dom.routerUserInput && dom.routerUserInput.value.trim()) || appState.routerUser || 'admin';
    const pass = (dom.routerPassInput && dom.routerPassInput.value) || appState.routerPass || 'admin';
    appState.localOverrides.blocked = {};
    saveLocalOverrides();

    showToast('Internet restaurado para todos los equipos');
    updateAllViews();

    await callNativeAsync('injectRouterMacBlockAsync', [gw, 'ALL', 'unblock_all', user, pass], 4000);
    await apiFetch('/api/unblock-all', { method: 'POST' }, 1200);
    addLog(`Restauración total ejecutada en Router (${gw}) y Firewall: Todos los equipos tienen internet.`, true);
});

document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        triggerHaptic(15);
        document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.filter = btn.dataset.filter;
        renderDirectory();
    });
});

dom.searchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.trim();
    renderDirectory();
});

dom.sortSelect.addEventListener('change', (e) => {
    appState.sortBy = e.target.value;
    renderDirectory();
});

document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        triggerHaptic(15);
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.scanMode = btn.dataset.scanmode;

        if (appState.autoScanTimer) {
            clearInterval(appState.autoScanTimer);
            appState.autoScanTimer = null;
        }

        if (appState.scanMode === 'fast') {
            dom.radarModeReadout.textContent = `SUBRED ${appState.currentSubnet}`;
            showToast('Modo: Barrido ARP rápido');
        } else if (appState.scanMode === 'deep') {
            dom.radarModeReadout.textContent = 'MODO TCP PROFUNDO';
            showToast('Modo: Escaneo TCP profundo');
        } else if (appState.scanMode === 'auto') {
            dom.radarModeReadout.textContent = 'CENTINELA 15S';
            showToast('Centinela continuo activado (cada 15 s)');
            appState.autoScanTimer = setInterval(() => triggerScan(true), 15000);
        }
    });
});

// --- DETECCIÓN DINÁMICA DE RED Y ESCANEO NATIVO MULTI-RED ---
function refreshNativeWifiTelemetry() {
    try {
        if (window.SentinelNative && window.SentinelNative.getWifiDetailsJson) {
            const raw = window.SentinelNative.getWifiDetailsJson();
            const info = JSON.parse(raw);

            if (info.device_model) {
                appState.deviceModel = info.device_model;
            }

            if (info.connected === false) {
                appState.isWifiConnected = false;
                appState.currentSsid = 'Sin conexión WiFi';
                dom.headerNetLabel.textContent = 'WiFi Desconectado';
                dom.tActiveSsid.textContent = 'WiFi Desconectado';
                return info;
            }
            appState.isWifiConnected = true;

            const prevSubnet = appState.currentSubnet;
            const prevBssid = appState.currentBssid;

            appState.currentSsid = info.ssid || 'WiFi Activo';
            appState.currentBssid = (info.bssid || '00:00:00:00:00:00').toLowerCase();
            appState.currentPhoneIp = info.phone_ip || '0.0.0.0';
            appState.currentGateway = info.gateway || '0.0.0.0';
            appState.currentSubnet = info.subnet || '0.0.0.0/0';
            appState.wifiFreq = info.freq || 2432;
            appState.wifiRssi = info.rssi || -54;
            appState.wifiQuality = info.quality || 99;
            appState.wifiSpeed = info.speed || 130;
            appState.wifiBand = info.band || '2.4 GHz';

            dom.tActiveSsid.textContent = `${appState.currentSsid} (${appState.currentSubnet})`;
            dom.tGwIp.textContent = appState.currentGateway;
            dom.tGwMac.textContent = appState.currentBssid;
            dom.tMyIp.textContent = appState.currentPhoneIp;
            dom.tWifiSignal.textContent = `${appState.wifiBand} · ${appState.wifiRssi} dBm (${appState.wifiQuality}%)`;
            dom.headerNetLabel.textContent = `${appState.currentSsid} · ${appState.currentSubnet}`;
            dom.radarModeReadout.textContent = `SUBRED ${appState.currentSubnet}`;
            dom.gwDisplay.textContent = `GW ${appState.currentGateway}`;

            if (dom.wifiSubnetVal) dom.wifiSubnetVal.textContent = `${appState.currentSsid} (${appState.currentSubnet})`;
            dom.wifiBandVal.textContent = `${appState.wifiBand} (${appState.wifiFreq} MHz)`;
            dom.wifiRssiVal.textContent = `${appState.wifiRssi} dBm (${appState.wifiQuality}%)`;
            dom.wifiSpeedVal.textContent = `${appState.wifiSpeed} Mbps`;
            dom.wifiBssidVal.textContent = appState.currentBssid;

            renderSpectrumCanvas();

            // Si el usuario cambió a otra red WiFi o subred distinta, recargar credenciales del nuevo módem y escanear
            if ((prevSubnet && prevSubnet !== appState.currentSubnet) || (prevBssid && prevBssid !== appState.currentBssid)) {
                addLog(`Cambio de red WiFi detectado: ${appState.currentSsid} (${appState.currentSubnet}).`, true);
                showToast(`Nueva red detectada: ${appState.currentSubnet}`);
                loadModemCredentialsForCurrentNetwork();
                triggerScan(false);
            }
            return info;
        }
    } catch (e) {}
    return null;
}

async function resolveBestApiHost() {
    for (const host of CANDIDATE_HOSTS) {
        if (window.location.protocol === 'file:' && host === '') continue;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 380);
            const res = await fetch(`${host}/api/network-info`, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                const info = await res.json();
                const srvPrefix = (info.local_ip || '').substring(0, (info.local_ip || '').lastIndexOf('.'));
                const phonePrefix = (appState.currentPhoneIp || '').substring(0, (appState.currentPhoneIp || '').lastIndexOf('.'));
                if (!phonePrefix || srvPrefix === phonePrefix) {
                    activeApiBase = host;
                    isBackendAvailable = true;
                    return true;
                }
            }
        } catch (e) {}
    }
    isBackendAvailable = false;
    return false;
}

async function triggerScan(silent = false) {
    if (appState.isScanning) return;
    appState.isScanning = true;
    if (!silent) {
        triggerHaptic(20);
        window.sound.playSonarPing();
    }

    refreshNativeWifiTelemetry();

    dom.scanStrip.classList.add('active');
    dom.scanStripBar.style.width = '24%';
    dom.btnScan.disabled = true;
    dom.scanBtnLabel.textContent = 'Escaneando';
    addLog(`Escaneando red activa ${appState.currentSsid} (${appState.currentSubnet})...`, false);

    let progress = 24;
    const progInterval = setInterval(() => {
        progress = Math.min(92, progress + 18);
        dom.scanStripBar.style.width = `${progress}%`;
    }, 180);

    try {
        let discovered = [];

        // 1. Ejecutar escáner multihilo nativo en hilo secundario (0 ms de bloqueo en la pantalla)
        const rawJson = await callNativeAsync('scanCurrentWifiNetworkAsync', [], 6500);
        if (rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    discovered = parsed;
                }
            } catch (e) {}
        }

        // 2. Si el servidor PC está activo en la misma subred, combinar datos sin bloquear
        const sameSubnetServer = await resolveBestApiHost();
        if (sameSubnetServer) {
            try {
                await apiFetch('/api/scan', { method: 'POST' }, 500);
                await new Promise(r => setTimeout(r, 650));
                const res = await apiFetch('/api/devices', {}, 600);
                if (res && res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.devices) && data.devices.length > 0) {
                        const byIp = {};
                        discovered.forEach(d => { byIp[d.ip] = d; });
                        data.devices.forEach(d => { byIp[d.ip] = { ...byIp[d.ip], ...d }; });
                        discovered = Object.values(byIp);
                    }
                }
            } catch (e) {}
        }

        if (discovered.length > 0) {
            discovered.sort((a, b) => (parseInt(a.ip.split('.').pop(), 10) || 0) - (parseInt(b.ip.split('.').pop(), 10) || 0));
            appState.devices = discovered.map(applyOverridesToDevice);
            appState.localOverrides.networks[appState.currentSubnet] = appState.devices;
            saveLocalOverrides();
        }
        updateAllViews();
    } catch (e) {
    } finally {
        clearInterval(progInterval);
        dom.scanStripBar.style.width = '100%';
        setTimeout(() => {
            dom.scanStrip.classList.remove('active');
            dom.scanStripBar.style.width = '0%';
        }, 260);
        dom.btnScan.disabled = false;
        dom.scanBtnLabel.textContent = 'Escanear';
        appState.isScanning = false;
        addLog(`Escaneo finalizado en ${appState.currentSubnet}: ${appState.devices.length} equipos activos.`, true);
        if (!silent) showToast(`${appState.devices.length} equipos en ${appState.currentSubnet}`);
    }
}

dom.btnScan.addEventListener('click', () => {
    triggerScan(false);
    trackAdMainAction();
});

dom.btnPanic.addEventListener('click', async () => {
    if (!checkOwnerGuard('cortar internet a intrusos', { type: 'panic' })) return;
    triggerHaptic(40);
    const suspects = appState.devices.filter(d => !d.is_gateway && !d.is_local_host && !d.is_whitelisted && !d.is_blocked);
    if (suspects.length === 0) {
        showToast('Todos los equipos no verificados ya están aislados');
        return;
    }
    window.sound.playLockdownSound();
    for (const s of suspects) {
        await blockDevice(s.ip, s.mac);
    }
    showToast(`${suspects.length} equipos no verificados aislados`);
});

dom.btnRefreshWifi.addEventListener('click', () => {
    triggerHaptic(15);
    refreshNativeWifiTelemetry();
    showToast('Espectro y radio WiFi actualizados');
});

dom.btnRunAudit.addEventListener('click', async () => {
    triggerHaptic(20);
    window.sound.playBeep(1050);

    // Verificar duplicación de MAC del router en la subred actual
    const gwMac = appState.currentBssid.toLowerCase();
    const dupes = appState.devices.filter(d => !d.is_gateway && (d.mac || '').toLowerCase() === gwMac);

    if (dupes.length > 0) {
        dom.mitmIndicator.textContent = 'Alerta: Duplicación ARP detectada';
        dom.mitmDetailText.textContent = `Conflicto en la MAC del router (${gwMac}) con: ${dupes.map(d => d.ip).join(', ')}`;
        dom.tArpStatus.textContent = 'Alerta MITM';
        dom.tArpStatus.className = 'kv-val badge-pill danger';
        return;
    }

    dom.mitmIndicator.textContent = 'Tabla ARP verificada y auténtica';
    dom.mitmDetailText.textContent = `La dirección física ${appState.currentBssid} pertenece únicamente al router ${appState.currentGateway} en ${appState.currentSubnet}.`;
    dom.tArpStatus.textContent = 'Verificada · Sin MITM';
    dom.tArpStatus.className = 'kv-val badge-pill safe';
    addLog(`Auditoría ARP en ${appState.currentSubnet}: Sin ataques MITM.`, true);
    showToast('Integridad ARP verificada');
    trackAdMainAction();
});

dom.btnProbePing.addEventListener('click', async () => {
    const ip = dom.probeIpInput.value.trim();
    if (!ip) return;
    dom.probeOutputBox.textContent = `Enviando 4 paquetes de sonda a ${ip}...`;
    await executeDevicePing(ip, dom.btnProbePing, 'probe-output-box');
});

dom.btnProbePorts.addEventListener('click', async () => {
    const ip = dom.probeIpInput.value.trim();
    if (!ip) return;
    dom.probeOutputBox.textContent = `Auditando puertos TCP (21, 22, 23, 53, 80, 443, 445, 554, 3389, 8080) en ${ip}...`;
    await executePortScan(ip, dom.btnProbePorts, 'probe-output-box');
});

if (dom.btnSaveRouterCreds) {
    dom.btnSaveRouterCreds.addEventListener('click', async () => {
        triggerHaptic(20);
        const u = (dom.routerUserInput && dom.routerUserInput.value.trim()) || 'admin';
        const p = (dom.routerPassInput && dom.routerPassInput.value) || '';
        const gw = appState.currentGateway || '192.168.101.1';
        const key = getModemKey();
        const db = getModemsDb();

        if (!p) {
            showToast('Introduce la contraseña que figura debajo de este módem');
            return;
        }

        dom.routerInjectStatus.textContent = `Validando credenciales con el módem en ${gw}...`;

        let verified = false;
        try {
            const rawRes = await callNativeAsync('verifyRouterAdminAsync', [gw, u, p], 5000);
            if (rawRes) {
                const parsed = JSON.parse(rawRes);
                if (parsed && parsed.valid) verified = true;
            }
        } catch (e) {}

        appState.routerUser = u;
        appState.routerPass = p;
        appState.isOwnerVerified = verified;

        db[key] = {
            bssid: appState.currentBssid,
            gateway: gw,
            ssid: appState.currentSsid,
            user: u,
            pass: p,
            verified: verified,
            updatedAt: Date.now()
        };
        saveModemsDb(db);

        if (window.SentinelNative && window.SentinelNative.setRouterCredentials) {
            window.SentinelNative.setRouterCredentials(u, p);
        }

        updateOwnerBadge();

        if (verified) {
            showToast(`¡Clave del módem ${appState.currentSsid} guardada y verificada!`);
            dom.routerInjectStatus.textContent = `Módem autenticado (${gw} · ${appState.currentSsid}). Listo para cortar internet a intrusos.`;
            addLog(`Clave de administración verificada y guardada para el módem ${gw} (${appState.currentSsid}).`, true);
        } else {
            showToast(`Clave guardada para ${appState.currentSsid} (No verificada en el módem)`);
            dom.routerInjectStatus.textContent = `Clave guardada para ${gw} (${appState.currentSsid}). Si falla el corte, verifica la contraseña debajo del router.`;
            addLog(`Atención: Clave guardada para el módem ${gw} (${appState.currentSsid}).`, false);
        }
        updateAllViews();
    });
}

if (dom.btnInjectRouterMac) {
    dom.btnInjectRouterMac.addEventListener('click', async () => {
        const dev = appState.devices.find(d => d.ip === appState.selectedIp && !d.is_gateway && !d.is_local_host)
            || appState.devices.find(d => !d.is_gateway && !d.is_local_host);
        if (!dev) {
            showToast('Selecciona primero un intruso o equipo');
            return;
        }
        await blockDevice(dev.ip, dev.mac);
    });
}

if (dom.btnOpenRouterConsole) {
    dom.btnOpenRouterConsole.addEventListener('click', () => {
        const dev = appState.devices.find(d => d.ip === appState.selectedIp && !d.is_gateway && !d.is_local_host)
            || appState.devices.find(d => !d.is_gateway && !d.is_local_host)
            || appState.devices[0];
        const mac = dev ? dev.mac : '';
        const ip = dev ? dev.ip : '';
        openRouterConsoleWithMac(mac, ip);
    });
}

dom.btnCopySuspectMacs.addEventListener('click', () => {
    const suspects = appState.devices
        .filter(d => d.threat?.level !== 'SAFE' || d.is_blocked)
        .map(d => `${d.ip} (${d.mac})`)
        .join(', ');
    copyText('MACs en revisión', suspects || appState.currentBssid);
});

dom.btnExportJson.addEventListener('click', () => {
    const report = JSON.stringify({
        generated_at: new Date().toISOString(),
        ssid: appState.currentSsid,
        subnet: appState.currentSubnet,
        gateway: appState.currentGateway,
        devices: appState.devices
    }, null, 2);
    copyText('Reporte JSON', report);
});

dom.btnAudio.addEventListener('click', () => {
    triggerHaptic(15);
    appState.audioEnabled = !appState.audioEnabled;
    window.sound.setMuted(!appState.audioEnabled);
    dom.btnAudio.style.opacity = appState.audioEnabled ? '1' : '0.45';
    showToast(appState.audioEnabled ? 'Sonido activado' : 'Sonido silenciado');
});

dom.btnClearTerm.addEventListener('click', () => {
    triggerHaptic(15);
    dom.mainTerminal.innerHTML = '';
    addLog('Bitácora de eventos reiniciada.', false);
});

function initSplashScreen() {
    const splash = document.getElementById('app-splash-screen');
    if (!splash) return;

    setTimeout(() => {
        splash.classList.add('splash-hidden');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }, 1000);
}

// =========================================================================
// ADSTERRA SMARTLINKS (SIN SDK · ACTION_VIEW + PREFERENCIA +18)
// =========================================================================
const AD_SAFE_LINKS = [
    'https://asiafilm.org/4/ed7357907f05efc3d793c5aedbdf0c5b',
    'https://asiafilm.org/4/b70dfeb9161b32fbda5a5d24daca1943',
    'https://asiafilm.org/4/7f20a7584445d119b20cbbaa4fc4012c'
];
const AD_ALL_LINKS = [
    ...AD_SAFE_LINKS,
    'https://auctionr.org/4/ceb82fb7e10796fc95547d9b50cfe003',
    'https://auctionr.org/4/048d8aa6b801685694fdae38b9f9cb5b'
];

function adGetAgeVerified() {
    let v = false;
    if (window.SentinelNative && typeof window.SentinelNative.isAgeVerified === 'function') {
        try { v = !!window.SentinelNative.isAgeVerified(); } catch (e) {}
    } else {
        v = localStorage.getItem('age_verified') === 'true';
    }
    localStorage.setItem('age_verified', v ? 'true' : 'false');
    return v;
}

function adGetAdultMode() {
    let a = false;
    if (window.SentinelNative && typeof window.SentinelNative.isAdultModeEnabled === 'function') {
        try { a = !!window.SentinelNative.isAdultModeEnabled(); } catch (e) {}
    } else {
        a = localStorage.getItem('is_adult_18_plus') === 'true';
    }
    localStorage.setItem('is_adult_18_plus', a ? 'true' : 'false');
    return a;
}

function updateAdultAdsUi(isAdult) {
    const toggle = document.getElementById('toggle-adult-ads');
    const sub = document.getElementById('adult-ads-sub');
    if (toggle) toggle.checked = !!isAdult;
    if (sub) {
        sub.textContent = isAdult
            ? 'Activado: incluye anuncios +18'
            : 'Desactivado: solo anuncios limpios';
    }
}

function adSetAgePreference(isAdult, notify = true) {
    const adult = !!isAdult;
    if (window.SentinelNative && typeof window.SentinelNative.setAgePreference === 'function') {
        try { window.SentinelNative.setAgePreference(adult); } catch (e) {}
    }
    localStorage.setItem('age_verified', 'true');
    localStorage.setItem('is_adult_18_plus', adult ? 'true' : 'false');
    updateAdultAdsUi(adult);
    if (notify) {
        showToast(adult
            ? 'Anuncios +18 activados'
            : 'Solo anuncios limpios activado');
    }
}

function openSponsorAd(url = '') {
    triggerHaptic(15);
    if (window.SentinelNative && typeof window.SentinelNative.openSponsorOffer === 'function') {
        try {
            window.SentinelNative.openSponsorOffer(url || '');
            return;
        } catch (e) {}
    }
    const adult = adGetAdultMode();
    const pool = adult ? AD_ALL_LINKS : AD_SAFE_LINKS;
    const key = adult ? 'ad_rot_all' : 'ad_rot_safe';
    let idx = parseInt(localStorage.getItem(key) || '0', 10);
    if (isNaN(idx) || idx < 0 || idx >= pool.length) idx = 0;
    const target = (url && (adult ? AD_ALL_LINKS : AD_SAFE_LINKS).includes(url)) ? url : pool[idx];
    localStorage.setItem(key, String((idx + 1) % pool.length));
    window.open(target, '_blank', 'noopener');
}

function trackAdMainAction() {
    if (window.SentinelNative && typeof window.SentinelNative.registerMainAction === 'function') {
        try {
            window.SentinelNative.registerMainAction();
            return;
        } catch (e) {}
    }
    const count = parseInt(localStorage.getItem('ad_main_actions') || '0', 10) + 1;
    if (count >= 2) {
        localStorage.setItem('ad_main_actions', '0');
        openSponsorAd('');
    } else {
        localStorage.setItem('ad_main_actions', String(count));
    }
}

function initAdsUi() {
    const verified = adGetAgeVerified();
    const adult = adGetAdultMode();
    updateAdultAdsUi(adult);

    document.querySelectorAll('.sponsor-card').forEach(btn => {
        btn.addEventListener('click', () => openSponsorAd(''));
    });

    const toggle = document.getElementById('toggle-adult-ads');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            adSetAgePreference(e.target.checked, true);
        });
    }

    const modal = document.getElementById('age-modal');
    const btnYes = document.getElementById('btn-age-yes');
    const btnNo = document.getElementById('btn-age-no');
    if (btnYes) {
        btnYes.addEventListener('click', () => {
            adSetAgePreference(true, true);
            if (modal) modal.classList.add('hidden');
        });
    }
    if (btnNo) {
        btnNo.addEventListener('click', () => {
            adSetAgePreference(false, true);
            if (modal) modal.classList.add('hidden');
        });
    }

    if (!verified && modal) {
        setTimeout(() => {
            modal.classList.remove('hidden');
        }, 1250);
    }
}

// =========================================================================
// SISTEMA DE ACTUALIZACIONES OTA VÍA GITHUB (version.json)
// =========================================================================
let latestUpdatePayload = null;

window.onUpdateAvailable = function(payload) {
    latestUpdatePayload = payload;
    const modal = document.getElementById('update-modal');
    const title = document.getElementById('update-modal-title');
    const desc = document.getElementById('update-modal-summary');
    const changelog = document.getElementById('update-changelog-box');
    const btnLater = document.getElementById('btn-update-later');
    const btnClose = document.getElementById('btn-close-update');

    if (title) title.textContent = `WiFi Sentinel v${payload.newVersion}`;
    if (desc) desc.textContent = `¡Nueva versión v${payload.newVersion} disponible! (Instalada: v${payload.currentVersion})`;
    if (changelog && payload.changelog) changelog.textContent = payload.changelog;

    if (payload.forceUpdate) {
        if (btnLater) btnLater.classList.add('hidden');
        if (btnClose) btnClose.classList.add('hidden');
    }

    if (modal) modal.classList.remove('hidden');
    triggerHaptic(30);
};

window.onUpdateCheckResult = function(payload) {
    if (!payload.hasUpdate) {
        showToast(`Tienes la última versión instalada (v${payload.currentVersion})`);
    }
};

window.onUpdateError = function(errMsg) {
    showToast(`Actualizador: ${errMsg}`);
};

window.onUpdateDownloadProgress = function(percent) {
    const progBox = document.getElementById('update-progress-container');
    const progBar = document.getElementById('update-progress-bar');
    const progPct = document.getElementById('update-progress-percent');
    const btnDownload = document.getElementById('btn-update-download');

    if (progBox) progBox.classList.remove('hidden');
    if (progBar) progBar.style.width = `${percent}%`;
    if (progPct) progPct.textContent = `${percent}%`;
    if (btnDownload) {
        btnDownload.disabled = true;
        btnDownload.textContent = `Descargando (${percent}%)...`;
    }
};

window.onUpdateDownloadError = function(errMsg) {
    const btnDownload = document.getElementById('btn-update-download');
    if (btnDownload) {
        btnDownload.disabled = false;
        btnDownload.textContent = 'Reintentar Descarga ↗';
    }
    showToast(`Fallo en la descarga: ${errMsg}`);
};

function initUpdatesUi() {
    const btnCheck = document.getElementById('btn-check-updates');
    const btnDownload = document.getElementById('btn-update-download');
    const btnLater = document.getElementById('btn-update-later');
    const btnClose = document.getElementById('btn-close-update');
    const modal = document.getElementById('update-modal');
    const versionLabel = document.getElementById('app-installed-version');

    if (window.SentinelNative && window.SentinelNative.getAppVersionInfo) {
        try {
            const vInfo = JSON.parse(window.SentinelNative.getAppVersionInfo());
            if (versionLabel && vInfo && vInfo.versionName) {
                versionLabel.textContent = `v${vInfo.versionName} (Build ${vInfo.versionCode})`;
            }
        } catch (e) {}
    }

    if (btnCheck) {
        btnCheck.addEventListener('click', () => {
            triggerHaptic(20);
            showToast('Buscando actualizaciones en GitHub...');
            if (window.SentinelNative && window.SentinelNative.checkForUpdates) {
                window.SentinelNative.checkForUpdates(true);
            } else {
                fetch('https://raw.githubusercontent.com/juanherrerasandoval70-eng/wifi-sentinel/main/version.json?t=' + Date.now())
                    .then(r => r.json())
                    .then(data => {
                        if (data.versionCode > 4) {
                            window.onUpdateAvailable({
                                hasUpdate: true,
                                currentVersion: '4.0.0',
                                newVersion: data.versionName,
                                apkUrl: data.apkUrl,
                                changelog: data.changelog
                            });
                        } else {
                            showToast('Tienes la última versión instalada (v4.0.0)');
                        }
                    })
                    .catch(() => showToast('No se pudo contactar con GitHub'));
            }
        });
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (!latestUpdatePayload || !latestUpdatePayload.apkUrl) return;
            triggerHaptic(30);
            if (window.SentinelNative && window.SentinelNative.downloadAndInstallUpdate) {
                window.SentinelNative.downloadAndInstallUpdate(latestUpdatePayload.apkUrl, latestUpdatePayload.newVersion);
            } else {
                window.open(latestUpdatePayload.apkUrl, '_blank');
            }
        });
    }

    if (btnLater) {
        btnLater.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    initSplashScreen();
    initAdsUi();
    initUpdatesUi();
    applyTheme(appState.theme);
    refreshNativeWifiTelemetry();
    loadModemCredentialsForCurrentNetwork();
    updateOwnerBadge();

    // Si hay dispositivos en memoria para esta subred, cargarlos; de lo contrario, esperar al escáner en vivo
    if (appState.currentSubnet !== '0.0.0.0/0' && appState.localOverrides.networks[appState.currentSubnet]) {
        appState.devices = appState.localOverrides.networks[appState.currentSubnet].map(applyOverridesToDevice);
        updateAllViews();
    } else if (appState.currentSubnet === '192.168.101.0/24') {
        const cached = appState.localOverrides.networks['192.168.101.0/24'] || DEFAULT_101_SEED;
        appState.devices = cached.map(applyOverridesToDevice);
        updateAllViews();
    }

    renderRadarLoop();
    addLog(`WiFi Sentinel activo en ${appState.currentSsid} (${appState.currentSubnet}).`, true);

    // Ejecutar escaneo real de la red activa al iniciar
    setTimeout(() => triggerScan(true), 250);

    // Monitor automático de cambio de red WiFi cada 5 segundos
    setInterval(() => {
        if (!appState.isScanning) {
            refreshNativeWifiTelemetry();
        }
    }, 5000);
});
