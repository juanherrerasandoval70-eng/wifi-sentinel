import json
import os
import subprocess
import threading
import urllib.request
import urllib.parse
import http.cookiejar

DB_FILE = os.path.join(os.path.dirname(__file__), "devices_db.json")

def compute_boa_checksum(payload_str: str) -> int:
    """
    Calcula el checksum postSecurityFlag de 16 bits exacto de Realtek Boa (common.js postTableEncrypt).
    """
    if not payload_str.endswith("&"):
        payload_str = payload_str + "&"
    csum = 0
    i = 0
    n = len(payload_str)
    while i < n:
        if (i + 4) > n:
            if i < n:
                csum += (ord(payload_str[i]) << 24)
            if (i + 1) < n:
                csum += (ord(payload_str[i + 1]) << 16)
            if (i + 2) < n:
                csum += (ord(payload_str[i + 2]) << 8)
            break
        else:
            csum += (
                (ord(payload_str[i]) << 24)
                + (ord(payload_str[i + 1]) << 16)
                + (ord(payload_str[i + 2]) << 8)
                + ord(payload_str[i + 3])
            )
            i += 4
    csum = (csum & 0xFFFF) + (csum >> 16)
    csum = csum & 0xFFFF
    csum = (~csum) & 0xFFFF
    return csum


class BlockManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.db = self._load_db()

    def _load_db(self):
        if os.path.exists(DB_FILE):
            try:
                with open(DB_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "router_creds" not in data:
                        data["router_creds"] = {"username": "admin", "password": "admin"}
                    return data
            except Exception:
                pass
        return {
            "blocked": {},
            "whitelist": {},
            "aliases": {},
            "router_creds": {"username": "admin", "password": "admin"}
        }

    def _save_db(self):
        with self.lock:
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump(self.db, f, indent=2, ensure_ascii=False)

    def set_router_creds(self, username: str, password: str):
        self.db["router_creds"] = {"username": username.strip(), "password": password.strip()}
        self._save_db()

    def get_router_creds(self):
        return self.db.get("router_creds", {"username": "admin", "password": "admin"})

    def is_blocked(self, ip: str) -> bool:
        return ip in self.db["blocked"]

    def is_whitelisted(self, mac: str) -> bool:
        return mac.lower() in [m.lower() for m in self.db["whitelist"]]

    def get_alias(self, mac: str) -> str:
        return self.db["aliases"].get(mac.lower(), None)

    def set_alias(self, mac: str, alias: str):
        self.db["aliases"][mac.lower()] = alias.strip()
        self._save_db()

    def toggle_whitelist(self, mac: str, ip: str = ""):
        mac_key = mac.lower()
        if mac_key in self.db["whitelist"]:
            del self.db["whitelist"][mac_key]
            status = False
        else:
            self.db["whitelist"][mac_key] = {
                "ip": ip,
                "added_at": "Verificado"
            }
            status = True
        self._save_db()
        return status

    def inject_router_mac_block(self, gateway_ip: str, mac: str, action: str = "block", username: str = None, password: str = None) -> dict:
        """
        Inyecta o remueve automáticamente la dirección MAC en la Lista Negra real del router
        C-Data HG102WT / Realtek Boa (/boaform/admin/formRteMacFilter y /secu_macfilter_src.asp).
        """
        import re
        creds = self.get_router_creds()
        user = username if username else creds.get("username", "admin")
        pwd = password if password else creds.get("password", "admin")

        clean_hex = mac.replace(":", "").replace("-", "").lower()
        if len(clean_hex) == 12:
            mac_colons = ":".join(clean_hex[i:i+2] for i in range(0, 12, 2))
            mac_dashed = "-".join(clean_hex[i:i+2] for i in range(0, 12, 2))
        else:
            mac_colons = mac.lower()
            mac_dashed = mac.lower().replace(":", "-")

        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        opener.addheaders = [
            ("User-Agent", "Mozilla/5.0 (Linux; Android 12) WiFiSentinel/4.0"),
            ("Referer", f"http://{gateway_ip}/secu_macfilter_src.asp")
        ]

        steps_log = []
        router_reached = False
        rule_verified = False

        # Nunca bloquear la MAC del propio teléfono S10, la PC local ni el router
        PROTECTED_MACS = {"b6-c7-1b-e6-d2-41", "fc-aa-14-5d-9f-68", "80-f7-a6-62-a5-dc"}
        if action == "block" and mac_dashed in PROTECTED_MACS:
            return {
                "router_reached": True,
                "rule_verified": False,
                "mac_formatted": mac_dashed,
                "gateway": gateway_ip,
                "message": f"Protección activa: {mac_dashed} es tu propio equipo y no puede ser bloqueado.",
                "steps": ["Dispositivo propio protegido contra autobloqueo"]
            }

        # 0. Liberar cualquier sesión previa colgada en el router (/boaform/admin/formLogout)
        try:
            req_logout = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formLogout",
                data=b"save=Logout&submit-url=%2Fadmin%2Flogin.asp",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            opener.open(req_logout, timeout=2.0)
        except Exception:
            pass

        # 1. Verificar sesión o iniciar sesión en /boaform/admin/formLogin (postSecurityFlag vacío según login.asp X077)
        try:
            req_logout0 = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formLogout",
                data=b"save=Logout&submit-url=%2Fadmin%2Flogin.asp",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            opener.open(req_logout0, timeout=2.0)
        except Exception:
            pass

        try:
            login_body = (
                f"challenge=&username={urllib.parse.quote(user)}"
                f"&psd={urllib.parse.quote(pwd)}"
                f"&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag="
            ).encode("utf-8")
            req_login = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formLogin",
                data=login_body,
                headers={
                    "Referer": f"http://{gateway_ip}/admin/login.asp",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method="POST"
            )
            with opener.open(req_login, timeout=2.5) as resp:
                router_reached = True
                steps_log.append(f"Sesión iniciada en router {gateway_ip} ({resp.status})")
        except Exception as e:
            steps_log.append(f"Login en {gateway_ip}: {str(e)[:45]}")

        # 2. Ejecutar bloqueo o desbloqueo real en /boaform/admin/formRteMacFilter
        try:
            if action == "block":
                for step_payload in [
                    "macFilterEnble=on&action=sw&bcdata=le&submit-url=%2Fsecu_macfilter_src.asp",
                    "macFilterMode=off&action=md&bcdata=le&submit-url=%2Fsecu_macfilter_src.asp",
                    f"devname=SentinelCut&mac={urllib.parse.quote(mac_colons)}&action=ad&submit-url=%2Fsecu_macfilter_src.asp"
                ]:
                    req_rte = urllib.request.Request(
                        f"http://{gateway_ip}/boaform/admin/formRteMacFilter",
                        data=step_payload.encode("utf-8"),
                        headers={
                            "Referer": f"http://{gateway_ip}/secu_macfilter_src.asp",
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        method="POST"
                    )
                    with opener.open(req_rte, timeout=2.5) as r_step:
                        router_reached = True

                # Verificar en /secu_macfilter_src.asp que la regla quedó grabada en el router
                with opener.open(f"http://{gateway_ip}/secu_macfilter_src.asp", timeout=2.5) as r_ver:
                    html_ver = r_ver.read().decode("utf-8", errors="ignore")
                    if mac_dashed in html_ver.lower() or mac_colons in html_ver.lower():
                        rule_verified = True
                        steps_log.append(f"Regla verificada en router: MAC {mac_dashed} activa en Lista Negra (formRteMacFilter)")
                    else:
                        steps_log.append(f"Filtro MAC enviado a /boaform/admin/formRteMacFilter ({mac_colons})")
            else:
                # Desbloquear: leer índice de la regla en /secu_macfilter_src.asp y enviar action=rm con bcdata Bencode
                with opener.open(f"http://{gateway_ip}/secu_macfilter_src.asp", timeout=2.5) as r_list:
                    html_list = r_list.read().decode("utf-8", errors="ignore")
                matches = re.findall(
                    r'it_nr\("([^"]+)",\s*new\s+it\("devname",\s*"([^"]*)"\),\s*new\s+it\("mac",\s*"([^"]+)"\)\)',
                    html_list
                )
                enc_items = ""
                for idx_str, dname, rmac in matches:
                    if rmac.lower() in (mac_dashed, mac_colons):
                        enc_items += f"d4:name{len(idx_str)}:{idx_str}7:devname{len(dname)}:{dname}3:mac{len(rmac)}:{rmac}e"
                if enc_items:
                    bcdata = f"l{enc_items}e"
                    rm_payload = f"action=rm&bcdata={urllib.parse.quote(bcdata)}&submit-url=%2Fsecu_macfilter_src.asp"
                    req_rm = urllib.request.Request(
                        f"http://{gateway_ip}/boaform/admin/formRteMacFilter",
                        data=rm_payload.encode("utf-8"),
                        headers={
                            "Referer": f"http://{gateway_ip}/secu_macfilter_src.asp",
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        method="POST"
                    )
                    with opener.open(req_rm, timeout=2.5) as r_rm:
                        router_reached = True
                        rule_verified = True
                        steps_log.append(f"MAC {mac_dashed} eliminada de Lista Negra del router")
        except Exception as e:
            steps_log.append(f"Error en formRteMacFilter: {str(e)[:50]}")
        finally:
            try:
                req_logout2 = urllib.request.Request(
                    f"http://{gateway_ip}/boaform/admin/formLogout",
                    data=b"save=Logout&submit-url=%2Fadmin%2Flogin.asp",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    method="POST"
                )
                opener.open(req_logout2, timeout=1.5)
            except Exception:
                pass

        msg = (
            f"Router {gateway_ip}: MAC {mac_dashed} grabada y verificada en Lista Negra ( Sin Internet)"
            if rule_verified and action == "block"
            else (steps_log[-1] if steps_log else f"Acción {action} ejecutada en {gateway_ip}")
        )

        return {
            "router_reached": router_reached,
            "rule_verified": rule_verified,
            "mac_formatted": mac_dashed,
            "gateway": gateway_ip,
            "message": msg,
            "steps": steps_log
        }

    def block_device(self, ip: str, mac: str, reason: str = "Corte de internet y aislamiento", gateway_ip: str = "192.168.101.1") -> dict:
        """Aísla el dispositivo en el Firewall de Windows e inyecta el bloqueo MAC en el router."""
        in_rule = f"SENTINEL_IN_{ip}"
        out_rule = f"SENTINEL_OUT_{ip}"

        fw_ok = False
        try:
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={in_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={out_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            subprocess.run([
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={in_rule}", "dir=in", "action=block", f"remoteip={ip}", "description=WiFi Sentinel Security Shield"
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            subprocess.run([
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={out_rule}", "dir=out", "action=block", f"remoteip={ip}", "description=WiFi Sentinel Security Shield"
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            fw_ok = True
        except Exception as e:
            print(f"[BlockManager] Error Firewall {ip}: {e}")

        router_res = self.inject_router_mac_block(gateway_ip, mac, action="block")

        self.db["blocked"][ip] = {
            "mac": mac,
            "reason": reason,
            "router_injected": router_res.get("router_reached", False)
        }
        self._save_db()
        return {
            "success": True,
            "firewall_isolated": fw_ok,
            "router_injection": router_res
        }

    def unblock_device(self, ip: str, gateway_ip: str = "192.168.101.1") -> bool:
        """Remueve las reglas de aislamiento en el Firewall y restaura acceso en el router."""
        in_rule = f"SENTINEL_IN_{ip}"
        out_rule = f"SENTINEL_OUT_{ip}"

        try:
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={in_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={out_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            mac = self.db["blocked"].get(ip, {}).get("mac", "")
            if mac:
                self.inject_router_mac_block(gateway_ip, mac, action="unblock")

            if ip in self.db["blocked"]:
                del self.db["blocked"][ip]
                self._save_db()
            return True
        except Exception as e:
            print(f"[BlockManager] Error al desbloquear {ip}: {e}")
            return False

    def restore_all_router_mac_blocks(self, gateway_ip: str = "192.168.101.1") -> dict:
        """
        Limpia todas las reglas de bloqueo MAC en el router (/secu_macfilter_src.asp),
        desactiva el filtro MAC (macFilterEnble=off) y libera todas las reglas del Firewall.
        """
        import re
        creds = self.get_router_creds()
        user = creds.get("username", "admin")
        pwd = creds.get("password", "admin")

        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        removed_macs = []

        try:
            req_logout0 = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formLogout",
                data=b"save=Logout&submit-url=%2Fadmin%2Flogin.asp",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            opener.open(req_logout0, timeout=2.0)
        except Exception:
            pass

        try:
            login_body = (
                f"challenge=&username={urllib.parse.quote(user)}"
                f"&psd={urllib.parse.quote(pwd)}"
                f"&save=Login&submit-url=%2Fadmin%2Flogin.asp&postSecurityFlag="
            ).encode("utf-8")
            req_login = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formLogin",
                data=login_body,
                headers={
                    "Referer": f"http://{gateway_ip}/admin/login.asp",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method="POST"
            )
            opener.open(req_login, timeout=3)
        except Exception:
            pass

        try:
            with opener.open(f"http://{gateway_ip}/secu_macfilter_src.asp", timeout=3) as r_list:
                html_list = r_list.read().decode("utf-8", errors="ignore")

            matches = re.findall(
                r'it_nr\("([^"]+)",\s*new\s+it\("devname",\s*"([^"]*)"\),\s*new\s+it\("mac",\s*"([^"]+)"\)\)',
                html_list
            )
            if matches:
                enc_items = ""
                for idx_str, dname, rmac in matches:
                    removed_macs.append(rmac)
                    enc_items += f"d4:name{len(idx_str)}:{idx_str}7:devname{len(dname)}:{dname}3:mac{len(rmac)}:{rmac}e"
                bcdata = f"l{enc_items}e"
                rm_payload = f"action=rm&bcdata={urllib.parse.quote(bcdata)}&submit-url=%2Fsecu_macfilter_src.asp"
                req_rm = urllib.request.Request(
                    f"http://{gateway_ip}/boaform/admin/formRteMacFilter",
                    data=rm_payload.encode("utf-8"),
                    headers={
                        "Referer": f"http://{gateway_ip}/secu_macfilter_src.asp",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    method="POST"
                )
                opener.open(req_rm, timeout=3)

            # Desactivar por completo el filtro MAC en el router para garantizar que todos tengan internet
            off_payload = "macFilterEnble=off&action=sw&bcdata=le&submit-url=%2Fsecu_macfilter_src.asp"
            req_off = urllib.request.Request(
                f"http://{gateway_ip}/boaform/admin/formRteMacFilter",
                data=off_payload.encode("utf-8"),
                headers={
                    "Referer": f"http://{gateway_ip}/secu_macfilter_src.asp",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method="POST"
            )
            opener.open(req_off, timeout=3)
        except Exception as e:
            print(f"[BlockManager] Error al restaurar router {gateway_ip}: {e}")

        for ip in list(self.db.get("blocked", {}).keys()):
            in_rule = f"SENTINEL_IN_{ip}"
            out_rule = f"SENTINEL_OUT_{ip}"
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={in_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={out_rule}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        self.db["blocked"] = {}
        self._save_db()
        return {
            "restored": True,
            "gateway": gateway_ip,
            "removed_macs": removed_macs,
            "mac_filter_disabled": True
        }

    def get_all_blocked(self):
        return self.db["blocked"]

    def get_all_whitelist(self):
        return self.db["whitelist"]
