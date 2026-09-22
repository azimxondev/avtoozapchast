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
    "BMW", "MERCEDES", "AUDI", "CHEVROLET", "DAEWOO", "TOYOTA", "HYUNDAI",
    "KIA", "VOLKSWAGEN", "NISSAN", "HONDA", "LADA", "BYD", "GEELY", "CHERY"
]

CAR_MODELS = {
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
    "qanot": ("Krilo (Qanot)", ["kuzov", "body"]),
    "крыло": ("Krilo", ["kuzov", "body"]),
    "fender": ("Krilo", ["kuzov", "body"]),
    "eshik": ("Eshik", ["kuzov", "body"]),
    "дверь": ("Eshik", ["kuzov", "body"]),
    "door": ("Eshik", ["kuzov", "body"]),
    "panjara": ("Panjara (Reshyotka)", ["kuzov", "body"]),
    "gril": ("Panjara (Gril)", ["kuzov", "body"]),
    
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
    ]
    for pattern, repl in replacements:
        t = re.sub(pattern, repl, t, flags=re.IGNORECASE)
    return t

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
    Extracts automotive entities (brand, model, part type, raw name).
    Uses phonetic normalization to catch typos.
    """
    t = normalize_phonetic_uzbek(text)
    detected_brand = ""
    detected_model = ""
    detected_part = ""
    detected_part_key = ""
    matched_category_hint = []

    # Detect Car Brand
    for b in CAR_BRANDS:
        if re.search(r"\b" + re.escape(b.lower()) + r"\b", t):
            detected_brand = b if len(b) <= 3 else b.title()
            break

    # Detect Car Model
    for m_key, (brand_hint, model_name) in CAR_MODELS.items():
        if re.search(r"\b" + re.escape(m_key.lower()) + r"\b", t):
            detected_model = model_name
            if not detected_brand:
                detected_brand = brand_hint
            break

    # Detect Part Name
    for p_key, (part_canonical, cat_hints) in PART_KEYWORDS.items():
        if re.search(r"\b" + re.escape(p_key.lower()) + r"\b", t):
            detected_part = part_canonical
            detected_part_key = p_key
            matched_category_hint.extend(cat_hints)
            break

    # Build clean product title
    title_parts = []
    if detected_brand:
        title_parts.append(detected_brand)
    if detected_model and detected_model not in title_parts:
        title_parts.append(detected_model)
    if detected_part:
        title_parts.append(detected_part)

    # Fallback to cleaned text if no specific part matched
    if not title_parts:
        cleaned = re.sub(r"\b\d+[\s\w]*", "", text).strip()
        cleaned = re.sub(r"(qo'sh|qush|narxi|dona|ta|bor|ming|som|сум|цена|add|price)\b.*", "", cleaned, flags=re.I).strip()
        fallback_name = cleaned.title() if len(cleaned) >= 3 else "Avto Ehtiyot Qism"
    else:
        fallback_name = " ".join(title_parts)

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
        "sku": sku,
        "category_hints": matched_category_hint
    }

async def search_products_full_db(query_text: str, entities: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Exhaustively searches the products database for matching parts with ranking.
    Returns up to 4 closest matching products.
    Strictly adheres to car_model if specified by user to avoid wrong part recommendations.
    """
    car_model = entities.get("car_model")
    car_brand = entities.get("car_brand")
    part_key = entities.get("part_key")
    brand_or_model = car_model or car_brand

    stop_words = {
        "nechta", "necta", "nchta", "qoldi", "topib", "ber", "bor", "bormi", "bomi", "menga", 
        "narxi", "narhi", "qancha", "qanca", "pul", "so'm", "som", "yana", "iltimos", "kerak",
        "dona", "ta", "nechi", "necha", "skolko", "stoit", "how", "many", "much", "mahsulot",
        "disam", "desam", "haqida", "malumot", "bosa", "bo'lsa", "agar"
    }
    raw_words = [w for w in re.findall(r"[\w']+", query_text.lower()) if len(w) >= 3 and not w.isdigit() and w not in stop_words]

    # CASE A: A specific car model or brand was specified (e.g. Spark, Nexia, Cobalt, Gentra, Damas, Matiz, Tracker, Malibu)
    if brand_or_model and brand_or_model.lower() != "umumiy":
        # 1. Search brand/model + part_key
        if part_key:
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

        # 2. Search brand/model + other meaningful query words
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
        # NEVER return parts from another car model (e.g. do not return Nexia bakavoy for Spark)!
        return []

    # CASE B: No specific car model was requested (general part search)
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

    is_qty_query = bool(re.search(r"\b(nechta|necta|nchta|qancha|qoldi|bor\s*mi|bormi|bomi|dona|skolko|how\s*many)\b", q_lower))
    is_price_query = bool(re.search(r"\b(narxi|narhi|pul|so'm|som|qanchadan|stoit|price|cost|how\s*much)\b", q_lower))

    if matches:
        if len(matches) == 1:
            p = matches[0]
            qty = p.get("quantity", 0)
            price = p.get("selling_price", 0)
            unit = p.get("unit", "dona")
            sku = p.get("sku", "")
            shelf = p.get("shelf_location", "A-01")

            if qty == 0:
                status_text = "🔴 Hozirda tugagan (0 dona)"
                v_status = "omborda hozircha qolmagan"
            elif qty <= p.get("min_stock", 2):
                status_text = f"🟡 Kam qoldi ({qty} {unit})"
                v_status = f"kam qolgan, {qty} {unit} mavjud"
            else:
                status_text = f"🟢 Omborda bor ({qty} {unit})"
                v_status = f"omborda {qty} {unit} mavjud"

            if is_qty_query:
                ans = (
                    f"📦 Omborda <b>{p['name']}</b> dan <b>{qty} {unit}</b> bor! {status_text}\n\n"
                    f"• Narxi: <b>{price:,} UZS</b>\n"
                    f"• Tokcha (Polka): <b>{shelf}</b>\n"
                    f"• Artikul (SKU): <code>{sku}</code>"
                )
                v_ans = f"Omborda {p['name']} dan {qty} {unit} bor. Narxi {price:,} so'm."
            elif is_price_query:
                ans = (
                    f"💰 <b>{p['name']}</b> narxi: <b>{price:,} UZS</b>.\n\n"
                    f"• Ombordagi qoldiq: <b>{qty} {unit}</b> ({status_text})\n"
                    f"• Tokcha (Polka): <b>{shelf}</b>\n"
                    f"• Artikul (SKU): <code>{sku}</code>"
                )
                v_ans = f"{p['name']} narxi {price:,} so'm. Omborda {qty} {unit} mavjud."
            else:
                ans = (
                    f"📦 <b>{p['name']}</b>\n\n"
                    f"• Holati: <b>{status_text}</b>\n"
                    f"• Narxi: <b>{price:,} UZS</b>\n"
                    f"• Tokcha (Polka): <b>{shelf}</b>\n"
                    f"• Artikul (SKU): <code>{sku}</code>"
                )
                v_ans = f"{p['name']}, {v_status}. Narxi {price:,} so'm."

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
            for p in matches:
                p_qty = p.get("quantity", 0)
                p_price = p.get("selling_price", 0)
                p_unit = p.get("unit", "dona")
                p_shelf = p.get("shelf_location", "A-01")
                st = "🟢" if p_qty > 2 else ("🟡" if p_qty > 0 else "🔴")
                items_list.append(f"• <b>{p['name']}</b>\n  Narxi: <b>{p_price:,} UZS</b> | Qoldiq: <b>{p_qty} {p_unit}</b> {st} | Polka: <b>{p_shelf}</b>")

            if is_price_query:
                header = f"💰 <b>Topilgan mahsulotlar narxlari ({len(matches)} ta):</b>"
            elif is_qty_query:
                header = f"📦 <b>Topilgan mahsulotlar qoldig'i ({len(matches)} ta):</b>"
            else:
                header = f"🔍 <b>Topilgan mahsulotlar ({len(matches)} ta):</b>"

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
    req_part = entities.get("part_name")
    if req_model and req_model.lower() != "umumiy" and req_part:
        part_desc = f"<b>{req_model}</b> uchun <i>{req_part}</i>"
    elif req_model and req_model.lower() != "umumiy":
        part_desc = f"<b>{req_model}</b> uchun so'ralgan ehtiyot qism"
    elif req_part:
        part_desc = f"<i>{req_part}</i>"
    else:
        part_desc = f"<i>\"{q}\"</i>"

    ans = (
        f"Kechirasiz, omborimizda {part_desc} hozirda mavjud emas yoki tugagan. ❌\n\n"
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
