/* =====================================================
   AVTO SKLAD — Detailed Statistics JS
   ===================================================== */

async function renderStatistics() {
    const $tabContent = document.getElementById("tab-content");
    if (!$tabContent) return;

    $tabContent.innerHTML = `
        <div class="section-title">📊 Kengaytirilgan Sklad Hisoboti</div>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-label">Jami Mahsulotlar</div>
                <div class="stat-value">${overviewStats.total_products} tur</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-label">Jami Ombordagi Miqdor</div>
                <div class="stat-value">${Number(overviewStats.total_quantity).toLocaleString("uz-UZ")} dona</div>
            </div>
            <div class="stat-card full-width">
                <div class="stat-icon">💎</div>
                <div class="stat-label">Ombor Balansi / Sof Qiymat</div>
                <div class="stat-value green" style="font-size:24px">${formatPrice(overviewStats.stock_value)}</div>
            </div>
        </div>
    `;
}
