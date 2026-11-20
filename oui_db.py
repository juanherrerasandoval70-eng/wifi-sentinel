"""
Base de datos OUI de fabricantes de red y detección de MAC aleatoria.
Permite identificar al instante la marca de cualquier dispositivo conectado.
"""

# Prefijos OUI más comunes (primeros 3 bytes / 6 caracteres hexadecimales)
OUI_TABLE = {
    # Apple
    "fcaa14": "Apple, Inc.",
    "a483e7": "Apple, Inc.",
    "001c43": "Apple, Inc.",
    "002500": "Apple, Inc.",
    "3c0754": "Apple, Inc.",
    "40a6d9": "Apple, Inc.",
    "784f43": "Apple, Inc.",
    "88665a": "Apple, Inc.",
    "9801a7": "Apple, Inc.",
    "a85b78": "Apple, Inc.",
    "b8e856": "Apple, Inc.",
    "c869cd": "Apple, Inc.",
    "d023db": "Apple, Inc.",
    "f0b479": "Apple, Inc.",
    "f4f15a": "Apple, Inc.",
    "28cfda": "Apple, Inc.",
    "3cd92b": "Apple, Inc.",
    "5cf938": "Apple, Inc.",
    "60f81d": "Apple, Inc.",
    "90b931": "Apple, Inc.",

    # Samsung
    "d45800": "Samsung Electronics",
    "0007ab": "Samsung Electronics",
    "0012fb": "Samsung Electronics",
    "001599": "Samsung Electronics",
    "00166c": "Samsung Electronics",
    "001dd8": "Samsung Electronics",
    "002119": "Samsung Electronics",
    "0023d7": "Samsung Electronics",
    "002454": "Samsung Electronics",
    "002637": "Samsung Electronics",
    "1449e0": "Samsung Electronics",
    "188331": "Samsung Electronics",
    "244bfe": "Samsung Electronics",
    "30074d": "Samsung Electronics",
    "342387": "Samsung Electronics",
    "40f308": "Samsung Electronics",
    "485519": "Samsung Electronics",
    "508569": "Samsung Electronics",
    "5492be": "Samsung Electronics",
    "5c0a5b": "Samsung Electronics",
    "60af6d": "Samsung Electronics",
    "78471d": "Samsung Electronics",
    "8425db": "Samsung Electronics",
    "8c7712": "Samsung Electronics",
    "94350a": "Samsung Electronics",
    "a0821f": "Samsung Electronics",
    "a80600": "Samsung Electronics",
    "b0ec71": "Samsung Electronics",
    "b85e7b": "Samsung Electronics",
    "bc8385": "Samsung Electronics",
    "c44202": "Samsung Electronics",
    "cc07ab": "Samsung Electronics",
    "d857ef": "Samsung Electronics",
    "e47cf9": "Samsung Electronics",
    "f40e22": "Samsung Electronics",

    # Routers & Networking
    "80f7a6": "Shenzhen C-Data / Realtek Network",
    "0018e7": "Shenzhen Gongjin Electronics",
    "001fce": "ZTE Corporation",
    "002293": "ZTE Corporation",
    "046a6e": "ZTE Corporation",
    "108286": "ZTE Corporation",
    "146080": "ZTE Corporation",
    "208986": "ZTE Corporation",
    "2cfda1": "ZTE Corporation",
    "34e0cf": "ZTE Corporation",
    "48437c": "ZTE Corporation",
    "709f2d": "ZTE Corporation",
    "74b57e": "ZTE Corporation",
    "801382": "ZTE Corporation",
    "94a7b7": "ZTE Corporation",
    "c87b5b": "ZTE Corporation",
    "cc7b35": "ZTE Corporation",
    "dc028e": "ZTE Corporation",

    # TP-Link
    "003192": "TP-Link Technologies",
    "14cc20": "TP-Link Technologies",
    "50c7bf": "TP-Link Technologies",
    "6032b1": "TP-Link Technologies",
    "704f57": "TP-Link Technologies",
    "98ded0": "TP-Link Technologies",
    "ac84c6": "TP-Link Technologies",
    "c025e9": "TP-Link Technologies",
    "d80d17": "TP-Link Technologies",
    "e848b8": "TP-Link Technologies",

    # Huawei
    "001e10": "Huawei Technologies",
    "00259e": "Huawei Technologies",
    "04257b": "Huawei Technologies",
    "0c37dc": "Huawei Technologies",
    "101b54": "Huawei Technologies",
    "200bcf": "Huawei Technologies",
    "286ed4": "Huawei Technologies",
    "34cdbe": "Huawei Technologies",
    "40cbca": "Huawei Technologies",
    "48ad08": "Huawei Technologies",
    "548998": "Huawei Technologies",
    "707be8": "Huawei Technologies",
    "78d752": "Huawei Technologies",
    "80b686": "Huawei Technologies",
    "8853d4": "Huawei Technologies",
    "9c28ef": "Huawei Technologies",

    # Xiaomi
    "00ec0a": "Xiaomi Communications",
    "185936": "Xiaomi Communications",
    "286c07": "Xiaomi Communications",
    "34800d": "Xiaomi Communications",
    "508f4c": "Xiaomi Communications",
    "640980": "Xiaomi Communications",
    "742344": "Xiaomi Communications",
    "7c49eb": "Xiaomi Communications",
    "88c397": "Xiaomi Communications",
    "ac9b0a": "Xiaomi Communications",
    "b068e6": "Xiaomi Communications",
    "d0176a": "Xiaomi Communications",

    # Intel
    "001302": "Intel Corporate",
    "001500": "Intel Corporate",
    "001b21": "Intel Corporate",
    "00215c": "Intel Corporate",
    "002314": "Intel Corporate",
    "3413e8": "Intel Corporate",
    "4851b7": "Intel Corporate",
    "58946b": "Intel Corporate",
    "6805ca": "Intel Corporate",
    "7c5cf8": "Intel Corporate",
    "8086f2": "Intel Corporate",
    "8c8590": "Intel Corporate",
    "a434d9": "Intel Corporate",
    "c85b76": "Intel Corporate",

    # Espressif (IoT, Smart Home, ESP8266/ESP32)
    "18fe34": "Espressif Systems (IoT / ESP)",
    "240ac4": "Espressif Systems (IoT / ESP)",
    "246f28": "Espressif Systems (IoT / ESP)",
    "24a160": "Espressif Systems (IoT / ESP)",
    "24b2de": "Espressif Systems (IoT / ESP)",
    "2c3ae8": "Espressif Systems (IoT / ESP)",
    "30aea4": "Espressif Systems (IoT / ESP)",
    "3c6105": "Espressif Systems (IoT / ESP)",
    "3c71bf": "Espressif Systems (IoT / ESP)",
    "483fda": "Espressif Systems (IoT / ESP)",
    "5443b2": "Espressif Systems (IoT / ESP)",
    "5ccf7f": "Espressif Systems (IoT / ESP)",
    "600194": "Espressif Systems (IoT / ESP)",
    "68c63a": "Espressif Systems (IoT / ESP)",
    "70039f": "Espressif Systems (IoT / ESP)",
    "84cca8": "Espressif Systems (IoT / ESP)",
    "84f3eb": "Espressif Systems (IoT / ESP)",
    "a4cf12": "Espressif Systems (IoT / ESP)",
    "ac67b2": "Espressif Systems (IoT / ESP)",
    "b4e62d": "Espressif Systems (IoT / ESP)",
    "bcddc2": "Espressif Systems (IoT / ESP)",
    "c44f33": "Espressif Systems (IoT / ESP)",
    "cc50e3": "Espressif Systems (IoT / ESP)",
    "d8a01d": "Espressif Systems (IoT / ESP)",
    "dc4f22": "Espressif Systems (IoT / ESP)",
    "e0e2e6": "Espressif Systems (IoT / ESP)",

    # Google
    "001a11": "Google, Inc.",
    "3c5ab4": "Google, Inc. (Chromecast/Nest)",
    "48d6d5": "Google, Inc.",
    "546009": "Google, Inc.",
    "70ee50": "Google, Inc.",
    "94ebcd": "Google, Inc.",
    "a47733": "Google, Inc.",
    "d86c63": "Google, Inc.",
    "f40304": "Google, Inc.",
    "f4f5d8": "Google, Inc.",

    # Amazon
    "00fc8b": "Amazon Technologies (Echo/Fire)",
    "380146": "Amazon Technologies",
    "40b4cd": "Amazon Technologies",
    "44650d": "Amazon Technologies",
    "50f5da": "Amazon Technologies",
    "6837e9": "Amazon Technologies",
    "68545a": "Amazon Technologies",
    "747548": "Amazon Technologies",
    "84d6d0": "Amazon Technologies",
    "ac63be": "Amazon Technologies",
    "b47c9c": "Amazon Technologies",
    "fc65de": "Amazon Technologies",

    # Sony / PlayStation
    "00041f": "Sony Interactive (PlayStation)",
    "001315": "Sony Interactive (PlayStation)",
    "0015c1": "Sony Interactive (PlayStation)",
    "0019c5": "Sony Interactive (PlayStation)",
    "00248d": "Sony Interactive (PlayStation)",
    "280d90": "Sony Corporation",
    "709e29": "Sony Interactive (PlayStation)",
    "a8e3ee": "Sony Corporation",
    "bc60a7": "Sony Interactive (PlayStation)",
    "fc0f4b": "Sony Interactive (PlayStation)",

    # Nintendo
    "0009bf": "Nintendo Co., Ltd.",
    "001f32": "Nintendo Co., Ltd.",
    "7cbb8a": "Nintendo Co., Ltd. (Switch)",
    "98b6e9": "Nintendo Co., Ltd.",
    "e84e06": "Nintendo Co., Ltd.",

    # Microsoft
    "0003ff": "Microsoft Corporation",
    "00125a": "Microsoft Corporation",
    "00155d": "Microsoft (Hyper-V / Xbox)",
    "0017fa": "Microsoft Corporation",
    "0050f2": "Microsoft Corporation",
    "281878": "Microsoft (Xbox)",
    "6045bd": "Microsoft Corporation",
    "7cd95c": "Microsoft Corporation",
    "985fd3": "Microsoft (Xbox / Surface)",
    "dc5360": "Microsoft (Surface)",

    # LG
    "0005f9": "LG Electronics",
    "001c62": "LG Electronics (Smart TV)",
    "10f9ee": "LG Electronics",
    "203dbd": "LG Electronics",
    "344d56": "LG Electronics",
    "40b034": "LG Electronics",
    "58a2b5": "LG Electronics",
    "74a722": "LG Electronics",
    "a823fe": "LG Electronics",
    "c4366c": "LG Electronics",

    # Roku
    "000d4b": "Roku, Inc.",
    "080581": "Roku, Inc.",
    "84ea99": "Roku, Inc.",
    "b0a737": "Roku, Inc.",
    "dc3a5e": "Roku, Inc.",

    # Raspberry Pi
    "b827eb": "Raspberry Pi Foundation",
    "dca632": "Raspberry Pi Trading",
    "e45f01": "Raspberry Pi Trading",
    "28cdc1": "Raspberry Pi Trading",

    # Motorola
    "000a28": "Motorola Solutions",
    "000c43": "Motorola Solutions",
    "143004": "Motorola Mobility",
    "408bf6": "Motorola Mobility",
    "84248d": "Motorola Mobility",
    "f8cfc5": "Motorola Mobility",
}

def is_randomized_mac(mac: str) -> bool:
    """
    Verifica si una dirección MAC es administrada localmente (LAA).
    Android, iOS y Windows modernos usan LAA para MACs privadas / aleatorias.
    El segundo dígito hexadecimal del primer byte es 2, 6, A o E.
    Ejemplos: x2:xx:xx..., x6:xx:xx..., xA:xx:xx..., xE:xx:xx...
    """
    if not mac:
        return False
    clean = mac.replace(":", "").replace("-", "").lower()
    if len(clean) < 2:
        return False
    try:
        first_byte = int(clean[:2], 16)
        # El bit 1 (valor 2) del primer octeto indica LAA (Locally Administered Address)
        return (first_byte & 0x02) != 0
    except ValueError:
        return False

def get_vendor(mac: str) -> str:
    """
    Obtiene el fabricante a partir de la MAC.
    Detecta si es MAC privada/aleatoria, busca en la tabla OUI o devuelve desconocido.
    """
    if not mac or mac == "ff:ff:ff:ff:ff:ff":
        return "Broadcast"
    
    clean = mac.replace(":", "").replace("-", "").lower()
    if len(clean) < 6:
        return "MAC Inválida"
    
    oui = clean[:6]
    if oui in OUI_TABLE:
        return OUI_TABLE[oui]
    
    if is_randomized_mac(mac):
        return "Dispositivo Móvil (MAC Privada / Aleatoria)"
    
    return "Fabricante no catalogado"
