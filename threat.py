"""
Motor de Analisis de Amenazas y Puntuacion de Riesgo de Dispositivos de Red.
"""

def evaluate_threat(device: dict, whitelisted_macs: set, open_ports: list = None) -> dict:
    score = 0
    reasons = []

    ip = device.get("ip", "")
    mac = device.get("mac", "").lower()
    hostname = device.get("hostname", "")
    vendor = device.get("vendor", "")
    randomized = device.get("is_randomized_mac", False)

    if device.get("is_gateway", False):
        return {
            "score": 0,
            "level": "SAFE",
            "reasons": ["Puerta de enlace verificada (Router / Gateway)"]
        }

    if device.get("is_local_host", False):
        return {
            "score": 0,
            "level": "SAFE",
            "reasons": ["Este equipo (Host Seguro de Control)"]
        }

    if mac in whitelisted_macs:
        return {
            "score": 0,
            "level": "SAFE",
            "reasons": ["Dispositivo autorizado en Lista Blanca de Confianza"]
        }

    # Evaluacion heuristica de riesgo
    if randomized:
        score += 30
        reasons.append("Direccion MAC aleatoria/privada (Identidad ofuscada anti-rastreo)")

    if hostname in ["Desconocido", "", None]:
        score += 20
        reasons.append("Sin resolucion de nombre NetBIOS/DNS en la red")
    
    if "no catalogado" in vendor.lower() or "desconocido" in vendor.lower():
        score += 15
        reasons.append("Fabricante de hardware no registrado en la base OUI IEEE")

    if open_ports:
        for p in open_ports:
            if p in [22, 23]:
                score += 35
                reasons.append(f"Puerto de acceso terminal remoto expuesto: {p} (Riesgo Alto)")
            elif p in [445, 139]:
                score += 20
                reasons.append(f"Puerto de comparticion de archivos SMB activo: {p}")
            elif p in [3389]:
                score += 25
                reasons.append("Puerto de Escritorio Remoto RDP activo (3389)")
            elif p in [80, 8080, 443]:
                score += 10
                reasons.append(f"Servidor web local activo en puerto {p}")

    # Nivel de severidad
    score = min(score, 100)
    if score >= 50:
        level = "CRITICAL"
    elif score >= 25:
        level = "SUSPICIOUS"
    else:
        level = "SAFE"
        if not reasons:
            reasons.append("Parametros de red normales")

    return {
        "score": score,
        "level": level,
        "reasons": reasons
    }
