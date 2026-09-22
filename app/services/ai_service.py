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

CAR_BRANDS = [
    "BMW", "MERCEDES", "AUDI", "CHEVROLET", "DAEWOO", "TOYOTA", "HYUNDAI",
    "KIA", "VOLKSWAGEN", "NISSAN", "HONDA", "LADA", "BYD", "GEELY", "CHERY"
]

CAR_MODELS = {
    "COBALT": ("Chevrolet", "Cobalt"),
    "GENTRA": ("Chevrolet", "Gentra"),
    "NEXIA": ("Chevrolet", "Nexia 3"),
    "NEXIA 3": ("Chevrolet", "Nexia 3"),
    "NEXIA 2": ("Daewoo", "Nexia 2"),
    "NEXIA 1": ("Daewoo", "Nexia 1"),
    "TRACKER": ("Chevrolet", "Tracker 2"),
    "TRACKER 2": ("Chevrolet", "Tracker 2"),
    "MALIBU": ("Chevrolet", "Malibu 2"),
    "MALIBU 2": ("Chevrolet", "Malibu 2"),
    "ONIX": ("Chevrolet", "Onix"),
    "SPARK": ("Chevrolet", "Spark"),
    "DAMAS": ("Chevrolet", "Damas"),
    "LABO": ("Chevrolet", "Labo"),
    "MATIZ": ("Daewoo", "Matiz"),
    "CAPTIVA": ("Chevrolet", "Captiva"),
    "EPICA": ("Chevrolet", "Epica"),
    "LACETTI": ("Chevrolet", "Lacetti"),
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
}

PART_KEYWORDS = {
    "bamper": ("Bamper", ["kuzov", "body", "bamper"]),
    "bumper": ("Bamper", ["kuzov", "body", "bamper"]),
    "бампер": ("Bamper", ["kuzov", "body", "bamper"]),
    "fara": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "фара": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "headlight": ("Fara", ["optika", "optics", "chiroq", "fara"]),
    "chiroq": ("Chiroq", ["optika", "optics", "chiroq"]),
    "stop": ("Stop signal", ["optika", "optics"]),
    "фонарь": ("Stop chiroq", ["optika", "optics"]),
    "kapot": ("Kapot", ["kuzov", "body"]),
    "капот": ("Kapot", ["kuzov", "body"]),
    "hood": ("Kapot", ["kuzov", "body"]),
    "krilo": ("Krilo", ["kuzov", "body"]),
    "крыло": ("Krilo", ["kuzov", "body"]),
    "fender": ("Krilo", ["kuzov", "body"]),
    "eshik": ("Eshik", ["kuzov", "body"]),
    "дверь": ("Eshik", ["kuzov", "body"]),
    "door": ("Eshik", ["kuzov", "body"]),
    "oyna": ("Oyna", ["oyna", "shisha", "glass"]),
    "стекло": ("Oyna", ["oyna", "shisha", "glass"]),
    "glass": ("Oyna", ["oyna", "shisha", "glass"]),
    "radiator": ("Radiator", ["sovutish", "radiator", "cooling"]),
    "радиатор": ("Radiator", ["sovutish", "radiator", "cooling"]),
    "kalodka": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "колодки": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "pads": ("Tormoz kalodkasi", ["tormoz", "brake"]),
    "tormoz": ("Tormoz qismi", ["tormoz", "brake"]),
    "тормоз": ("Tormoz qismi", ["tormoz", "brake"]),
    "amortizator": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "амортизатор": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "strut": ("Amortizator", ["xodovoy", "podveska", "suspension"]),
    "filtr": ("Filtr", ["filtr", "filter"]),
    "filter": ("Filtr", ["filtr", "filter"]),
    "фильтр": ("Filtr", ["filtr", "filter"]),
    "moy": ("Motor moyi", ["moy", "oil"]),
    "масло": ("Motor moyi", ["moy", "oil"]),
    "oil": ("Motor moyi", ["moy", "oil"]),
    "akkumulyator": ("Akkumulyator", ["elektr", "battery"]),
    "аккумулятор": ("Akkumulyator", ["elektr", "battery"]),
    "battery": ("Akkumulyator", ["elektr", "battery"]),
    "generator": ("Generator", ["elektr", "generator"]),
    "генератор": ("Generator", ["elektr", "generator"]),
    "starter": ("Starter", ["elektr", "starter"]),
    "стартер": ("Starter", ["elektr", "starter"]),
    "remen": ("Tasma / Remen", ["dvigatel", "belt"]),
    "ремень": ("Tasma / Remen", ["dvigatel", "belt"]),
    "porshen": ("Porshen", ["dvigatel", "engine"]),
    "поршень": ("Porshen", ["dvigatel", "engine"]),
    "glushitel": ("Glushitel", ["kuzov", "exhaust"]),
    "глушитель": ("Glushitel", ["kuzov", "exhaust"]),
    "svecha": ("Svecha", ["elektr", "spark"]),
    "свеча": ("Svecha", ["elektr", "spark"]),
    "nasos": ("Nasos / Pompa", ["dvigatel", "pump"]),
    "насос": ("Nasos / Pompa", ["dvigatel", "pump"]),
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
# 2. VOICE PRODUCT NLP PARSER
# ==============================================================================

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
    """
    t = text.lower()
    detected_brand = ""
    detected_model = ""
    detected_part = ""
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
        "sku": sku,
        "category_hints": matched_category_hint
    }

async def find_matching_product(query_text: str, entities: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Search DB for existing products that closely match the detected entities.
    """
    car_model = entities.get("car_model")
    car_brand = entities.get("car_brand")
    part_name = entities.get("part_name")

    # 1. Search with both car model/brand and part name
    brand_or_model = car_model or car_brand
    if brand_or_model and part_name:
        row = await db.fetchrow("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND (LOWER(p.car_model) LIKE LOWER($1) OR LOWER(p.car_brand) LIKE LOWER($1) OR LOWER(p.name) LIKE LOWER($1))
              AND (LOWER(p.name) LIKE LOWER($2) OR LOWER(p.description) LIKE LOWER($2))
            ORDER BY p.id DESC LIMIT 1
        """, f"%{brand_or_model}%", f"%{part_name}%")
        if row:
            return dict(row)

    # 2. Search by part name
    if part_name:
        row = await db.fetchrow("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND LOWER(p.name) LIKE LOWER($1)
            ORDER BY p.id DESC LIMIT 1
        """, f"%{part_name}%")
        if row:
            return dict(row)

    # 3. Fuzzy search with words
    stop_words = {"nechta", "qoldi", "topib", "ber", "bor", "bormi", "menga", "narxi", "qancha", "yana"}
    words = [w for w in re.findall(r"\w+", query_text) if len(w) >= 3 and not w.isdigit() and w.lower() not in stop_words]
    for w in words[:3]:
        row = await db.fetchrow("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_deleted = 0
              AND (LOWER(p.name) LIKE LOWER($1) OR LOWER(p.sku) LIKE LOWER($1))
            ORDER BY p.id DESC LIMIT 1
        """, f"%{w}%")
        if row:
            return dict(row)

    return None

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
    Handles user queries, stock lookups, sales data, navigation triggers,
    with strict role-based permission gating and prompt-injection defense.
    """
    if not query or not query.strip():
        return {
            "answer": "Salom! Men Avto Sklad AI yordamchisiman. Mahsulotlar qoldig'i, sotuvlar yoki ombor bo'yicha savollaringiz bo'lsa, marhamat!",
            "action": None
        }

    q = query.strip()
    q_lower = q.lower()
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

    # 4. Intent: LOW STOCK LOOKUP ("Qaysi productdan stock kam?", "Что заканчивается?", "What is low on stock?")
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

    # 5. Intent: SALES TODAY ("Bugun nechta mahsulot sotildi?", "Сколько сегодня продано?", "Sales today?")
    if re.search(r"\b(bugun|bugungi|sotildi|sotuvlar|tushum|сегодня|продано|продажи|sales|sold|today)\b", q_lower) and re.search(r"\b(nechta|qancha|qanaqa|сколько|how\s*many|how\s*much|summa)\b", q_lower):
        if not current_user.is_admin:
            return {
                "answer": "Do'konimiz har kuni soat 08:30 dan 18:30 gacha xizmat ko'rsatadi. Mahsulotlar narxi va mavjudligini bemalol so'rashingiz mumkin.",
                "voice_text": "Do'konimiz har kuni soat 08:30 dan 18:30 gacha xizmat ko'rsatadi.",
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

    # 6. Intent: SPECIFIC PRODUCT STOCK LOOKUP ("BMW bamperdan nechta qoldi?", "Cobalt fara bormi?")
    # Extract entities and search in DB
    entities = extract_entities(q)
    matched = await find_matching_product(q, entities)

    if matched:
        qty = matched["quantity"]
        unit = matched.get("unit", "dona")
        price = matched.get("selling_price", 0)
        sku = matched.get("sku", "")
        shelf = matched.get("shelf_location", "A-01")

        if qty == 0:
            status_text = "🔴 Hozirda qolmagan (Tugagan)"
            v_status = "hozirda omborda tugagan"
        elif qty <= matched.get("min_stock", 2):
            status_text = f"🟡 Kam qoldi ({qty} {unit})"
            v_status = f"kam qolgan, {qty} {unit} mavjud"
        else:
            status_text = f"🟢 Omborda bor ({qty} {unit})"
            v_status = f"omborda {qty} {unit} mavjud"

        ans = (
            f"📦 <b>{matched['name']}</b>\n\n"
            f"• Holati: <b>{status_text}</b>\n"
            f"• Narxi: <b>{price:,} UZS</b>\n"
            f"• Artikul (SKU): <code>{sku}</code>\n"
            f"• Tokcha (Polka): <b>{shelf}</b>"
        )
        v_ans = f"{matched['name']} {v_status}. Narxi {price:,} so'm."
        return {
            "answer": ans,
            "voice_text": v_ans,
            "action": {
                "type": "VIEW_PRODUCT",
                "product_id": matched["id"],
                "label": "👁️ Mahsulotni ko'rish"
            }
        }

    # 7. Intent: GENERAL SEARCH ("BMW mahsulotini topib ber", "Fara qidiring")
    search_words = [w for w in re.findall(r"\w+", q_lower) if len(w) >= 3 and w not in ["nechta", "qoldi", "topib", "ber", "ko'rsat", "bormi", "bor", "menga"]]
    if search_words:
        keyword = search_words[0]
        rows = await db.fetch("""
            SELECT id, name, quantity, selling_price, unit
            FROM products
            WHERE is_deleted = 0
              AND (name LIKE $1 OR car_model LIKE $1 OR sku LIKE $1)
            ORDER BY id DESC LIMIT 4
        """, f"%{keyword}%")

        if rows:
            items_str = "\n".join([f"• <b>{r['name']}</b> — {r['quantity']} {r['unit']} ({r['selling_price']:,} UZS)" for r in rows])
            ans = f"🔍 <b>Topilgan mahsulotlar ({keyword}):</b>\n\n{items_str}"
            v_ans = f"Topilgan mahsulotlar: " + ", ".join([r['name'] for r in rows[:2]])
            return {
                "answer": ans,
                "voice_text": v_ans,
                "action": {
                    "type": "NAVIGATE_TAB",
                    "tab": "products",
                    "params": {"q": keyword},
                    "label": "🔎 Katalogda ko'rish"
                }
            }

    # 8. Intent: RECENT PRODUCTS ("Oxirgi qo‘shilgan mahsulotlarni ko‘rsat")
    if re.search(r"\b(oxirgi|yangi|so'nggi|oxirgi\s*qo'shilgan|последние|новые|recent|latest)\b", q_lower):
        recent_rows = await db.fetch("""
            SELECT id, name, quantity, selling_price, unit
            FROM products
            WHERE is_deleted = 0
            ORDER BY id DESC LIMIT 4
        """)
        if recent_rows:
            items_str = "\n".join([f"• <b>{r['name']}</b> — {r['quantity']} {r['unit']} ({r['selling_price']:,} UZS)" for r in recent_rows])
            ans = f"✨ <b>Oxirgi qo'shilgan mahsulotlar:</b>\n\n{items_str}"
            v_ans = "Oxirgi qo'shilgan mahsulotlar: " + ", ".join([r['name'] for r in recent_rows[:2]])
            return {
                "answer": ans,
                "voice_text": v_ans,
                "action": {
                    "type": "NAVIGATE_TAB",
                    "tab": "products",
                    "label": "🏷️ Katalogga o'tish"
                }
            }

    # 9. Fallback Help & Guidance
    help_reply = {
        "uz": "Savolingizni tushundim. Menga quyidagicha murojaat qilishingiz mumkin:\n\n• <i>\"BMW bamper nechta qoldi?\"</i>\n• <i>\"Bugun nechta mahsulot sotildi?\"</i>\n• <i>\"Kam qolgan tovarlarni ko'rsat\"</i>\n• <i>\"Scannerni och\"</i>\n• <i>\"Cobalt farasini topib ber\"</i>",
        "ru": "Я понял ваш запрос. Вы можете спросить меня:\n\n• <i>\"Сколько бамперов BMW осталось?\"</i>\n• <i>\"Сколько продано сегодня?\"</i>\n• <i>\"Что заканчивается на складе?\"</i>\n• <i>\"Открой сканер\"</i>",
        "en": "I understand. You can ask me things like:\n\n• <i>\"How many BMW bumpers in stock?\"</i>\n• <i>\"What's low on stock?\"</i>\n• <i>\"Open scanner\"</i>\n• <i>\"Sales today?\"</i>"
    }
    ans = help_reply.get(lang, help_reply["uz"])
    return {
        "answer": ans,
        "voice_text": "Avto Sklad yordamchisiga istalgan ehtiyot qism, qoldiq yoki skaner bo'yicha savol berishingiz mumkin.",
        "action": None
    }
