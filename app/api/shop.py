"""Shop info API — do'kon manzili."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.config import SHOP_ADDRESS, SHOP_LAT, SHOP_LON

router = APIRouter(prefix="/api/shop", tags=["shop"])


@router.get("")
async def shop_info(user: dict = Depends(get_current_user)):
    """Do'kon manzili va xarita havolalari."""
    from urllib.parse import quote
    address_encoded = quote(SHOP_ADDRESS) if SHOP_ADDRESS else ""

    result = {
        "address": SHOP_ADDRESS,
        "google_maps_url": "",
        "yandex_maps_url": "",
    }

    if SHOP_LAT and SHOP_LON:
        result["google_maps_url"] = f"https://www.google.com/maps?q={SHOP_LAT},{SHOP_LON}"
        result["yandex_maps_url"] = f"https://yandex.com/maps/?pt={SHOP_LON},{SHOP_LAT}&z=16&l=map"
    elif SHOP_ADDRESS:
        result["google_maps_url"] = f"https://www.google.com/maps/search/?api=1&query={address_encoded}"
        result["yandex_maps_url"] = f"https://yandex.com/maps/?text={address_encoded}"

    return result
