"""Pydantic schemas for products."""

from pydantic import BaseModel, Field
from typing import Optional


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(0, ge=0)
    price: int = Field(0, ge=0)
    description: str = ""
    condition: str = Field("NEW", pattern="^(NEW|USED)$")


class ProductUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: int = Field(0, ge=0)
    description: str = ""
    condition: str = Field("NEW", pattern="^(NEW|USED)$")


class StockChange(BaseModel):
    amount: int = Field(..., gt=0, description="Kirim/Chiqim miqdori")
