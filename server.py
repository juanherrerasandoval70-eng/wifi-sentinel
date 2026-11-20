import asyncio
import os
import json
import time
import socket
import subprocess
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from scanner import NetworkScanner
from blocker import BlockManager
from threat import evaluate_threat

app = FastAPI(title="WiFi Sentinel", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scanner = NetworkScanner()
block_mgr = BlockManager()

last_scan_results = []
is_scanning = False

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

ws_manager = ConnectionManager()

class BlockRequest(BaseModel):
    ip: str
    mac: str
    reason: str = "Corte de internet y aislamiento"
    router_user: str = ""
    router_pass: str = ""

class RouterCredsRequest(BaseModel):
    username: str
    password: str

class UnblockRequest(BaseModel):
    ip: str

class WhitelistRequest(BaseModel):
    mac: str
    ip: str = ""

class AliasRequest(BaseModel):
    mac: str
    alias: str

class PortScanRequest(BaseModel):
    ip: str
    ports: list[int] = [21, 22, 23, 53, 80, 443, 445, 554, 3389, 8080]

class PingRequest(BaseModel):
    ip: str
    count: int = 4

def enrich_device(dev: dict, open_ports: list = None) -> dict:
    mac = dev["mac"]
    ip = dev["ip"]
    alias = block_mgr.get_alias(mac)
    whitelisted = block_mgr.is_whitelisted(mac)
    blocked = block_mgr.is_blocked(ip)
    existing_ports = open_ports if open_ports is not None else dev.get("open_ports", [])

    threat_info = evaluate_threat(dev, set(block_mgr.get_all_whitelist().keys()), existing_ports)

    return {
        **dev,
        "display_name": alias if alias else dev["hostname"],
        "alias": alias,
        "is_whitelisted": whitelisted,
        "is_blocked": blocked,
        "threat": threat_info,
        "open_ports": existing_ports
    }

@app.on_event("startup")
async def startup_event():
    global last_scan_results
    if not last_scan_results:
        asyncio.create_task(run_background_scan())

@app.get("/api/network-info")
def get_network_info():
    return {
        "local_ip": scanner.local_ip,
        "gateway_ip": scanner.gateway_ip,
        "router_web_admin": f"http://{scanner.gateway_ip}",
        "total_blocked": len(block_mgr.get_all_blocked()),
        "total_whitelisted": len(block_mgr.get_all_whitelist())
    }

@app.get("/api/network-health")
def get_network_health():
    t0 = time.time()
    latency_gw = 1.0
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect_ex((scanner.gateway_ip, 80))
        s.close()
        latency_gw = round((time.time() - t0) * 1000, 2)
    except Exception:
        pass

    gateway_mac = scanner.get_mac_sendarp(scanner.gateway_ip)
    arp_spoof_detected = False
    suspicious_arp_ips = []
    
    if last_scan_results and gateway_mac:
        for d in last_scan_results:
            if d["ip"] != scanner.gateway_ip and d.get("mac", "").lower() == gateway_mac.lower():
                arp_spoof_detected = True
                suspicious_arp_ips.append(d["ip"])

    return {
        "gateway_ip": scanner.gateway_ip,
        "gateway_mac": gateway_mac,
        "gateway_latency_ms": latency_gw,
        "arp_spoof_detected": arp_spoof_detected,
        "suspicious_arp_ips": suspicious_arp_ips,
        "security_status": "Comprometida" if arp_spoof_detected else "Verificada",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

@app.get("/api/devices")
def get_devices():
    enriched = [enrich_device(d) for d in last_scan_results]
    return {
        "devices": enriched,
        "is_scanning": is_scanning,
        "blocked_map": block_mgr.get_all_blocked(),
        "whitelist_map": block_mgr.get_all_whitelist()
    }

@app.post("/api/scan")
async def start_scan():
    global is_scanning
    if is_scanning:
        return {"status": "already_scanning"}

    is_scanning = True
    asyncio.create_task(run_background_scan())
    return {"status": "scanning_started"}

async def run_background_scan():
    global is_scanning, last_scan_results
    is_scanning = True
    try:
        await ws_manager.broadcast({"type": "scan_start", "message": "Escaneando subred local..."})
        
        loop = asyncio.get_event_loop()
        def on_progress(completed, total):
            pct = int((completed / total) * 100)
            asyncio.run_coroutine_threadsafe(
                ws_manager.broadcast({"type": "scan_progress", "percent": pct, "completed": completed, "total": total}),
                loop
            )

        raw_devices = await loop.run_in_executor(None, scanner.scan_subnet, on_progress)
        # Preservar puertos ya escaneados previamente
        prev_ports = {d["ip"]: d.get("open_ports", []) for d in last_scan_results}
        for d in raw_devices:
            if d["ip"] in prev_ports:
                d["open_ports"] = prev_ports[d["ip"]]
        last_scan_results = raw_devices

        enriched = [enrich_device(d) for d in last_scan_results]
        await ws_manager.broadcast({
            "type": "scan_complete",
            "devices": enriched,
            "count": len(enriched)
        })
    finally:
        is_scanning = False

@app.post("/api/block")
async def block_device_endpoint(req: BlockRequest):
    if req.router_user and req.router_pass:
        block_mgr.set_router_creds(req.router_user, req.router_pass)
    res = block_mgr.block_device(req.ip, req.mac, req.reason, scanner.gateway_ip)
    if res.get("success"):
        await ws_manager.broadcast({
            "type": "device_blocked",
            "ip": req.ip,
            "mac": req.mac,
            "message": f"Dispositivo {req.ip} aislado en Router + Firewall"
        })
        return {
            "success": True,
            "message": f"Corte de internet e inyección MAC aplicados a {req.ip}",
            "details": res
        }
    raise HTTPException(status_code=500, detail="No se pudo aplicar el aislamiento")

@app.post("/api/unblock")
async def unblock_device_endpoint(req: UnblockRequest):
    success = block_mgr.unblock_device(req.ip, scanner.gateway_ip)
    if success:
        await ws_manager.broadcast({
            "type": "device_unblocked",
            "ip": req.ip,
            "message": f"Dispositivo {req.ip} restaurado"
        })
        return {"success": True, "message": f"Acceso a internet restaurado para {req.ip}"}
    raise HTTPException(status_code=500, detail="No se pudo restaurar el dispositivo")

@app.post("/api/unblock-all")
async def unblock_all_endpoint():
    res = block_mgr.restore_all_router_mac_blocks(scanner.gateway_ip)
    await ws_manager.broadcast({
        "type": "all_unblocked",
        "message": "Todos los dispositivos fueron restaurados en Router y Firewall"
    })
    return {"success": True, "details": res}

@app.post("/api/router-creds")
async def router_creds_endpoint(req: RouterCredsRequest):
    block_mgr.set_router_creds(req.username, req.password)
    return {"success": True}

@app.post("/api/whitelist")
async def whitelist_endpoint(req: WhitelistRequest):
    status = block_mgr.toggle_whitelist(req.mac, req.ip)
    return {"success": True, "is_whitelisted": status}

@app.post("/api/alias")
async def alias_endpoint(req: AliasRequest):
    block_mgr.set_alias(req.mac, req.alias)
    return {"success": True, "alias": req.alias}

@app.post("/api/portscan")
async def port_scan_endpoint(req: PortScanRequest):
    loop = asyncio.get_event_loop()
    open_ports = await loop.run_in_executor(None, scanner.scan_ports, req.ip, req.ports)
    
    for idx, d in enumerate(last_scan_results):
        if d["ip"] == req.ip:
            d["open_ports"] = open_ports
            last_scan_results[idx] = enrich_device(d, open_ports)
            break

    return {"ip": req.ip, "open_ports": open_ports}

@app.post("/api/ping-device")
async def ping_device_endpoint(req: PingRequest):
    loop = asyncio.get_event_loop()
    def run_pings():
        samples = []
        for _ in range(max(1, min(req.count, 8))):
            ms = scanner.measure_latency(req.ip)
            samples.append(ms)
            time.sleep(0.08)
        return samples

    samples = await loop.run_in_executor(None, run_pings)
    mac = scanner.get_mac_sendarp(req.ip)
    alive = mac is not None or req.ip == scanner.local_ip
    return {
        "ip": req.ip,
        "alive": alive,
        "mac": mac,
        "samples": samples,
        "min_ms": round(min(samples), 1) if samples else 0,
        "avg_ms": round(sum(samples) / len(samples), 1) if samples else 0,
        "max_ms": round(max(samples), 1) if samples else 0
    }

@app.get("/api/export-report")
def export_report():
    enriched = [enrich_device(d) for d in last_scan_results]
    report = {
        "title": "WiFi Sentinel - Informe de Auditoria de Red",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "gateway": scanner.gateway_ip,
        "local_host": scanner.local_ip,
        "total_devices_detected": len(enriched),
        "threats_count": len([d for d in enriched if d["threat"]["level"] != "SAFE"]),
        "devices": enriched,
        "blocked_list": block_mgr.get_all_blocked(),
        "whitelist": block_mgr.get_all_whitelist()
    }
    return JSONResponse(
        content=report,
        headers={"Content-Disposition": f"attachment; filename=wifi_sentinel_audit_{int(time.time())}.json"}
    )

@app.get("/download-apk")
def download_apk():
    apk_path = os.path.join(os.path.dirname(__file__), "wifi-sentinel.apk")
    if os.path.exists(apk_path):
        return FileResponse(apk_path, media_type="application/vnd.android.package-archive", filename="WiFi-Sentinel.apk")
    raise HTTPException(status_code=404, detail="APK no encontrado")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/{filename}.css")
def serve_css(filename: str):
    path = os.path.join(static_dir, f"{filename}.css")
    if os.path.exists(path):
        return FileResponse(path, media_type="text/css")
    raise HTTPException(status_code=404)

@app.get("/{filename}.js")
def serve_js(filename: str):
    path = os.path.join(static_dir, f"{filename}.js")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/javascript")
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
