"""Telegram WebApp initData HMAC-SHA256 validation."""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, unquote

from app.config import BOT_TOKEN

# initData maksimal amal qilish muddati (soniyada)
MAX_AUTH_AGE = 86400  # 24 soat


def validate_init_data(init_data: str) -> dict | None:
    """
    Telegram WebApp initData ni tekshirish.

    Qaytaradi:
        dict: user ma'lumotlari (id, first_name, ...)
        None: noto'g'ri yoki muddati o'tgan
    """
    if not init_data or not BOT_TOKEN:
        return None

    try:
        parsed = parse_qs(init_data, keep_blank_values=True)

        # hash ni ajratish
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return None

        # data-check-string tuzish (hash siz, alifbo tartibida)
        data_pairs = []
        for key, values in parsed.items():
            if key == "hash":
                continue
            data_pairs.append(f"{key}={values[0]}")
        data_pairs.sort()
        data_check_string = "\n".join(data_pairs)

        # HMAC-SHA256 tekshirish
        secret_key = hmac.new(
            b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256
        ).digest()

        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        # auth_date muddatini tekshirish
        auth_date_str = parsed.get("auth_date", [None])[0]
        if auth_date_str:
            auth_date = int(auth_date_str)
            if time.time() - auth_date > MAX_AUTH_AGE:
                return None

        # user ma'lumotlarini olish
        user_str = parsed.get("user", [None])[0]
        if not user_str:
            return None

        user_data = json.loads(unquote(user_str))
        return user_data

    except Exception:
        return None
