"""Products business logic service."""

from app.database import queries
from app.products.schemas import ProductCreate, ProductUpdate


async def get_all_products() -> list[dict]:
    return await queries.get_all_products()


async def get_product_by_id(product_id: int) -> dict | None:
    return await queries.get_product(product_id)


async def create_new_product(data: ProductCreate) -> dict:
    return await queries.create_product(
        name=data.name,
        quantity=data.quantity,
        price=data.price,
        description=data.description or "",
        condition=data.condition,
    )


async def update_existing_product(product_id: int, data: ProductUpdate) -> dict | None:
    return await queries.update_product(
        product_id=product_id,
        name=data.name,
        price=data.price,
        description=data.description or "",
        condition=data.condition,
    )


async def delete_existing_product(product_id: int) -> bool:
    return await queries.delete_product(product_id)
