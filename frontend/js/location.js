/* =====================================================
   AVTO SKLAD — Shop Location JS
   ===================================================== */

let shopInfo = { address: "", google_maps_url: "", yandex_maps_url: "" };

function renderLocation() {
    const $tabContent = document.getElementById("tab-content");
    if (!$tabContent) return;

    $tabContent.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:24px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">📍</div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px">${escapeHtml(shopInfo.address) || "Do'kon manzili ko'rsatilmagan"}</div>
            <div style="display:flex;flex-direction:column;gap:10px">
                ${shopInfo.google_maps_url ? `
                    <a href="${shopInfo.google_maps_url}" target="_blank" class="btn btn-primary btn-full" style="text-decoration:none">
                        🗺 Google Maps da ochish
                    </a>
                ` : ""}
                ${shopInfo.yandex_maps_url ? `
                    <a href="${shopInfo.yandex_maps_url}" target="_blank" class="btn btn-ghost btn-full" style="text-decoration:none">
                        🗺 Yandex Xaritada ochish
                    </a>
                ` : ""}
            </div>
        </div>
    `;
}
