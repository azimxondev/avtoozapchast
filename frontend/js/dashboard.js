/* =====================================================
   AVTO SKLAD — Dashboard Module
   ===================================================== */

let overviewStats = { total_products: 0, total_quantity: 0, stock_value: 0 };
let periodStats = { total_sales: 0, total_income: 0, items_sold: 0, items_received: 0 };
let currentPeriod = "daily";

async function loadPeriodStats() {
    try {
        periodStats = await api(`/api/statistics/${currentPeriod}`);
    } catch (e) {
        console.warn("Period stats error:", e);
    }
}

function renderDashboard() {
    const $tabContent = document.getElementById("tab-content");
    if (!$tabContent) return;

    const periodLabels = {
        daily: "Bugungi",
        weekly: "Haftalik",
        monthly: "Oylik",
        yearly: "Yillik",
    };

    $tabContent.innerHTML = `
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-label">Mahsulotlar</div>
                <div class="stat-value">${overviewStats.total_products} tur</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-label">Jami qoldiq</div>
                <div class="stat-value">${Number(overviewStats.total_quantity).toLocaleString("uz-UZ")} dona</div>
            </div>
            <div class="stat-card full-width">
                <div class="stat-icon">💰</div>
                <div class="stat-label">Sklad qiymati</div>
                <div class="stat-value green">${formatPrice(overviewStats.stock_value)}</div>
            </div>
        </div>

        <div class="section-title">📈 Sotuv hisobi</div>
        <div class="period-switcher">
            <button class="period-btn ${currentPeriod === "daily" ? "active" : ""}" data-period="daily">Kun</button>
            <button class="period-btn ${currentPeriod === "weekly" ? "active" : ""}" data-period="weekly">Hafta</button>
            <button class="period-btn ${currentPeriod === "monthly" ? "active" : ""}" data-period="monthly">Oy</button>
            <button class="period-btn ${currentPeriod === "yearly" ? "active" : ""}" data-period="yearly">Yil</button>
        </div>

        <div class="sales-row">
            <div class="sales-card">
                <div class="sales-label">📤 ${periodLabels[currentPeriod]} sotuv</div>
                <div class="sales-value" style="color:var(--accent-rose)">${formatPrice(periodStats.total_sales)}</div>
            </div>
            <div class="sales-card">
                <div class="sales-label">📥 ${periodLabels[currentPeriod]} kirim</div>
                <div class="sales-value" style="color:var(--accent-emerald)">${formatPrice(periodStats.total_income)}</div>
            </div>
        </div>

        <div class="sales-row">
            <div class="sales-card">
                <div class="sales-label">📦 Sotilgan</div>
                <div class="sales-value" style="color:var(--accent-amber)">${periodStats.items_sold} dona</div>
            </div>
            <div class="sales-card">
                <div class="sales-label">📦 Qabul qilingan</div>
                <div class="sales-value" style="color:var(--accent-indigo)">${periodStats.items_received} dona</div>
            </div>
        </div>
    `;

    document.querySelectorAll(".period-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            currentPeriod = btn.dataset.period;
            document.querySelectorAll(".period-btn").forEach((b) =>
                b.classList.toggle("active", b.dataset.period === currentPeriod)
            );
            await loadPeriodStats();
            renderDashboard();
        });
    });
}
