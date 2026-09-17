"""
Avto Sklad — Unified Async Database Layer
Supports PostgreSQL (via asyncpg) with automatic local SQLite fallback (via aiosqlite).
"""

import os
import re
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from contextlib import asynccontextmanager

from app.config import DATABASE_URL, SQLITE_DB_PATH, INITIAL_BUDGET

TZ_TASHKENT = timezone(timedelta(hours=5))

class Database:
    def __init__(self):
        self.is_pg: bool = False
        self.pg_pool = None
        self.sqlite_conn = None
        self._active_db_type: str = "none"
        self._in_transaction: bool = False

    async def connect(self):
        if DATABASE_URL and ("postgres" in DATABASE_URL.lower()):
            try:
                import asyncpg
                # Neon/cloud ssl mode
                clean_url = DATABASE_URL.split("?")[0] if "?" in DATABASE_URL else DATABASE_URL
                self.pg_pool = await asyncpg.create_pool(clean_url, ssl="require", min_size=1, max_size=10, timeout=15)
                self.is_pg = True
                self._active_db_type = "postgresql"
                print("[DB] PostgreSQL (Neon/Remote) ga ulandi!")
                return
            except Exception as e:
                print(f"[DB Warning] PostgreSQL ulanish muvaffaqiyatsiz ({e}). SQLite fallback ga o'tilmoqda...")

        # SQLite fallback
        import aiosqlite
        self.is_pg = False
        self.sqlite_conn = await aiosqlite.connect(str(SQLITE_DB_PATH), timeout=30.0)
        self.sqlite_conn.row_factory = aiosqlite.Row
        await self.sqlite_conn.execute("PRAGMA foreign_keys = ON")
        await self.sqlite_conn.execute("PRAGMA journal_mode = WAL")
        self._active_db_type = "sqlite"
        print(f"[DB] Mahalliy SQLite ishga tushdi: {SQLITE_DB_PATH}")

    async def close(self):
        if self.is_pg and self.pg_pool:
            await self.pg_pool.close()
        elif self.sqlite_conn:
            await self.sqlite_conn.close()

    def _convert_query(self, query: str, args: tuple) -> tuple[str, list]:
        """Convert $1, $2 query parameters to ? for SQLite and align arguments."""
        if self.is_pg:
            return query, list(args)

        matches = list(re.finditer(r'\$(\d+)', query))
        new_args = []
        if matches:
            for m in matches:
                idx = int(m.group(1)) - 1
                if 0 <= idx < len(args):
                    new_args.append(args[idx])
                else:
                    new_args.append(None)
            converted = re.sub(r'\$\d+', '?', query)
        else:
            converted = query
            new_args = list(args)

        # Replace TIMESTAMPTZ with TIMESTAMP
        converted = converted.replace("TIMESTAMPTZ", "TIMESTAMP")
        # Replace BIGSERIAL/SERIAL with INTEGER PRIMARY KEY AUTOINCREMENT
        converted = converted.replace("BIGSERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        converted = converted.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        # Replace NOW() with datetime('now', '+5 hours') or CURRENT_TIMESTAMP
        converted = converted.replace("NOW()", "CURRENT_TIMESTAMP")
        return converted, new_args

    async def execute(self, query: str, *args: Any) -> Any:
        if self.is_pg:
            async with self.pg_pool.acquire() as conn:
                return await conn.execute(query, *args)
        else:
            conv_q, conv_args = self._convert_query(query, args)
            cursor = await self.sqlite_conn.execute(conv_q, conv_args)
            if not self._in_transaction:
                await self.sqlite_conn.commit()
            return cursor.lastrowid

    async def fetch(self, query: str, *args: Any) -> list[dict]:
        if self.is_pg:
            async with self.pg_pool.acquire() as conn:
                rows = await conn.fetch(query, *args)
                return [dict(r) for r in rows]
        else:
            conv_q, conv_args = self._convert_query(query, args)
            cursor = await self.sqlite_conn.execute(conv_q, conv_args)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def fetchrow(self, query: str, *args: Any) -> Optional[dict]:
        if self.is_pg:
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(query, *args)
                return dict(row) if row else None
        else:
            conv_q, conv_args = self._convert_query(query, args)
            cursor = await self.sqlite_conn.execute(conv_q, conv_args)
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def fetchval(self, query: str, *args: Any) -> Any:
        if self.is_pg:
            async with self.pg_pool.acquire() as conn:
                return await conn.fetchval(query, *args)
        else:
            conv_q, conv_args = self._convert_query(query, args)
            cursor = await self.sqlite_conn.execute(conv_q, conv_args)
            row = await cursor.fetchone()
            return row[0] if row else None

    @asynccontextmanager
    async def transaction(self):
        """Atomic transaction context manager."""
        if self.is_pg:
            async with self.pg_pool.acquire() as conn:
                async with conn.transaction():
                    yield conn
        else:
            self._in_transaction = True
            try:
                await self.sqlite_conn.execute("BEGIN IMMEDIATE TRANSACTION")
                yield self.sqlite_conn
                await self.sqlite_conn.commit()
            except Exception:
                try:
                    await self.sqlite_conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            finally:
                self._in_transaction = False

db = Database()
