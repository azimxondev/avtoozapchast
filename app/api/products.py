"""Products API — CRUD + kirim/chiqim endpoints."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_admin, get_current_user
from app.database import queries
from app.schemas.product import ProductCreate, ProductUpdate, StockChange

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("")
async def list_products(user: dict = Depends(get_current_user)):
    """Barcha mahsulotlar ro'yxati."""
    return await queries.get_all_products()


@router.get("/{product_id}")
async def get_product(product_id: int, user: dict = Depends(get_current_user)):
    """Bitta mahsulot tafsilotlari."""
    product = await queries.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")
    return product


@router.post("", status_code=201)
async def create_product(data: ProductCreate, admin: dict = Depends(get_current_admin)):
    """Yangi mahsulot qo'shish (faqat admin)."""
    return await queries.create_product(
        name=data.name,
        quantity=data.quantity,
        price=data.price,
        description=data.description,
        condition=data.condition,
    )


@router.patch("/{product_id}")
async def update_product(product_id: int, data: ProductUpdate, admin: dict = Depends(get_current_admin)):
    """Mahsulotni tahrirlash (faqat admin)."""
    result = await queries.update_product(
        product_id=product_id,
        name=data.name,
        price=data.price,
        description=data.description,
        condition=data.condition,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")
    return result


@router.delete("/{product_id}")
async def delete_product(product_id: int, admin: dict = Depends(get_current_admin)):
    """Mahsulotni o'chirish (faqat admin)."""
    ok = await queries.delete_product(product_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")
    return {"ok": True}


@router.post("/{product_id}/in")
async def product_stock_in(product_id: int, data: StockChange, admin: dict = Depends(get_current_admin)):
    """Kirim: omborga tovar qo'shish (faqat admin)."""
    try:
        return await queries.stock_in(product_id, data.amount, admin["id"])
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{product_id}/out")
async def product_stock_out(product_id: int, data: StockChange, admin: dict = Depends(get_current_admin)):
    """Chiqim: ombordan tovar sotish (faqat admin)."""
    try:
        return await queries.stock_out(product_id, data.amount, admin["id"])
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
