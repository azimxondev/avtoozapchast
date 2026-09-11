/* =====================================================
   AVTO SKLAD — Centralized API Client
   ===================================================== */

async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json" };
    if (initData) {
        headers["X-Telegram-Init-Data"] = initData;
    }

    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Xatolik: ${res.status}`);
    }
    return res.json();
}
