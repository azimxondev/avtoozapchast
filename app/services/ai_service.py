"""
Avto Sklad — AI Voice Product Assistant & Conversational AI Engine
Multilingual (UZ, RU, EN) NLP, Speech entity extraction, stock lookups,
intent routing, prompt injection defense, and role-based data protection.
"""

import re
import datetime
from typing import Optional, Dict, Any, List
from app.database.db import db
from app.api.auth import CurrentUser

# ==============================================================================
# 1. AUTOMOTIVE KNOWLEDGE BASE & CATEGORY MAPPINGS
# ==============================================================================

from app.config import (
    SHOP_NAME, SHOP_PHONE, SHOP_TELEGRAM, SHOP_ADDRESS, SHOP_WORK_HOURS
)

CAR_BRANDS = [
    "BMW", "MERCEDES", "MERCEDES-BENZ", "AUDI", "CHEVROLET", "DAEWOO", "TOYOTA", "HYUNDAI",
    "KIA", "VOLKSWAGEN", "NISSAN", "HONDA", "LADA", "BYD", "GEELY", "CHERY", "TESLA",
    "LEXUS", "FORD", "MAZDA", "SKODA", "RENAULT", "OPEL", "MITSUBISHI", "LAND ROVER",
    "RANGE ROVER", "PORSCHE", "VOLVO", "SUBARU", "HAVAL", "CHANGAN", "JAC", "JETOUR",
    "EXEED", "GAC", "TANK", "ZEEKR", "LIXIANG", "LI AUTO", "AVATR", "FERRARI",
    "LAMBORGHINI", "PEUGEOT", "CITROEN", "FIAT", "SUZUKI", "INFINITI", "ACURA",
    "GENESIS", "CADILLAC", "DODGE", "JEEP", "CHRYSLER"
]

CAR_MODELS = {
    "MODEL 3": ("Tesla", "Model 3"),
    "MODEL Y": ("Tesla", "Model Y"),
    "MODEL S": ("Tesla", "Model S"),
    "MODEL X": ("Tesla", "Model X"),
    "TAHOE": ("Chevrolet", "Tahoe"),
    "EQUINOX": ("Chevrolet", "Equinox"),
    "TRAILBLAZER": ("Chevrolet", "Trailblazer"),
    "TRAVERSE": ("Chevrolet", "Traverse"),
    "MONZA": ("Chevrolet", "Monza"),
    "COBALT": ("Chevrolet", "Cobalt"),
    "KOBALT": ("Chevrolet", "Cobalt"),
    "GENTRA": ("Chevrolet", "Gentra"),
    "JENTRA": ("Chevrolet", "Gentra"),
    "NEXIA 1": ("Daewoo", "Nexia 1"),
    "NEKSIA 1": ("Daewoo", "Nexia 1"),
    "NEKSIYA 1": ("Daewoo", "Nexia 1"),
    "NEXIA1": ("Daewoo", "Nexia 1"),
    "NEKSIA1": ("Daewoo", "Nexia 1"),
    "NEKSIYA1": ("Daewoo", "Nexia 1"),
    "NEXIA 2": ("Daewoo", "Nexia 2"),
    "NEKSIA 2": ("Daewoo", "Nexia 2"),
    "NEKSIYA 2": ("Daewoo", "Nexia 2"),
    "NEXIA2": ("Daewoo", "Nexia 2"),
    "NEKSIA2": ("Daewoo", "Nexia 2"),
    "NEKSIYA2": ("Daewoo", "Nexia 2"),
    "NEXIA 3": ("Chevrolet", "Nexia 3"),
    "NEKSIA 3": ("Chevrolet", "Nexia 3"),
    "NEKSIYA 3": ("Chevrolet", "Nexia 3"),
    "NEXIA3": ("Chevrolet", "Nexia 3"),
    "NEKSIA3": ("Chevrolet", "Nexia 3"),
    "NEKSIYA3": ("Chevrolet", "Nexia 3"),
    "NEXIA": ("Chevrolet", "Nexia"),
    "NEKSIA": ("Chevrolet", "Nexia"),
    "NEKSIYA": ("Chevrolet", "Nexia"),
    "TRACKER": ("Chevrolet", "Tracker 2"),
    "TRACKER 2": ("Chevrolet", "Tracker 2"),
    "TREKER": ("Chevrolet", "Tracker 2"),
    "MALIBU": ("Chevrolet", "Malibu 2"),
    "MALIBU 2": ("Chevrolet", "Malibu 2"),
    "MOLIBU": ("Chevrolet", "Malibu 2"),
    "ONIX": ("Chevrolet", "Onix"),
    "SPARK": ("Chevrolet", "Spark"),
    "SPARC": ("Chevrolet", "Spark"),
    "SHPARK": ("Chevrolet", "Spark"),
    "DAMAS": ("Chevrolet", "Damas"),
    "DOMAS": ("Chevrolet", "Damas"),
    "LABO": ("Chevrolet", "Labo"),
    "MATIZ": ("Daewoo", "Matiz"),
    "MOTIZ": ("Daewoo", "Matiz"),
    "CAPTIVA": ("Chevrolet", "Captiva"),
    "EPICA": ("Chevrolet", "Epica"),
    "LACETTI": ("Chevrolet", "Lacetti"),
    "LASETTI": ("Chevrolet", "Lacetti"),
    "LASETI": ("Chevrolet", "Lacetti"),
    "E39": ("BMW", "E39"),
    "E34": ("BMW", "E34"),
    "E46": ("BMW", "E46"),
    "E60": ("BMW", "E60"),
    "F10": ("BMW", "F10"),
    "G30": ("BMW", "G30"),
    "X5": ("BMW", "X5"),
    "W210": ("Mercedes-Benz", "W210"),
    "W211": ("Mercedes-Benz", "W211"),
    "W212": ("Mercedes-Benz", "W212"),
    "W213": ("Mercedes-Benz", "W213"),
    "W221": ("Mercedes-Benz", "W221"),
    "W222": ("Mercedes-Benz", "W222"),
    "CAMRY": ("Toyota", "Camry"),
    "COROLLA": ("Toyota", "Corolla"),
    "SONATA": ("Hyundai", "Sonata"),
    "ELANTRA": ("Hyundai", "Elantra"),
    "K5": ("Kia", "K5"),
    "SPORTAGE": ("Kia", "Sportage"),
    "CHAZOR": ("BYD", "Chazor"),
    "SONG": ("BYD", "Song Plus")
}

# Modifiers for part position (old, orqa, chap, o'ng, tepa, past)
POSITION_KEYWORDS = {
    "old": ["old", "oldi", "oldinda", "oldingi", "front", "передний", "передняя", "переднее", "передние"],
    "orqa": ["orqa", "orqasi", "orqadagi", "orqangi", "rear", "back", "zadniy", "задний", "задняя", "заднее", "задние"],
    "chap": ["chap", "chapdagi", "chapi", "left", "левый", "левая", "левое", "левые"],
    "o'ng": ["o'ng", "ong", "o'ngdagi", "ongdagi", "o'ngi", "ongi", "right", "правый", "правая", "правое", "правые"],
    "tepa": ["tepa", "tepasi", "yuqori", "top", "upper", "верхний", "верхняя"],
    "past": ["past", "pastki", "pastdagi", "bottom", "lower", "нижний", "нижняя", "lip"]
}

PART_KEYWORDS = {
    # Yon ko'zgu & Bakavoy
    "bakavoy": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "bakovoy": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "bokovoy": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "zerkalo": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "zerkala": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "ko'zgu": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "ko'zgusi": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "kozgu": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "kuzgu": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "боковое": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    "зеркало": ("Yon Ko'zgusi (Bakavoy)", ["kuzov", "body", "oyna", "bakavoy", "zerkalo"]),
    
    # Oynalar
    "oyna": ("Oyna", ["oyna", "shisha", "glass"]),
    "oynasi": ("Oyna", ["oyna", "shisha", "glass"]),
    "shisha": ("Oyna", ["oyna", "shisha", "glass"]),
    "lobovoy": ("Oldi Oyna (Lobovoy)", ["oyna", "shisha", "glass"]),
    "labavoy": ("Oldi Oyna (Lobovoy)", ["oyna", "shisha", "glass"]),
    "стекло": ("Oyna", ["oyna", "shisha", "glass"]),
    "лобовое": ("Oldi Oyna (Lobovoy)", ["oyna", "shisha", "glass"]),
    "glass": ("Oyna", ["oyna", "shisha", "glass"]),
    
    # Bamper
    "bamper": ("Bamper", ["kuzov", "body", "bamper"]),
    "bamperi": ("Bamper", ["kuzov", "body", "bamper"]),
    "bumper": ("Bamper", ["kuzov", "body", "bamper"]),
    "бампер": ("Bamper", ["kuzov", "body", "bamper"]),
    
    # Fara & Optika
    "fara": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "farasi": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "фара": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "фары": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "headlight": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "chiroq": ("Chiroq", ["optika", "optics", "chiroq"]),
    "stop": ("Stop signal", ["optika", "optics"]),
    "фонарь": ("Stop chiroq", ["optika", "optics"]),
    "tumanka": ("Tumanka Fara", ["optika", "optics", "fara"]),
    "туманка": ("Tumanka Fara", ["optika", "optics", "fara"]),
    
    # Kuzov
    "kapot": ("Kapot", ["kuzov", "body"]),
    "kapoti": ("Kapot", ["kuzov", "body"]),
    "капот": ("Kapot", ["kuzov", "body"]),
    "hood": ("Kapot", ["kuzov", "body"]),
    "krilo": ("Krilo", ["kuzov", "body"]),
    "krilosi": ("Krilo", ["kuzov", "body"]),
    "qanot": ("Krilo (Qanot)", ["kuzov", "body"]),
    "qanoti": ("Krilo (Qanot)", ["kuzov", "body"]),
    "крыло": ("Krilo", ["kuzov", "body"]),
    "fender": ("Krilo", ["kuzov", "body"]),
    "podkrilnik": ("Podkrilnik", ["kuzov", "body"]),
    "подкрыльник": ("Podkrilnik", ["kuzov", "body"]),
    "eshik": ("Eshik", ["kuzov", "body"]),
    "eshigi": ("Eshik", ["kuzov", "body"]),
    "дверь": ("Eshik", ["kuzov", "body"]),
    "door": ("Eshik", ["kuzov", "body"]),
    "panjara": ("Panjara (Reshyotka)", ["kuzov", "body"]),
    "gril": ("Panjara (Gril)", ["kuzov", "body"]),
    "reshyotka": ("Panjara (Reshyotka)", ["kuzov", "body"]),
    "решетка": ("Panjara (Reshyotka)", ["kuzov", "body"]),
    "lip": ("Bamper Lip", ["kuzov", "body", "bamper"]),
    "spoyler": ("Spoyler", ["kuzov", "body"]),
    
    # Tormoz
    "kalodka": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "kolodka": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "kalotka": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "колодки": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "pads": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "tormoz": ("Tormoz qismi", ["tormoz", "brake"]),
    "тормоз": ("Tormoz qismi", ["tormoz", "brake"]),
    "disk": ("Tormoz diski", ["tormoz", "brake"]),
    "diski": ("Tormoz diski", ["tormoz", "brake"]),
    
    # Xodovoy & Podveska
    "amortizator": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "амортизатор": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "strut": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "prujina": ("Prujina", ["xodovoy", "podveska"]),
    "sharavoy": ("Sharavoy", ["xodovoy", "podveska"]),
    "tyaga": ("Tyaga", ["xodovoy", "podveska"]),
    "stoyka": ("Stoyka", ["xodovoy", "podveska"]),
    "granata": ("Granata (SHRUS)", ["transmissiya", "shrus"]),
    "shrus": ("Granata (SHRUS)", ["transmissiya", "shrus"]),
    "rychag": ("Rychag", ["xodovoy", "podveska"]),
    "saylentblok": ("Saylentblok", ["xodovoy", "podveska"]),
    
    # Dvigatel & Sovutish
    "radiator": ("Radiator", ["sovutish", "radiator", "cooling"]),
    "радиатор": ("Radiator", ["sovutish", "radiator", "cooling"]),
    "filtr": ("Filtr", ["filtr", "filter"]),
    "filter": ("Filtr", ["filtr", "filter"]),
    "фильтр": ("Filtr", ["filtr", "filter"]),
    "moy": ("Motor moyi", ["moy", "oil"]),
    "moyi": ("Motor moyi", ["moy", "oil"]),
    "maslo": ("Motor moyi", ["moy", "oil"]),
    "масло": ("Motor moyi", ["moy", "oil"]),
    "oil": ("Motor moyi", ["moy", "oil"]),
    "akkumulyator": ("Akkumulyator", ["elektr", "battery"]),
    "akb": ("Akkumulyator", ["elektr", "battery"]),
    "аккумулятор": ("Akkumulyator", ["elektr", "battery"]),
    "generator": ("Generator", ["elektr", "generator"]),
    "starter": ("Starter", ["elektr", "starter"]),
    "remen": ("Tasma / Remen", ["dvigatel", "belt"]),
    "ремень": ("Tasma / Remen", ["dvigatel", "belt"]),
    "porshen": ("Porshen", ["dvigatel", "engine"]),
    "svecha": ("Svecha", ["elektr", "spark"]),
    "свеча": ("Svecha", ["elektr", "spark"]),
    "pompa": ("Pompa (Suv nasosi)", ["sovutish", "pump"]),
    "nasos": ("Nasos / Pompa", ["dvigatel", "pump"]),
    "glushitel": ("Glushitel", ["dvigatel", "glushitel"]),
    "rul": ("Rul / Boshqaruv", ["rul", "steering"]),
    "shina": ("Shina / Balon", ["shina", "balon", "tire"]),
    "balon": ("Shina / Balon", ["shina", "balon", "tire"]),
    "pokrishka": ("Shina / Balon", ["shina", "balon", "tire"]),
    "tire": ("Shina / Balon", ["shina", "balon", "tire"]),
}

# Prompt injection blocklist
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"(delete|remove|ochir|yo'qot)\s+all\s+(products|database|tables|tovar)",
    r"drop\s+table",
    r"(show|tell|give|what\s+is).*?(password|secret|env|token|credentials|api_key|database_url)",
    r"grant\s+me\s+admin",
    r"give\s+me\s+super_admin",
    r"system\s*prompt",
    r"barcha\s+(mahsulotlarni|tovarlarni)\s+(o'chir|ochir|yo'qot)",
    r"parollarni\s+ko'rsat",
    r"baza(ni)?\s+tozalash"
]

# ==============================================================================
# 2. VOICE PRODUCT NLP PARSER & PHONETIC NORMALIZER
# ==============================================================================

def normalize_phonetic_uzbek(text: str) -> str:
    """
    Normalizes common Uzbek phonetic typos, SMS slang, and Cyrillic variants.
    e.g. 'necta' -> 'nechta', 'nech pul' -> 'narxi', 'sparc' -> 'spark',
    'neksia 1' -> 'nexia 1', 'bakavoy' -> 'bakavoy'.
    """
    if not text:
        return ""
    t = text.lower()
    replacements = [
        (r"\bnec[ht]+a\b", "nechta"),
        (r"\bncta\b", "nechta"),
        (r"\bnchta\b", "nechta"),
        (r"\bqanca\b", "qancha"),
        (r"\bqancadan\b", "qanchadan"),
        (r"\bnec?h?\s*pul\b", "narxi"),
        (r"\bnec?h?\s*so'm\b", "narxi"),
        (r"\bnarhi\b", "narxi"),
        (r"\bnarh\b", "narx"),
        (r"\bbomi\b", "bormi"),
        (r"\bbor\s*mi\b", "bormi"),
        (r"\bbomasa\b", "bo'lmasa"),
        (r"\bsparc\b", "spark"),
        (r"\bshpark\b", "spark"),
        (r"\bneksia\s*1\b", "nexia 1"),
        (r"\bneksiya\s*1\b", "nexia 1"),
        (r"\bnexia1\b", "nexia 1"),
        (r"\bneksia1\b", "nexia 1"),
        (r"\bneksia\s*2\b", "nexia 2"),
        (r"\bneksiya\s*2\b", "nexia 2"),
        (r"\bnexia2\b", "nexia 2"),
        (r"\bneksia2\b", "nexia 2"),
        (r"\bneksia\s*3\b", "nexia 3"),
        (r"\bneksiya\s*3\b", "nexia 3"),
        (r"\bnexia3\b", "nexia 3"),
        (r"\bneksia3\b", "nexia 3"),
        (r"\bneksia\b", "nexia"),
        (r"\bneksiya\b", "nexia"),
        (r"\bkobalt\b", "cobalt"),
        (r"\bjentra\b", "gentra"),
        (r"\bdomas\b", "damas"),
        (r"\bmotiz\b", "matiz"),
        (r"\btreker\b", "tracker"),
        (r"\bmolibu\b", "malibu"),
        (r"\boniks\b", "onix"),
        (r"\blabavoy\b", "lobovoy"),
        (r"\bbakovoy\b", "bakavoy"),
        (r"\bbokovoy\b", "bakavoy"),
        (r"\bopwi\b", "obshiy"),
        (r"\bopshi\b", "obshiy"),
        (r"\bobwi\b", "obshiy"),
        (r"\bstok\b", "stock"),
        (r"\bproduc?tlar?\b", "mahsulotlar"),
        (r"\btovarlar\b", "mahsulotlar"),
        (r"\boldi\b", "old"),
        (r"\borqasi\b", "orqa"),
        (r"\bbamperi\b", "bamper"),
        (r"\bfarasi\b", "fara"),
        (r"\bkapoti\b", "kapot"),
        (r"\beshigi\b", "eshik"),
        (r"\boynasi\b", "oyna"),
        (r"\bkrilosi\b", "krilo"),
        (r"\bqanoti\b", "qanot"),
        (r"\bпередний\b", "old"),
        (r"\bпередняя\b", "old"),
        (r"\bзадний\b", "orqa"),
        (r"\bзадняя\b", "orqa"),
        (r"\bбампер\b", "bamper"),
        (r"\bфара\b", "fara"),
        (r"\bкапот\b", "kapot"),
        (r"\bдверь\b", "eshik"),
        (r"\bстекло\b", "oyna"),
        (r"\bзеркало\b", "bakavoy"),
        (r"\bколодки\b", "kalodka"),
    ]
    for pattern, repl in replacements:
        t = re.sub(pattern, repl, t, flags=re.IGNORECASE)
    return t

def detect_user_intent(text: str) -> str:
    """
    Detect user inquiry intent:
    - 'price_and_stock': both price and quantity
    - 'stock': remaining stock / availability of pieces
    - 'price': item price
    - 'availability': whether item is available in warehouse
    - 'details': full product specifications / information
    """
    t = text.lower()
    has_price = bool(re.search(r"\b(narxi|narhi|narx|pul|so['‘`]?m|som|qanchadan|stoit|price|cost)\b", t)) or ("qancha" in t and "qoldiq" not in t and "nechta" not in t)
    has_qty = bool(re.search(r"\b(nechta|necta|nchta|qoldiq|qoldig['‘`]?i|qoldi|soni|miqdori|skolko|shtuk|how\s*many)\b", t))

    if has_price and has_qty:
        return "price_and_stock"
    if has_qty:
        return "stock"
    if has_price or re.search(r"\b(qancha|nech\s*pul)\b", t):
        return "price"
    if re.search(r"\b(bormi|bomi|bor\s*mi|mavjudmi|topiladimi|est|available)\b", t):
        return "availability"
    if re.search(r"\b(haqida|ma'lumot|malumot|tavsif|xarakteristika|qanday|qanaqa|opisanie|info|details)\b", t):
        return "details"

    return "availability"

def detect_language(text: str) -> str:
    """Detect primarily uzbek, russian, or english."""
    text_lower = text.lower()
    # Cyrillic check
    if re.search(r"[\u0400-\u04FF]", text_lower):
        if re.search(r"[ўқғҳ]", text_lower):
            return "uz"
        return "ru"
    # Latin Uzbek indicators
    uz_words = ["dona", "ta", "narxi", "qoldi", "bor", "so'm", "som", "qo'sh", "qush", "kam", "sotildi", "yana", "menga", "tovar"]
    for w in uz_words:
        if re.search(r"\b" + w + r"\b", text_lower):
            return "uz"
    # English indicators
    en_words = ["add", "product", "price", "stock", "quantity", "left", "how", "many", "sold", "today", "show", "scanner"]
    for w in en_words:
        if re.search(r"\b" + w + r"\b", text_lower):
            return "en"
    return "uz"

def parse_price(text: str) -> Optional[int]:
    """
    Extracts price in UZS from patterns like:
    - "450 ming", "450k", "450 000", "450000 so'm", "1.5 million", "500 тысяч", "500k", "цена 450"
    """
    t = text.lower().replace(",", ".").replace("'", "")
    
    # 1. Millions: "1.5 million", "2 mln", "1.5 млн"
    mln_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:million|mln|миллион|млн|m)\b", t)
    if mln_match:
        val = float(mln_match.group(1))
        return int(val * 1_000_000)

    # 2. Thousands with word: "450 ming", "500 ming som", "500 тысяч", "500 тыс", "450k", "450 к"
    k_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ming|тысяч|тыс|тысячи|k|к)\b", t)
    if k_match:
        val = float(k_match.group(1))
        return int(val * 1_000)

    # 3. Explicit large number: "450000", "450 000", "50 000"
    num_match = re.search(r"\b(\d{1,3}(?:[\s_]\d{3})+)\b", t)
    if num_match:
        clean_num = re.sub(r"[\s_]", "", num_match.group(1))
        return int(clean_num)

    # 4. "narxi / price / цена X": e.g. "narxi 450", "цена 500", "price 300"
    context_price = re.search(r"(?:narxi|narx|price|cost|цена|цены|qiymati)\s*:?\s*(\d+)\b", t)
    if context_price:
        num = int(context_price.group(1))
        # In automotive retail in UZS, if user says "narxi 450", they usually mean 450 ming (450,000 UZS)
        if 1 <= num < 2000:
            return num * 1000
        return num

    # 5. Last standalone number >= 1000
    standalone = re.findall(r"\b(\d{4,9})\b", t)
    if standalone:
        return int(standalone[-1])

    # 6. Trailing shorthand number (e.g., "15 ta, 450" or "BMW 15ta 450")
    tail_match = re.search(r"(?:,|\s)+(\d{2,4})\s*(?:so['‘`]?m|rubl|usd|\$)?\s*$", t)
    if tail_match:
        val = int(tail_match.group(1))
        if 10 <= val < 1000:
            return val * 1000
        return val

    return None

def parse_quantity(text: str) -> Optional[int]:
    """
    Extracts item quantity from patterns:
    - "15 dona", "15 ta", "15ta", "15 shtuk", "10 штук", "10 шт", "15 pcs", "quantity 15", "5 dona bor"
    """
    t = text.lower()
    
    # 1. Number + Unit: "15 dona", "15 ta", "15ta", "10 shtuk", "10 шт", "15 pcs"
    match = re.search(r"\b(\d+)\s*(?:dona|ta|dona\s+bor|shtuk|штук|шт|pcs|piece|pieces|ед)\b", t)
    if match:
        return int(match.group(1))

    # 2. Context quantity: "soni 15", "quantity: 15", "кол-во 15"
    ctx_match = re.search(r"(?:soni|miqdori|quantity|qty|кол-во|количество)\s*:?\s*(\d+)\b", t)
    if ctx_match:
        return int(ctx_match.group(1))

    # 3. Add X items: "5 ta qo'sh", "добавь 5", "add 5"
    add_match = re.search(r"(?:qo['‘`]?sh|qush|добавь|плюс|add)\s+(\d+)\b", t)
    if add_match:
        return int(add_match.group(1))

    # 4. Preceding number before unit or mid-sentence
    mid_match = re.search(r"\b(\d+)\s*(?:ta|dona)\b", t)
    if mid_match:
        return int(mid_match.group(1))

    # 5. Fallback: first small integer in phrase (1..500) if not matching price
    candidates = re.findall(r"\b(\d{1,3})\b", t)
    for c in candidates:
        val = int(c)
        if 1 <= val <= 200:
            return val

    return None

def detect_is_stock_update(text: str) -> bool:
    """Check if the user intends to increase/update stock of existing product."""
    t = text.lower()
    update_words = [
        "qo'sh", "qush", "qosh", "yana", "keldi", "kirim", "добавь", "плюс", "пополни",
        "привезли", "add", "increase", "stock in", "more"
    ]
    for w in update_words:
        if re.search(r"\b" + re.escape(w) + r"\b", t):
            return True
    return False

def extract_entities(text: str) -> Dict[str, Any]:
    """
    Extracts automotive entities (brand, model, part type, position, raw part query, intent).
    Uses phonetic normalization to catch typos and handles multiline/multilingual phrases.
    """
    t = normalize_phonetic_uzbek(text)
    detected_brand = ""
    detected_model = ""
    detected_part = ""
    detected_part_key = ""
    detected_position = ""
    detected_position_label = ""
    matched_category_hint = []

    # 1. Detect Car Brand
    for b in CAR_BRANDS:
        if re.search(r"\b" + re.escape(b.lower()) + r"\b", t):
            detected_brand = b if len(b) <= 3 else b.title()
            break

    # 2. Detect Car Model (sorted by length descending, e.g. "Nexia 3" before "Nexia")
    for m_key, (brand_hint, model_name) in sorted(CAR_MODELS.items(), key=lambda x: len(x[0]), reverse=True):
        if re.search(r"\b" + re.escape(m_key.lower()) + r"\b", t):
            detected_model = model_name
            if not detected_brand:
                detected_brand = brand_hint
            break

    # 3. Detect Position Modifiers (old, orqa, chap, o'ng, tepa, past)
    pos_labels = {
        "old": "Old",
        "orqa": "Orqa",
        "chap": "Chap",
        "o'ng": "O'ng",
        "tepa": "Tepa",
        "past": "Pastki"
    }
    for p_type, aliases in POSITION_KEYWORDS.items():
        for alias in aliases:
            if re.search(r"\b" + re.escape(alias) + r"\b", t):
                detected_position = p_type
                detected_position_label = pos_labels.get(p_type, "")
                break
        if detected_position:
            break

    # 4. Detect Part Name from PART_KEYWORDS (sorted by length descending)
    for p_key, (part_canonical, cat_hints) in sorted(PART_KEYWORDS.items(), key=lambda x: len(x[0]), reverse=True):
        if re.search(r"\b" + re.escape(p_key.lower()) + r"\b", t):
            detected_part = part_canonical
            detected_part_key = p_key
            matched_category_hint.extend(cat_hints)
            break

    # 4b. Dynamic Model Extraction: If no brand/model matched from dictionary,
    # extract words appearing before the part/position as the vehicle/product model.
    if not detected_model and not detected_brand:
        anchor_term = detected_position or detected_part_key
        if anchor_term:
            all_tokens = re.findall(r"[\w']+", t)
            preceding_tokens = []
            for tok in all_tokens:
                if tok.lower() == anchor_term.lower() or (anchor_term and tok.lower().startswith(anchor_term[:4])):
                    break
                if tok.lower() not in {"salom", "iltimos", "menga", "kerak", "agar", "bor", "bormi", "bomi"} and not tok.isdigit() and len(tok) >= 2:
                    preceding_tokens.append(tok.title())
            if preceding_tokens:
                detected_model = " ".join(preceding_tokens)

    # 5. Extract raw part query excluding brand/model and stop tokens
    stop_tokens = {
        "nechta", "necta", "nchta", "qoldi", "topib", "ber", "bor", "bormi", "bomi", "menga", 
        "narxi", "narhi", "qancha", "qanca", "pul", "so'm", "som", "yana", "iltimos", "kerak",
        "dona", "ta", "nechi", "necha", "skolko", "stoit", "how", "many", "much", "mahsulot",
        "haqida", "malumot", "bosa", "bo'lsa", "agar", "qanaqa", "qanday", "mavjudmi",
        "qo'sh", "qush", "soni", "miqdori", "narx", "price", "stock", "left", "salom",
        "uchun", "borligi", "mavjudligi", "bilan", "ekan"
    }
    cleaned_words = []
    for w in re.findall(r"[\w']+", t):
        w_lower = w.lower()
        if w_lower in stop_tokens or w.isdigit() or len(w) < 2:
            continue
        if detected_brand and w_lower in detected_brand.lower():
            continue
        if detected_model and w_lower in detected_model.lower():
            continue
        cleaned_words.append(w)

    raw_part_query = " ".join(cleaned_words).strip()
    if not detected_part and raw_part_query:
        detected_part = raw_part_query.title()
        detected_part_key = cleaned_words[-1].lower() if cleaned_words else ""

    # Construct clean title
    title_parts = []
    if detected_brand:
        title_parts.append(detected_brand)
    if detected_model and detected_model not in title_parts:
        title_parts.append(detected_model)
    if detected_position_label:
        title_parts.append(detected_position_label)
    if detected_part and detected_part not in title_parts:
        title_parts.append(detected_part)

    fallback_name = " ".join(title_parts) if title_parts else (raw_part_query.title() if raw_part_query else "Avto Ehtiyot Qism")

    # Intent
    intent = detect_user_intent(text)

    # Generate smart SKU
    sku_prefix = (detected_brand[:3] if detected_brand else "AVT").upper()
    sku_mid = (detected_model.replace(" ", "")[:3] if detected_model else "GEN").upper()
    sku_part = (detected_part[:3] if detected_part else "PRT").upper()
    import random
    sku = f"{sku_prefix}-{sku_mid}-{sku_part}-{random.randint(100, 999)}"

    return {
        "name": fallback_name,
        "brand": detected_brand or "Original",
        "car_brand": detected_brand,
        "car_model": detected_model or "Umumiy",
        "part_name": detected_part,
        "part_key": detected_part_key,
        "position": detected_position,
        "position_label": detected_position_label,
        "raw_part_query": raw_part_query,
        "intent": intent,
        "sku": sku,
        "category_hints": matched_category_hint
    }

async def search_products_full_db(query_text: str, entities: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Exhaustively searches the products database for matching parts with ranking.
    Returns up to 4 closest matching products.
    Strictly adheres to car_model if specified by user to avoid wrong part recommendations:
    If user asks for a car model that is not in the database, returns an empty list.
    """
    car_model = entities.get("car_model")
    car_brand = entities.get("car_brand")
    part_key = entities.get("part_key")
    position = entities.get("position")
    brand_or_model = car_model if (car_model and car_model.lower() != "umumiy") else car_brand

    stop_words = {
        "nechta", "necta", "nchta", "qoldi", "topib", "ber", "bor", "bormi", "bomi", "menga", 
        "narxi", "narhi", "qancha", "qanca", "pul", "so'm", "som", "yana", "iltimos", "kerak",
        "dona", "ta", "nechi", "necha", "skolko", "stoit", "how", "many", "much", "mahsulot",
        "disam", "desam", "haqida", "malumot", "bosa", "bo'lsa", "agar", "qanaqa", "qanday",
        "qo'sh", "qush", "soni", "miqdori", "narx", "price", "stock", "left"
    }
    raw_words = [w for w in re.findall(r"[\w']+", query_text.lower()) if len(w) >= 2 and not w.isdigit() and w not in stop_words]

    # CASE A: A specific car model or brand was specified (e.g. Spark, Nexia, Cobalt, Gentra, Damas, Matiz, Tracker, Malibu, BMW, X5)
    if brand_or_model and brand_or_model.lower() != "umumiy":
        # 0. Check if this car model/brand exists in database
        model_exists = await db.fetchval("""
            SELECT 1 FROM products
            WHERE is_deleted = 0
              AND (LOWER(car_model) LIKE LOWER($1) OR LOWER(car_brand) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1))
            LIMIT 1
        """, f"%{brand_or_model}%")

        if not model_exists:
            # Strictly do not return parts of another model (e.g. do not return Damas bamper for BMW X5)
            return []

        # 1. Exact match: brand/model + position (e.g. 'old') + part_key (e.g. 'bamper')
        if position and part_key:
            pos_term = "old" if position == "old" else ("orqa" if position == "orqa" else ("chap" if position == "chap" else "o'ng"))
            rows = await db.fetch("""
                SELECT p.*, c.name as category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.is_deleted = 0
                  AND (LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.car_brand) LIKE LOWER($1) OR LOWER(p.name) LIKE LOWER($1))
                  AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2))
                  AND (LOWER(p.name) LIKE LOWER($3) OR LOWER(p.description) LIKE LOWER($3))
                ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
                LIMIT 4
            """, f"%{brand_or_model}%", f"%{pos_term}%", f"%{part_key}%")
            if rows:
                return [dict(r) for r in rows]

        # 2. Search brand/model + part_key
        if part_key:
            opposite_pos = "orqa" if position == "old" else ("old" if position == "orqa" else "")
            if opposite_pos:
                rows = await db.fetch("""
                    SELECT p.*, c.name as category_name
                    FROM products p
                    LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.is_deleted = 0
                      AND (LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.car_brand) LIKE LOWER($1) OR LOWER(p.name) LIKE LOWER($1))
                      AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2))
                      AND LOWER(p.name) NOT LIKE LOWER($3)
                    ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
                    LIMIT 4
                """, f"%{brand_or_model}%", f"%{part_key}%", f"%{opposite_pos}%")
            else:
                rows = await db.fetch("""
                    SELECT p.*, c.name as category_name
                    FROM products p
                    LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.is_deleted = 0
                      AND (LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.car_brand) LIKE LOWER($1) OR LOWER(p.name) LIKE LOWER($1))
                      AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2))
                    ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
                    LIMIT 4
                """, f"%{brand_or_model}%", f"%{part_key}%")
            if rows:
                return [dict(r) for r in rows]

        # 3. Search brand/model + other meaningful query words
        for w in raw_words:
            if w.lower() in brand_or_model.lower() or brand_or_model.lower() in w.lower():
                continue
            rows = await db.fetch("""
                SELECT p.*, c.name as category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.is_deleted = 0
                  AND (LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.car_brand) LIKE LOWER($1) OR LOWER(p.name) LIKE LOWER($1))
                  AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2) OR LOWER(p.sku) LIKE LOWER($2))
                ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
                LIMIT 4
            """, f"%{brand_or_model}%", f"%{w}%")
            if rows:
                return [dict(r) for r in rows]

        # If user explicitly asked for a specific car model, but NO part matched for that car model,
        # NEVER return parts from another car model!
        return []

    # CASE B: No specific car model was requested (general part search)
    if position and part_key:
        pos_term = "old" if position == "old" else ("orqa" if position == "orqa" else ("chap" if position == "chap" else "o'ng"))
        rows = await db.fetch("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND (LOWER(p.name) LIKE LOWER($1) OR LOWER(p.description) LIKE LOWER($1))
              AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2))
            ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
            LIMIT 4
        """, f"%{pos_term}%", f"%{part_key}%")
        if rows:
            return [dict(r) for r in rows]

    if part_key:
        rows = await db.fetch("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND (LOWER(p.name) LIKE LOWER($1) OR LOWER(p.description) LIKE LOWER($1))
            ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
            LIMIT 4
        """, f"%{part_key}%")
        if rows:
            return [dict(r) for r in rows]

    for w in raw_words:
        rows = await db.fetch("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND (LOWER(p.name) LIKE LOWER($1) OR LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.sku) LIKE LOWER($1) OR LOWER(p.barcode) LIKE LOWER($1) OR LOWER(p.description) LIKE LOWER($1))
            ORDER BY (p.quantity > 0) DESC, p.quantity DESC, p.id DESC
            LIMIT 4
        """, f"%{w}%")
        if rows:
            return [dict(r) for r in rows]

    return []

async def find_matching_product(query_text: str, entities: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Search DB for existing products that closely match the detected entities.
    Wrapper around search_products_full_db for backwards compatibility.
    """
    matches = await search_products_full_db(query_text, entities)
    return matches[0] if matches else None

async def match_category_id(hints: List[str]) -> int:
    """Match hints against categories table in DB."""
    if hints:
        for h in hints:
            cat_id = await db.fetchval("""
                SELECT id FROM categories
                WHERE slug LIKE $1 OR name LIKE $1
                LIMIT 1
            """, f"%{h}%")
            if cat_id:
                return cat_id

    # Fallback to first available category
    first_id = await db.fetchval("SELECT id FROM categories ORDER BY id ASC LIMIT 1")
    return first_id or 1

# ==============================================================================
# 3. MAIN AI VOICE PRODUCT PARSER ENDPOINT
# ==============================================================================

async def parse_voice_product_input(text: str, current_user: CurrentUser) -> Dict[str, Any]:
    """
    Parses voice transcript into structured product preview data.
    Validates numbers, detects updates vs new creations, checks missing info,
    and returns a clean, safe payload ready for user confirmation.
    """
    if not text or not text.strip():
        return {
            "success": False,
            "error": "Ovozli ma'lumot qabul qilinmadi. Iltimos, qaytadan gapiring."
        }

    raw_text = text.strip()
    lang = detect_language(raw_text)
    is_update_intent = detect_is_stock_update(raw_text)

    quantity = parse_quantity(raw_text)
    price = parse_price(raw_text)
    entities = extract_entities(raw_text)

    # Check for existing matching product in DB
    existing_product = await find_matching_product(raw_text, entities)

    # If it's an update intent and we found an existing product
    if is_update_intent and existing_product:
        # If quantity is missing, ask for it
        if quantity is None:
            return {
                "success": True,
                "needs_clarification": True,
                "missing_fields": ["quantity"],
                "clarification_prompt": f"'{existing_product['name']}' mahsulotidan nechta qo'shmoqchisiz?",
                "mode": "UPDATE_STOCK",
                "matched_product": existing_product
            }
        
        # Safe quantity check
        if quantity <= 0:
            return {
                "success": False,
                "error": "Qo'shiladigan miqdor 0 dan katta bo'lishi kerak."
            }

        prev_stock = existing_product.get("quantity", 0)
        new_stock = prev_stock + quantity

        return {
            "success": True,
            "mode": "UPDATE_STOCK",
            "needs_clarification": False,
            "product_id": existing_product["id"],
            "product_name": existing_product["name"],
            "sku": existing_product["sku"],
            "barcode": existing_product.get("barcode", ""),
            "add_quantity": quantity,
            "prev_stock": prev_stock,
            "new_stock": new_stock,
            "unit": existing_product.get("unit", "dona"),
            "selling_price": existing_product.get("selling_price", 0),
            "purchase_price": price or existing_product.get("purchase_price", 0),
            "category_name": existing_product.get("category_name", "Ehtiyot qismlar"),
            "confirmation_message": f"{existing_product['name']} qoldig'iga +{quantity} {existing_product.get('unit', 'dona')} qo'shilsinmi? ({prev_stock} -> {new_stock})"
        }

    # New Product Creation Flow
    # Check what essential fields are missing
    missing = []
    if quantity is None:
        missing.append("quantity")
    if price is None:
        missing.append("price")

    if missing:
        if "quantity" in missing and "price" in missing:
            prompt = f"'{entities['name']}' uchun nechta dona va sotish narxi qancha?"
        elif "quantity" in missing:
            prompt = f"'{entities['name']}' dan nechta bor?"
        else:
            prompt = f"'{entities['name']}' ning sotish narxi qancha?"

        return {
            "success": True,
            "needs_clarification": True,
            "missing_fields": missing,
            "clarification_prompt": prompt,
            "mode": "CREATE_PRODUCT",
            "partial_product": {
                "name": entities["name"],
                "sku": entities["sku"],
                "brand": entities["brand"],
                "car_model": entities["car_model"],
                "quantity": quantity or 0,
                "selling_price": price or 0
            }
        }

    # Validation: no negative numbers
    if quantity <= 0:
        return {"success": False, "error": "Mahsulot miqdori musbat son bo'lishi kerak."}
    if price <= 0:
        return {"success": False, "error": "Mahsulot narxi 0 dan yuqori bo'lishi kerak."}

    # Estimated purchase price (default ~80% of selling price if not specified)
    estimated_purchase = int(price * 0.8)

    # Category matching
    cat_id = await match_category_id(entities.get("category_hints", []))
    cat_row = await db.fetchrow("SELECT name, icon FROM categories WHERE id = $1", cat_id)
    cat_name = f"{cat_row['icon']} {cat_row['name']}" if cat_row else "Ehtiyot qismlar"

    return {
        "success": True,
        "mode": "CREATE_PRODUCT",
        "needs_clarification": False,
        "product": {
            "name": entities["name"],
            "sku": entities["sku"],
            "barcode": "",
            "category_id": cat_id,
            "category_name": cat_name,
            "brand": entities["brand"],
            "car_brand": entities["car_brand"],
            "car_model": entities["car_model"],
            "quantity": quantity,
            "selling_price": price,
            "purchase_price": estimated_purchase,
            "min_stock": 2,
            "unit": "dona",
            "shelf_location": "A-01",
            "condition": "NEW",
            "description": f"Ovoz orqali qo'shilgan: {raw_text}"
        },
        "confirmation_message": f"Yangi mahsulot: {entities['name']} | {quantity} dona | {price:,} UZS saqlansinmi?"
    }

# ==============================================================================
# 4. AI VOICE ASSISTANT CONVERSATIONAL & INTENT ENGINE
# ==============================================================================

async def process_assistant_query(query: str, current_user: CurrentUser) -> Dict[str, Any]:
    """
    Main conversational agent for warehouse & shop assistance.
    Understands phonetic/colloquial Uzbek with typos, answers any store/auto FAQ,
    and searches the entire products database with deep intent awareness.
    """
    if not query or not query.strip():
        return {
            "answer": "Salom! Men Avto Sklad AI yordamchisiman. Mahsulotlar qoldig'i, sotuvlar yoki ombor bo'yicha savollaringiz bo'lsa, marhamat!",
            "action": None
        }

    q = query.strip()
    norm_q = normalize_phonetic_uzbek(q)
    q_lower = norm_q.lower()
    lang = detect_language(q)

    # 1. Prompt Injection & Security Barrier
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, q_lower):
            refusal = {
                "uz": "Kechirasiz, xavfsizlik qoidalariga muvofiq ushbu buyruq bajarilmaydi. Tizim maxfiy ma'lumotlari yoki ommaviy o'chirishga ruxsat berilmagan.",
                "ru": "Извините, эта команда заблокирована политикой безопасности. Доступ к системным секретам и массовое удаление запрещены.",
                "en": "Sorry, this instruction is blocked by safety policy. Access to credentials or bulk deletion is restricted."
            }
            return {
                "answer": refusal.get(lang, refusal["uz"]),
                "action": None,
                "voice_text": refusal.get(lang, refusal["uz"])
            }

    # 2. Intent: OPEN SCANNER
    if re.search(r"\b(scanner|skaner|сканер|qr|barcode|shtrix|штрих)", q_lower) and re.search(r"\b(och|ochish|qayerda|ishlat|open|открыть|где)", q_lower):
        reply = {
            "uz": "📷 QR va Shtrix-kod skaneri ochilmoqda. Kamerani mahsulot kodiga qarating.",
            "ru": "📷 Открываю QR и штрих-код сканер. Наведите камеру на код товара.",
            "en": "📷 Opening QR & Barcode scanner. Aim your camera at the product code."
        }
        return {
            "answer": reply.get(lang, reply["uz"]),
            "voice_text": reply.get(lang, reply["uz"]),
            "action": {
                "type": "OPEN_SCANNER",
                "label": "📷 Skanerni ochish"
            }
        }

    # 3. Intent: OPEN ADD PRODUCT / VOICE ADD
    if re.search(r"\b(qo'shish|qoshish|yangi tovar|yangi mahsulot|добавить товар|добавление|add product|create product)\b", q_lower):
        if not current_user.is_admin:
            return {
                "answer": "Kechirasiz, yangi mahsulot qo'shish faqat do'kon ma'murlari (adminlar) uchun ruxsat etilgan.",
                "voice_text": "Kechirasiz, bu amal faqat adminlar uchun.",
                "action": None
            }
        reply = {
            "uz": "➕ Mahsulot qo'shish oynasi tayyor. Ovoz orqali yoki formani to'ldirib qo'shishingiz mumkin.",
            "ru": "➕ Форма добавления товара готова. Вы можете добавить голосом или заполнить форму.",
            "en": "➕ Product addition modal ready. You can speak or fill the form."
        }
        return {
            "answer": reply.get(lang, reply["uz"]),
            "voice_text": reply.get(lang, reply["uz"]),
            "action": {
                "type": "OPEN_VOICE_PRODUCT",
                "label": "🎙️ Ovozli mahsulot qo'shish"
            }
        }

    # 4. Intent: STORE LOCATION / ADDRESS
    if re.search(r"\b(manzil|adres|qayerda|qatta|lokatsiya|lokasiya|joylashgan|address|где\s*находитесь|где\s*магазин)\b", q_lower):
        ans = (
            f"📍 <b>Do'konimiz manzili:</b>\n\n"
            f"• Manzil: <b>{SHOP_ADDRESS}</b>\n"
            f"• Mo'ljal: Avtomobil ehtiyot qismlari markazi\n"
            f"• Ish vaqti: <b>{SHOP_WORK_HOURS}</b>\n"
            f"• Telefon: <b>{SHOP_PHONE}</b>"
        )
        return {
            "answer": ans,
            "voice_text": f"Do'konimiz manzili: {SHOP_ADDRESS}. Ish vaqti: {SHOP_WORK_HOURS}",
            "action": None
        }

    # 5. Intent: STORE PHONE / CONTACT
    if re.search(r"\b(telefon|tel|nomer|nomeringiz|aloqa|bog'lanish|kontakt|contact|номер|телефон|admin\s*nomer)\b", q_lower):
        ans = (
            f"📞 <b>Do'kon ma'muriyati bilan aloqa:</b>\n\n"
            f"• Telefon: <b>{SHOP_PHONE}</b>\n"
            f"• Telegram: <b>{SHOP_TELEGRAM}</b>\n"
            f"• Ish tartibi: <b>{SHOP_WORK_HOURS}</b>\n\n"
            f"Istalgan savol yoki buyurtma bo'yicha bemalol qo'ng'iroq qilishingiz mumkin."
        )
        return {
            "answer": ans,
            "voice_text": f"Bizning telefon raqamimiz: {SHOP_PHONE}, telegram: {SHOP_TELEGRAM}",
            "action": None
        }

    # 6. Intent: WORKING HOURS
    if re.search(r"\b(ish\s*vaqti|rejim|soat|ochiq|ishlaysiz|vaqt|soat\s*nechagacha|график|часы\s*работы)\b", q_lower):
        ans = (
            f"🕒 <b>Do'konimiz ish vaqti:</b>\n\n"
            f"• <b>{SHOP_WORK_HOURS}</b>\n"
            f"• Dushanbadan yakshanbagacha dam olish kunlarisiz xizmatingizdamiz!"
        )
        return {
            "answer": ans,
            "voice_text": f"Do'konimiz har kuni {SHOP_WORK_HOURS} gacha ishlaydi.",
            "action": None
        }

    # 7. Intent: DELIVERY / SHIPPING
    if re.search(r"\b(dostavka|yetkazib|yetkazish|pochta|taksi|viloyatga|доставка|отправка|delivery|shipping)\b", q_lower):
        ans = (
            f"🚚 <b>Yetkazib berish (Dostavka) xizmati:</b>\n\n"
            f"• <b>Toshkent shahrida:</b> Yandex Delivery orqali tezkor (1-2 soat ichida).\n"
            f"• <b>Viloyatlarga:</b> BTS va Fargo pochta yoki taksi orqali 24 soatda yetkaziladi.\n"
            f"• Buyurtma berish uchun telefon: <b>{SHOP_PHONE}</b>"
        )
        return {
            "answer": ans,
            "voice_text": "Shahar bo'ylab Yandex orqali, viloyatlarga esa pochta va taksi orqali tez yetkazib beramiz.",
            "action": None
        }

    # 8. Intent: PAYMENT METHODS
    if re.search(r"\b(to'lov|tolov|oplata|payment|payme|click|uzum|naqd|perevod|karta|оплата|карта)\b", q_lower):
        ans = (
            f"💳 <b>Qulay to'lov usullari:</b>\n\n"
            f"• <b>Click, Payme, Uzum:</b> Onlayn ilova orqali tezkor to'lov\n"
            f"• <b>Naqd pul:</b> Mahsulotni qabul qilishda\n"
            f"• <b>Hisob raqam:</b> Yuridik shaxslar uchun shartnoma va schet-faktura bilan."
        )
        return {
            "answer": ans,
            "voice_text": "To'lovlarni Click, Payme, Uzum va naqd pulda qabul qilamiz.",
            "action": None
        }

    # 9. Intent: GREETINGS
    if re.search(r"\b(salom|assalom|assalomu\s*alaykum|privet|hello|hi|qale|qalesan|привет|салам)\b", q_lower):
        ans = (
            f"Assalomu alaykum! 🚗 Men <b>{SHOP_NAME}</b> sun'iy intellekt yordamchisiman.\n\n"
            f"Sizga qanday ehtiyot qism kerak? Masalan:\n"
            f"• <i>\"Spark oyna nechta bor?\"</i>\n"
            f"• <i>\"Nexia 1 bakavoy nech pul?\"</i>\n"
            f"• <i>\"Cobalt old farasi bormi?\"</i>\n\n"
            f"deb so'rashingiz mumkin!"
        )
        return {
            "answer": ans,
            "voice_text": f"Assalomu alaykum! {SHOP_NAME} yordamchisiman. Sizga qanday ehtiyot qism kerak?",
            "action": None
        }

    # 10. Intent: THANKS / PRAISE
    if re.search(r"\b(rahmat|spasibo|raxmat|tashakkur|gap\s*yoq|gap\s*yo'q|zor|zo'r|yaxshi|malades|krasavchik|thanks)\b", q_lower):
        ans = "Arzimaydi! Sizga yordam berganimdan mamnunman. Avtomobilingiz doim soz bo'lsin! 🛠️ Yana savollaringiz bo'lsa marhamat."
        return {
            "answer": ans,
            "voice_text": "Arzimaydi! Yana qanday ehtiyot qism kerak bo'lsa so'rang.",
            "action": None
        }

    # 11. Intent: BOT IDENTITY / HELP
    if re.search(r"\b(sen\s*kimsan|kim\s*bu|botmisan|nima\s*qila\s*olasan|who\s*are\s*you|что\s*умеешь)\b", q_lower):
        ans = (
            f"Men <b>{SHOP_NAME}</b> aqlli AI yordamchisiman 🤖.\n\n"
            f"Quyidagi masalalarda sizga yordam bera olaman:\n"
            f"• Ehtiyot qismlar mavjudligi va narxlarini aniqlash\n"
            f"• Ombordagi qoldiqlar va tokcha raqamini ko'rsatish\n"
            f"• Shtrix-kod va QR kodlarni skanerlash\n"
            f"• Do'kon manzili, ish vaqti va yetkazib berish haqida ma'lumot berish."
        )
        return {
            "answer": ans,
            "voice_text": f"Men {SHOP_NAME} yordamchisiman. Mahsulotlar narxi, ombor qoldig'i va do'kon haqida yordam beraman.",
            "action": None
        }

    # 12. Intent: OVERALL INVENTORY STATS & STORE OVERVIEW ("Productlar soni", "Opwi stock", "Botda nechta product bor")
    if re.search(
        r"\b(mahsulotlar\s*soni|tovarlar\s*soni|productlar\s*soni|nechta\s*product|nechta\s*tovar|nechta\s*mahsulot|"
        r"obshiy\s*stock|opwi\s*stock|umumiy\s*stock|obshiy\s*stok|opwi\s*stok|umumiy\s*stok|umumiy\s*qoldiq|jami\s*qoldiq|jami\s*tovar|jami\s*mahsulot|"
        r"qancha\s*product|qancha\s*tovar|qancha\s*mahsulot|botda\s*nima\s*bor|bazada\s*nima\s*bor|bazada\s*nimalar\s*bor|baza\s*haqida|"
        r"ombor\s*holati|sklad\s*holati|statistika|assortiment|skolko\s*vsego|skolko\s*tovarov|obshiy\s*ostatok|total\s*stock|total\s*products)\b",
        q_lower
    ) or q_lower in ("mahsulotlar soni", "productlar soni", "tovarlar soni", "mahsulotlar", "productlar", "tovarlar", "obshiy stock", "opwi stock", "stock", "stok", "qoldiq"):
        stats = await db.fetchrow("""
            SELECT 
                COUNT(*) as total_products,
                COALESCE(SUM(quantity), 0) as total_stock,
                COALESCE(SUM(quantity * selling_price), 0) as total_value,
                COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock,
                COUNT(CASE WHEN quantity <= min_stock AND quantity > 0 THEN 1 END) as low_stock
            FROM products
            WHERE is_deleted = 0
        """)
        cats_count = await db.fetchval("SELECT COUNT(*) FROM categories") or 11

        tot_prods = stats["total_products"] if stats else 0
        tot_qty = stats["total_stock"] if stats else 0
        tot_val = int(stats["total_value"]) if stats and stats["total_value"] else 0
        low_qty = stats["low_stock"] if stats else 0
        out_qty = stats["out_of_stock"] if stats else 0
        in_stock_types = tot_prods - out_qty

        ans = (
            f"📊 <b>Avto Sklad — Umumiy mahsulotlar va qoldiq ko'rsatkichlari:</b>\n\n"
            f"• 📦 <b>Jami mahsulot turlari:</b> <b>{tot_prods} xil</b> ehtiyot qism\n"
            f"• 📈 <b>Umumiy ombor qoldig'i (Obshiy stock):</b> <b>{tot_qty:,} dona</b>\n"
            f"• 💰 <b>Tovarlarning umumiy qiymati:</b> <b>{tot_val:,} UZS</b>\n"
            f"• 🏷️ <b>Kategoriyalar soni:</b> <b>{cats_count} ta</b> bo'lim\n"
            f"• 🟢 <b>Omborda yetarli mavjud:</b> <b>{in_stock_types} xil</b> tovar\n"
            f"• ⚠️ <b>Kam qolgan yoki tugagan:</b> <b>{low_qty + out_qty} xil</b>\n\n"
            f"Katalogimizda <b>Spark, Nexia 1-2-3, Cobalt, Gentra, Damas, Matiz, Tracker, Malibu</b> va xorijiy avtomobillar uchun kuzov, optika, oynalar, motor, tormoz va xodovoy qismlari to'liq mavjud.\n\n"
            f"<i>Biror aniq detal kerakmi? Masalan: \"Spark oyna nechta bor?\" deb so'rashingiz mumkin!</i>"
        )
        v_ans = f"Omborimizda jami {tot_prods} xil mahsulot va {tot_qty} dona umumiy qoldiq mavjud. Tovarlarning umumiy qiymati {tot_val:,} so'm."
        return {
            "answer": ans,
            "voice_text": v_ans,
            "action": {
                "type": "NAVIGATE_TAB",
                "tab": "products",
                "label": "📦 Katalogga o'tish"
            }
        }

    # 13. Intent: LOW STOCK LOOKUP ("Qaysi productdan stock kam?", "Что заканчивается?")
    if re.search(r"\b(kam\s*qolgan|tugagan|qoldiq\s*kam|kam\s*tovar|заканчивается|мало|дефицит|low\s*stock|out\s*of\s*stock)\b", q_lower):
        low_items = await db.fetch("""
            SELECT name, quantity, min_stock, unit, selling_price, sku
            FROM products
            WHERE is_deleted = 0 AND quantity <= min_stock
            ORDER BY quantity ASC
            LIMIT 5
        """)
        if not low_items:
            ans = "Omborda barcha tovarlar yetarli miqdorda mavjud. Kam qolgan tovarlar yo'q! 🟢"
            return {"answer": ans, "voice_text": ans, "action": None}

        items_text = "\n".join([f"• <b>{r['name']}</b>: {r['quantity']} {r['unit']} (Min: {r['min_stock']})" for r in low_items])
        ans = f"⚠️ <b>Omborda kam qolgan tovarlar:</b>\n\n{items_text}\n\n<i>Katalogdan to'liq ro'yxatni ko'rishingiz mumkin.</i>"
        v_ans = f"Omborda {len(low_items)} ta tovar kam qolgan: " + ", ".join([f"{r['name']} {r['quantity']} {r['unit']}" for r in low_items[:3]])
        return {
            "answer": ans,
            "voice_text": v_ans,
            "action": {
                "type": "NAVIGATE_TAB",
                "tab": "inventory",
                "params": {"stock_status": "low_stock"},
                "label": "📦 Kam tovarlarni ko'rish"
            }
        }

    # 13. Intent: SALES TODAY (Admins only)
    if re.search(r"\b(bugun|bugungi|sotildi|sotuvlar|tushum|сегодня|продано|продажи|sales|sold|today)\b", q_lower) and re.search(r"\b(nechta|qancha|qanaqa|сколько|how\s*many|how\s*much|summa)\b", q_lower):
        if not current_user.is_admin:
            return {
                "answer": f"Do'konimiz har kuni soat {SHOP_WORK_HOURS} gacha xizmat ko'rsatadi. Mahsulotlar narxi va mavjudligini bemalol so'rashingiz mumkin.",
                "voice_text": f"Do'konimiz har kuni soat {SHOP_WORK_HOURS} gacha xizmat ko'rsatadi.",
                "action": None
            }

        sales_today = await db.fetchrow("""
            SELECT 
                COUNT(*) as tx_count,
                COALESCE(SUM(quantity), 0) as total_qty,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(profit), 0) as total_profit
            FROM transactions
            WHERE type = 'chiqim'
              AND created_at >= CURRENT_DATE
        """)

        qty = sales_today["total_qty"] if sales_today else 0
        rev = sales_today["total_revenue"] if sales_today else 0
        prof = sales_today["total_profit"] if sales_today else 0

        ans = (
            f"📊 <b>Bugungi sotuvlar ko'rsatkichi:</b>\n\n"
            f"• Sotilgan tovarlar: <b>{qty} dona</b>\n"
            f"• Jami tushum: <b>{rev:,} UZS</b>\n"
            f"• Sof foyda: <b>{prof:,} UZS</b>\n\n"
            f"Kassa bo'limida har bir tranzaksiya tafsilotlarini tekshirishingiz mumkin."
        )
        v_ans = f"Bugun jami {qty} dona mahsulot sotildi, umumiy tushum {rev:,} so'm."
        return {
            "answer": ans,
            "voice_text": v_ans,
            "action": {
                "type": "NAVIGATE_TAB",
                "tab": "transactions",
                "label": "📜 Kassa tarixini ko'rish"
            }
        }

    # 14. Intent: FULL DATABASE PRODUCT SEARCH & STOCK / PRICE INQUIRIES
    entities = extract_entities(norm_q)
    matches = await search_products_full_db(norm_q, entities)
    user_intent = entities.get("intent") or detect_user_intent(q)

    if matches:
        if len(matches) == 1:
            p = matches[0]
            qty = p.get("quantity", 0)
            price = p.get("selling_price", 0)
            unit = p.get("unit", "dona")
            sku = p.get("sku", "")
            shelf = p.get("shelf_location", "")
            cat_name = p.get("category_name", "Kuzov")
            desc = (p.get("description") or "").strip()

            if qty == 0:
                stock_badge = "🔴 Hozirda tugagan (0 dona)"
                v_status = "omborda hozircha tugagan"
            elif qty <= p.get("min_stock", 2):
                stock_badge = f"🟡 Kam qoldi ({qty} {unit})"
                v_status = f"kam qolgan, {qty} {unit} mavjud"
            else:
                stock_badge = f"🟢 Mavjud ({qty} {unit})"
                v_status = f"omborda {qty} {unit} mavjud"

            # Intent-aware dynamic headline
            if user_intent == "availability":
                if qty > 0:
                    header = f"✅ Ha, <b>{p['name']}</b> omborda mavjud."
                else:
                    header = f"⚠️ <b>{p['name']}</b> bazada mavjud, ammo hozirda qoldiq tugagan (0 dona)."
            elif user_intent == "price":
                header = f"💰 <b>{p['name']}</b> narxi: <b>{price:,} so‘m</b>"
            elif user_intent == "stock":
                header = f"📊 Omborda <b>{p['name']}</b> dan <b>{qty} {unit}</b> qolgan ({stock_badge})"
            elif user_intent == "price_and_stock":
                header = f"✅ <b>{p['name']}</b> narxi va qoldig‘i:"
            else:
                header = f"✅ <b>Mahsulot ma'lumotlari:</b>"

            lines = [
                header,
                "",
                f"📦 <b>Mahsulot:</b> {p['name']}",
                f"💰 <b>Narxi:</b> {price:,} so‘m",
                f"📊 <b>Qoldiq:</b> {qty} {unit} ({stock_badge})",
                f"📁 <b>Kategoriya:</b> {cat_name}"
            ]
            if desc and not desc.startswith("Ovoz orqali"):
                lines.append(f"📝 <b>Tavsif:</b> {desc}")
            
            extra_details = []
            if shelf:
                extra_details.append(f"📍 Polka: <b>{shelf}</b>")
            if sku:
                extra_details.append(f"🏷️ Artikul: <code>{sku}</code>")
            if extra_details:
                lines.append(" | ".join(extra_details))

            ans = "\n".join(lines)
            v_ans = f"{p['name']}, narxi {price:,} so'm. {v_status}."

            return {
                "answer": ans,
                "voice_text": v_ans,
                "action": {
                    "type": "VIEW_PRODUCT",
                    "product_id": p["id"],
                    "label": "👁️ Mahsulotni ko'rish"
                }
            }
        else:
            # Multiple matches found
            items_list = []
            for idx, p in enumerate(matches, 1):
                p_qty = p.get("quantity", 0)
                p_price = p.get("selling_price", 0)
                p_unit = p.get("unit", "dona")
                p_shelf = p.get("shelf_location", "")
                p_cat = p.get("category_name", "Kuzov")
                st = "🟢" if p_qty > 2 else ("🟡" if p_qty > 0 else "🔴 Tugagan")
                item_str = (
                    f"{idx}️⃣ <b>{p['name']}</b>\n"
                    f"   💰 Narxi: <b>{p_price:,} so‘m</b> | 📊 Qoldiq: <b>{p_qty} {p_unit}</b> ({st})\n"
                    f"   📁 Kategoriya: {p_cat}"
                )
                if p_shelf:
                    item_str += f" | 📍 Polka: {p_shelf}"
                items_list.append(item_str)

            search_label = f"{entities.get('car_model') or entities.get('car_brand') or ''} {entities.get('part_name') or ''}".strip()
            if not search_label:
                search_label = "So‘ralgan qism"

            if user_intent == "price":
                header = f"💰 <b>{search_label} bo‘yicha topilgan narxlar ({len(matches)} ta):</b>"
            elif user_intent == "stock":
                header = f"📦 <b>{search_label} bo‘yicha ombordagi qoldiqlar ({len(matches)} ta):</b>"
            else:
                header = f"🔍 <b>{search_label} bo‘yicha topilgan mahsulotlar ({len(matches)} ta):</b>"

            ans = f"{header}\n\n" + "\n\n".join(items_list)
            v_ans = f"Topilgan mahsulotlar: " + ", ".join([f"{p['name']} ({p['selling_price']:,} so'm)" for p in matches[:2]])
            return {
                "answer": ans,
                "voice_text": v_ans,
                "action": {
                    "type": "VIEW_PRODUCT",
                    "product_id": matches[0]["id"],
                    "label": "👁️ Birinchisini ko'rish"
                }
            }

    # 15. Fallback: Product not found or general inquiry
    req_model = entities.get("car_model") or entities.get("car_brand")
    req_part = entities.get("raw_part_query") or entities.get("part_name")

    if req_model and req_model.lower() != "umumiy" and req_part:
        product_display = f"{req_model} {req_part}"
    elif req_model and req_model.lower() != "umumiy":
        product_display = f"{req_model} uchun so‘ralgan mahsulot"
    elif req_part:
        product_display = req_part
    else:
        product_display = f"\"{q}\""

    ans = (
        f"❌ <b>{product_display}</b> bazada topilmadi.\n\n"
        f"Kechirasiz, ushbu mahsulot hozirda omborimizda mavjud emas.\n\n"
        f"📦 <b>Buyurtma berish yoki keltirish vaqtini aniqlashtirish uchun:</b>\n"
        f"📞 Telefon: <b>{SHOP_PHONE}</b>\n"
        f"💬 Telegram: <b>{SHOP_TELEGRAM}</b>\n"
        f"🕒 Ish vaqti: <b>{SHOP_WORK_HOURS}</b>"
    )
    return {
        "answer": ans,
        "voice_text": None,
        "action": {
            "type": "NAVIGATE_TAB",
            "tab": "products",
            "label": "🏷️ Katalogda qidirish"
        }
    }
