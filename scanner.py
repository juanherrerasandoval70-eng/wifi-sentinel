import ctypes
import socket
import struct
import subprocess
import re
import time
from concurrent.futures import ThreadPoolExecutor
from oui_db import get_vendor, is_randomized_mac

class NetworkScanner:
    def __init__(self):
        self.local_ip, self.gateway_ip = self._detect_network_params()

    def refresh_network_params(self):
        """Re-detecta dinámicamente la IP local y puerta de enlace por si el equipo cambió de red WiFi."""
        self.local_ip, self.gateway_ip = self._detect_network_params()
        return self.local_ip, self.gateway_ip

    def _detect_network_params(self):
        """Detecta IP local y la puerta de enlace predeterminada."""
        local_ip = "127.0.0.1"
        gateway_ip = "192.168.1.1"
        try:
            # Obtener IP local conectando socket UDP ficticio
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            pass

        try:
            # Obtener gateway desde ipconfig o route print
            out = subprocess.check_output(["ipconfig"], text=True)
            gw_matches = re.findall(r"(?:Puerta de enlace predeterminada|Default Gateway)[ .:]+(\d+\.\d+\.\d+\.\d+)", out)
            if gw_matches:
                gateway_ip = gw_matches[0]
            else:
                # Fallback calculando primer host del segmento
                parts = local_ip.split(".")
                gateway_ip = f"{parts[0]}.{parts[1]}.{parts[2]}.1"
        except Exception:
            parts = local_ip.split(".")
            gateway_ip = f"{parts[0]}.{parts[1]}.{parts[2]}.1"

        return local_ip, gateway_ip

    def get_mac_sendarp(self, ip_str: str) -> str:
        """Consulta ARP nativo de Windows (iphlpapi.dll SendARP). Inmediato y sin librerías externas."""
        try:
            ip_num = struct.unpack('<I', socket.inet_aton(ip_str))[0]
            mac = (ctypes.c_byte * 6)()
            mac_len = ctypes.c_ulong(6)
            res = ctypes.windll.iphlpapi.SendARP(ip_num, 0, ctypes.byref(mac), ctypes.byref(mac_len))
            if res == 0:
                return ':'.join(f'{b & 0xFF:02x}' for b in mac)
        except Exception:
            pass
        return None

    def query_gateway_ptr(self, ip_str: str) -> str:
        """Consulta DNS PTR directamente por UDP 53 al router (puerta de enlace) para obtener el nombre DHCP real del celular."""
        try:
            parts = ip_str.split('.')[::-1]
            qname = '.'.join(parts) + '.in-addr.arpa'
            pkt = bytearray([0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
            for label in qname.split('.'):
                pkt.append(len(label))
                pkt.extend(label.encode('ascii'))
            pkt.extend([0x00, 0x00, 0x0c, 0x00, 0x01])
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.35)
            s.sendto(pkt, (self.gateway_ip, 53))
            data, _ = s.recvfrom(512)
            s.close()
            ancount = (data[6] << 8) | data[7]
            if ancount > 0:
                idx = 12
                while idx < len(data) and data[idx] != 0:
                    idx += data[idx] + 1
                idx += 5
                if (data[idx] & 0xC0) == 0xC0:
                    idx += 2
                else:
                    while idx < len(data) and data[idx] != 0:
                        idx += data[idx] + 1
                    idx += 1
                rdlen = (data[idx+8] << 8) | data[idx+9]
                idx += 10
                labels = []
                end = idx + rdlen
                while idx < end and data[idx] != 0:
                    if (data[idx] & 0xC0) == 0xC0:
                        break
                    l = data[idx]
                    idx += 1
                    labels.append(data[idx:idx+l].decode('utf-8', errors='ignore'))
                    idx += l
                full = '.'.join(labels).replace('.domain.name', '').replace('.local', '').replace('.lan', '').strip()
                if full and full != ip_str:
                    return full
        except Exception:
            pass
        return None

    def resolve_hostname(self, ip_str: str) -> str:
        """Intenta resolver el nombre por DNS PTR directo al router, gethostbyaddr y NetBIOS UDP 137."""
        if ip_str == self.local_ip:
            return socket.gethostname() + " (Este Equipo)"
        if ip_str == self.gateway_ip:
            return "Router / Gateway Principal"

        # 0. Direct UDP 53 PTR against Gateway Router (returns DHCP Option 12 phone names)
        ptr_name = self.query_gateway_ptr(ip_str)
        if ptr_name:
            return ptr_name

        # 1. Reverse DNS
        try:
            host, _, _ = socket.gethostbyaddr(ip_str)
            if host:
                host = host.replace(".domain.name", "").replace(".local", "")
                return host
        except Exception:
            pass

        # 2. NetBIOS Name Query (UDP 137)
        try:
            # Formato estándar de petición de estado de nodo NetBIOS RFC 1002
            query = (
                b"\x82\x28\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00"
                b"\x20\x43\x4b\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41"
                b"\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x41\x00\x00\x21\x00\x01"
            )
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.35)
            sock.sendto(query, (ip_str, 137))
            data, _ = sock.recvfrom(1024)
            sock.close()
            if len(data) > 56:
                names_count = data[56]
                if names_count > 0:
                    raw_name = data[57:72].decode('ascii', errors='ignore').strip()
                    if raw_name:
                        return raw_name
        except Exception:
            pass

        return "Desconocido"

    def scan_ports(self, ip_str: str, ports=[22, 23, 80, 443, 445, 3389, 8080]):
        """Escaneo rápido de puertos comunes para evaluación de riesgo."""
        open_ports = []
        for port in ports:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.2)
                res = s.connect_ex((ip_str, port))
                s.close()
                if res == 0:
                    open_ports.append(port)
            except Exception:
                pass
        return open_ports

    def measure_latency(self, ip_str: str) -> float:
        """Mide la latencia en milisegundos hacia el host."""
        t0 = time.time()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.3)
            # Intenta conectar a puerto común o gateway
            s.connect_ex((ip_str, 80))
            s.close()
            return round((time.time() - t0) * 1000, 1)
        except Exception:
            return 1.5

    def scan_single(self, ip_str: str):
        """Escanea un único host y recopila toda su metadata."""
        mac = self.get_mac_sendarp(ip_str)
        if not mac:
            # Si es el propio equipo, resolver su propia MAC
            if ip_str == self.local_ip:
                mac = self._get_local_mac()
            else:
                return None

        hostname = self.resolve_hostname(ip_str)
        vendor = get_vendor(mac)
        randomized = is_randomized_mac(mac)
        latency = self.measure_latency(ip_str)

        # Identificar tipo de dispositivo
        dev_type = "unknown"
        lower_host = hostname.lower()
        if ip_str == self.gateway_ip:
            dev_type = "router"
        elif ip_str == self.local_ip or "pc" in lower_host or "desktop" in lower_host or "laptop" in lower_host:
            dev_type = "pc"
        elif any(k in lower_host for k in ["s10", "galaxy", "iphone", "android", "redmi", "pixel", "xiaomi", "huawei"]):
            dev_type = "mobile"
        elif any(k in lower_host for k in ["tv", "roku", "chromecast", "bravia", "playstation", "xbox"]):
            dev_type = "smart_tv"
        elif "esp" in vendor.lower() or "iot" in vendor.lower():
            dev_type = "iot"
        elif randomized:
            dev_type = "mobile"

        return {
            "ip": ip_str,
            "mac": mac,
            "hostname": hostname,
            "vendor": vendor,
            "is_randomized_mac": randomized,
            "dev_type": dev_type,
            "latency_ms": latency,
            "is_local_host": (ip_str == self.local_ip),
            "is_gateway": (ip_str == self.gateway_ip)
        }

    def _get_local_mac(self):
        try:
            out = subprocess.check_output(["getmac", "/fo", "csv", "/nh"], text=True)
            for line in out.splitlines():
                parts = line.split(",")
                if len(parts) >= 1:
                    clean = parts[0].replace('"', '').strip()
                    if len(clean) == 17:
                        return clean.replace("-", ":").lower()
        except Exception:
            pass
        return "00:00:00:00:00:00"

    def scan_subnet(self, progress_callback=None):
        """Escanea toda la subred /24 con concurrencia óptima, re-detectando la red activa primero."""
        self.refresh_network_params()
        base_parts = self.local_ip.split(".")[:3]
        base_net = ".".join(base_parts)
        ips = [f"{base_net}.{i}" for i in range(1, 255)]

        devices = []
        total = len(ips)
        completed = 0

        with ThreadPoolExecutor(max_workers=64) as executor:
            future_to_ip = {executor.submit(self.scan_single, ip): ip for ip in ips}
            for future in future_to_ip:
                completed += 1
                try:
                    res = future.result()
                    if res:
                        devices.append(res)
                except Exception:
                    pass
                if progress_callback:
                    progress_callback(completed, total)

        # Ordenar por IP numérica
        devices.sort(key=lambda d: int(d["ip"].split(".")[-1]))
        return devices
