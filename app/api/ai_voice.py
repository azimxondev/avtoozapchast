"""
Avto Sklad — AI Voice Product & Voice Assistant API
Endpoints for speech/text processing, entity extraction, assistant dialogue.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.api.auth import get_current_user, require_staff_or_admin, CurrentUser
from app.services.ai_service import parse_voice_product_input, process_assistant_query

router = APIRouter(prefix="/ai", tags=["AI & Voice"])

class VoiceProductParseRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Ovozdan matnga o'girilgan so'zlar yoki matn")

class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Foydalanuvchi savoli yoki buyrug'i")

@router.post("/parse-voice-product")
async def api_parse_voice_product(
    payload: VoiceProductParseRequest,
    user: CurrentUser = Depends(require_staff_or_admin)
):
    """
    Ovozli matnni mahsulot ma'lumotlariga ajratish (Faqat Admin/Staff):
    - Nom, miqdor, narx, toifa va avtomobil modelini aniqlaydi.
    - Mavjud tovar bo'lsa qoldiqni oshirish (UPDATE) taklif qiladi.
    - Tasdiqlash uchun strukturalangan preview qaytaradi.
    """
    result = await parse_voice_product_input(payload.text, user)
    return result

@router.post("/assistant/chat")
async def api_assistant_chat(
    payload: AssistantChatRequest,
    user: CurrentUser = Depends(get_current_user)
):
    """
    AI Ovozli Yordamchi bilan muloqot:
    - O'zbek, rus va ingliz tillarida savollarga javob beradi.
    - Ombor qoldig'i, sotuvlar, skaner ochish buyruqlarini boshqaradi.
    - Foydalanuvchi roliga qarab ruxsatlarni tekshiradi.
    """
    result = await process_assistant_query(payload.message, user)
    result["voice_text"] = None  # Speech/Voice audio permanently disabled
    return result
