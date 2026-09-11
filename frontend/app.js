/* =====================================================
   AVTO SKLAD — Telegram Mini App JavaScript
   Dashboard, Sklad, Tarix, Manzil
   ===================================================== */

// ─── Telegram WebApp ───
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
}

// ─── State ───
let products = [];
let transactions = [];
let overviewStats = { total_products: 0, total_quantity: 0, stock_value: 0 };
let periodStats = { total_sales: 0, total_income: 0, items_sold: 0, items_received: 0 };
let shopInfo = { address: "", google_maps_url: "", yandex_maps_url: "" };
let currentPeriod = "daily";
let currentTab = "dashboard";
let isAdmin = false;
let currentUser = null;

// ─── Init Data ───
const initData = tg?.initData || "";
const initUser = tg?.initDataUnsafe?.user;

// ─── DOM ───
const $loading = document.getElementById("loading-screen");
const $error = document.getElementById("error-screen");
const $errorMsg = document.getElementById("error-message");
const $main = document.getElementById("main-content");
const $tabContent = document.getElementById("tab-content");
const $toast = document.getElementById("toast");

// ─── Helpers ───
function formatPrice(num) {
    if (!num && num !== 0) return "0 so'm";
    return Number(num).toLocaleString("uz-UZ").replace(/,/g, " ") + " so'm";
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showToast(msg, type = "") {
    $toast.textContent = msg;
    $toast.className = "toast" + (type ? " " + type : "");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { $toast.classList.add("hidden"); }, 2500);
}

function showError(msg) {
    $loading.classList.add("hidden");
    $main.classList.add("hidden");
    $errorMsg.textContent = msg;
    $error.classList.remove("hidden");
}

// ─── API ───
async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json" };
    if (initData) headers["X-Telegram-Init-Data"] = initData;
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Xatolik: ${res.status}`);
    }
    return res.json();
}

// ─── Data Loading ───
async function loadAllData() {
    try {
        const [prods, stats, period, shop] = await Promise.all([
            api("/api/products"),
            api("/api/statistics"),
            api(`/api/statistics/${currentPeriod}`),
            api("/api/shop"),
        ]);
        products = prods;
        overviewStats = stats;
        periodStats = period;
        shopInfo = shop;
    } catch (e) {
        console.error("Data loading error:", e);
        throw e;
    }
}

async function loadTransactions() {
    try {
        transactions = await api("/api/transactions");
    } catch {
        transactions = [];
    }
}

async function loadPeriodStats() {
    try {
        periodStats = await api(`/api/statistics/${currentPeriod}`);
    } catch {
        // keep existing
    }
}

// ─── NAVIGATION ───
function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            if (tab === currentTab) return;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === tab);
    });
    renderCurrentTab();
}

function renderCurrentTab() {
    $tabContent.style.animation = "none";
    $tabContent.offsetHeight; // reflow
    $tabContent.style.animation = "fadeIn 0.25s ease";

    switch (currentTab) {
        case "dashboard": renderDashboard(); break;
        case "products": renderProducts(); break;
        case "history": renderHistory(); break;
        case "location": renderLocation(); break;
    }
}

// ─── DASHBOARD ───
function renderDashboard() {
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
                <div class="sales-value" style="color:var(--accent-red)">${formatPrice(periodStats.total_sales)}</div>
            </div>
            <div class="sales-card">
                <div class="sales-label">📥 ${periodLabels[currentPeriod]} kirim</div>
                <div class="sales-value" style="color:var(--accent-green)">${formatPrice(periodStats.total_income)}</div>
            </div>
        </div>

        <div class="sales-row">
            <div class="sales-card">
                <div class="sales-label">📦 Sotilgan</div>
                <div class="sales-value" style="color:var(--accent-amber)">${periodStats.items_sold} dona</div>
            </div>
            <div class="sales-card">
                <div class="sales-label">📦 Qabul qilingan</div>
                <div class="sales-value" style="color:var(--accent-blue)">${periodStats.items_received} dona</div>
            </div>
        </div>
    `;

    // Period switcher events
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

// ─── PRODUCTS ───
function renderProducts() {
    let filteredProducts = [...products];
    const searchQuery = "";

    let html = `
        <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" id="search-input" placeholder="Mahsulot qidirish..." autocomplete="off">
        </div>
        <div class="section-title">📦 Mahsulotlar <span style="color:var(--text-muted);font-size:11px;font-weight:500;">(${products.length} ta)</span></div>
        <div class="product-list" id="product-list"></div>
    `;

    $tabContent.innerHTML = html;

    if (isAdmin) {
        const existingFab = document.querySelector('.fab');
        if (!existingFab) {
            const fab = document.createElement("button");
            fab.className = "fab admin-only";
            fab.innerHTML = "+";
            fab.onclick = () => openProductForm();
            $main.appendChild(fab);
        }
    }

    renderProductList(products);

    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = products.filter((p) =>
            p.name.toLowerCase().includes(q)
        );
        renderProductList(filtered);
    });
}

function renderProductList(list) {
    const $list = document.getElementById("product-list");
    if (!$list) return;

    if (list.length === 0) {
        $list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <p>Mahsulot topilmadi</p>
            </div>
        `;
        return;
    }

    $list.innerHTML = list.map((p) => `
        <div class="product-card" onclick="openProductDetail(${p.id})">
            <div class="product-info">
                <div class="product-name">${escapeHtml(p.name)}</div>
                <div class="product-meta">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    <span class="product-qty ${p.quantity <= 3 ? "low" : ""}">${p.quantity} dona</span>
                    <span class="product-badge ${p.condition === "NEW" ? "badge-new" : "badge-used"}">${p.condition === "NEW" ? "Yangi" : "B/U"}</span>
                </div>
            </div>
            <span class="product-arrow">›</span>
        </div>
    `).join("");
}

function escapeHtml(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

// ─── PRODUCT DETAIL MODAL ───
function openProductDetail(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;

    const stockValue = p.quantity * p.price;

    document.getElementById("product-detail-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-header">
            <div>
                <div class="detail-condition ${p.condition === "NEW" ? "badge-new" : "badge-used"}">${p.condition === "NEW" ? "✅ Yangi" : "🔄 B/U"}</div>
                <div class="detail-name">${escapeHtml(p.name)}</div>
                <div class="detail-price">${formatPrice(p.price)}</div>
            </div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div class="detail-info-grid">
            <div class="detail-info-item">
                <div class="detail-info-label">Qoldiq</div>
                <div class="detail-info-value ${p.quantity <= 3 ? "red" : ""}">${p.quantity} dona</div>
            </div>
            <div class="detail-info-item">
                <div class="detail-info-label">Sklad qiymati</div>
                <div class="detail-info-value green" style="font-size:14px">${formatPrice(stockValue)}</div>
            </div>
        </div>

        ${p.description ? `
            <div class="detail-description">
                <h4>Tavsif</h4>
                <p>${escapeHtml(p.description)}</p>
            </div>
        ` : ""}

        ${isAdmin ? `
            <div class="detail-actions" style="margin-bottom:10px">
                <button class="btn btn-danger btn-lg" onclick="openStockModal(${p.id}, 'out')">➖ Chiqim</button>
                <button class="btn btn-success btn-lg" onclick="openStockModal(${p.id}, 'in')">➕ Kirim</button>
            </div>
            <div class="detail-actions">
                <button class="btn btn-ghost" onclick="openProductForm(${p.id})">✏️ Tahrirlash</button>
                <button class="btn btn-ghost" onclick="confirmDeleteProduct(${p.id}, '${escapeHtml(p.name)}')">🗑 O'chirish</button>
            </div>
        ` : ""}
    `;

    showModal("product-detail-modal");
}

// ─── STOCK IN/OUT MODAL ───
let stockModalProductId = null;
let stockModalType = null;
let stockModalAmount = 1;

function openStockModal(productId, type) {
    stockModalProductId = productId;
    stockModalType = type;
    stockModalAmount = 1;

    const p = products.find((x) => x.id === productId);
    if (!p) return;

    renderStockModal(p);
    closeModal("product-detail-modal");
    showModal("stock-modal");
}

function renderStockModal(p) {
    const isOut = stockModalType === "out";
    const totalPrice = stockModalAmount * p.price;
    const newQty = isOut ? p.quantity - stockModalAmount : p.quantity + stockModalAmount;
    const canProceed = isOut ? stockModalAmount <= p.quantity : true;

    document.getElementById("stock-modal-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-header">
            <div class="modal-title">${isOut ? "📤 Chiqim" : "📥 Kirim"}</div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div style="text-align:center;margin-bottom:8px">
            <div style="font-size:15px;font-weight:700;color:var(--text-primary)">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Hozirgi qoldiq: ${p.quantity} dona</div>
        </div>

        <div class="stock-amount-control">
            <button class="stock-amount-btn" onclick="changeStockAmount(-1)">−</button>
            <div class="stock-amount-display">${stockModalAmount}</div>
            <button class="stock-amount-btn" onclick="changeStockAmount(1)">+</button>
        </div>

        <div class="stock-summary">
            <div class="stock-summary-row">
                <span class="label">${isOut ? "Sotiladi" : "Qo'shiladi"}</span>
                <span class="value">${stockModalAmount} dona</span>
            </div>
            <div class="stock-summary-row">
                <span class="label">Dona narxi</span>
                <span class="value">${formatPrice(p.price)}</span>
            </div>
            <div class="stock-summary-row">
                <span class="label">Jami summa</span>
                <span class="value" style="color:${isOut ? "var(--accent-red)" : "var(--accent-green)"}">${formatPrice(totalPrice)}</span>
            </div>
            <div class="stock-summary-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
                <span class="label">Yangi qoldiq</span>
                <span class="value" style="color:${!canProceed ? "var(--accent-red)" : "var(--text-primary)"}">${canProceed ? newQty + " dona" : "❌ Yetarli emas!"}</span>
            </div>
        </div>

        <button
            class="btn ${isOut ? "btn-danger" : "btn-success"} btn-full btn-lg"
            id="stock-confirm-btn"
            ${!canProceed ? "disabled style='opacity:0.4;cursor:not-allowed'" : ""}
            onclick="confirmStockChange()"
        >
            ${isOut ? "📤 Chiqim tasdiqlash" : "📥 Kirim tasdiqlash"}
        </button>
    `;
}

function changeStockAmount(delta) {
    stockModalAmount = Math.max(1, stockModalAmount + delta);
    const p = products.find((x) => x.id === stockModalProductId);
    if (p) renderStockModal(p);
}

async function confirmStockChange() {
    const btn = document.getElementById("stock-confirm-btn");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span> Kutilmoqda...';
    }

    try {
        const endpoint = stockModalType === "out"
            ? `/api/products/${stockModalProductId}/out`
            : `/api/products/${stockModalProductId}/in`;

        await api(endpoint, {
            method: "POST",
            body: JSON.stringify({ amount: stockModalAmount }),
        });

        showToast(
            stockModalType === "out"
                ? `✅ ${stockModalAmount} dona chiqim qilindi`
                : `✅ ${stockModalAmount} dona kirim qilindi`,
            "success"
        );

        closeAllModals();
        await loadAllData();
        renderCurrentTab();
    } catch (e) {
        showToast("❌ " + e.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.textContent = stockModalType === "out" ? "📤 Chiqim tasdiqlash" : "📥 Kirim tasdiqlash";
        }
    }
}

// ─── PRODUCT FORM (ADD/EDIT) ───
function openProductForm(editId) {
    closeAllModals();
    const p = editId ? products.find((x) => x.id === editId) : null;
    const isEdit = !!p;

    document.getElementById("product-form-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-header">
            <div class="modal-title">${isEdit ? "✏️ Tahrirlash" : "➕ Yangi mahsulot"}</div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div class="form-group">
            <label class="form-label">Mahsulot nomi</label>
            <input class="form-input" id="form-name" value="${isEdit ? escapeHtml(p.name) : ""}" placeholder="Masalan: Rul">
        </div>

        <div class="form-group">
            <label class="form-label">Narxi (so'm)</label>
            <input class="form-input" id="form-price" type="number" value="${isEdit ? p.price : ""}" placeholder="500000" inputmode="numeric">
        </div>

        ${!isEdit ? `
            <div class="form-group">
                <label class="form-label">Boshlang'ich miqdor</label>
                <input class="form-input" id="form-qty" type="number" value="0" placeholder="0" inputmode="numeric">
            </div>
        ` : ""}

        <div class="form-group">
            <label class="form-label">Holati</label>
            <div class="condition-toggle" id="condition-toggle">
                <button class="condition-option ${(!p || p.condition === "NEW") ? "selected" : ""}" data-val="NEW" onclick="selectCondition(this)">✅ Yangi (NEW)</button>
                <button class="condition-option ${(p && p.condition === "USED") ? "selected" : ""}" data-val="USED" onclick="selectCondition(this)">🔄 B/U (USED)</button>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Tavsif (ixtiyoriy)</label>
            <textarea class="form-textarea" id="form-desc" placeholder="Mahsulot haqida qisqacha...">${isEdit ? (p.description || "") : ""}</textarea>
        </div>

        <button class="btn btn-primary btn-full btn-lg" id="form-submit-btn" onclick="submitProductForm(${editId || "null"})">
            ${isEdit ? "💾 Saqlash" : "➕ Qo'shish"}
        </button>
    `;

    showModal("product-form-modal");
}

function selectCondition(el) {
    document.querySelectorAll(".condition-option").forEach((b) => b.classList.remove("selected"));
    el.classList.add("selected");
}

async function submitProductForm(editId) {
    const name = document.getElementById("form-name").value.trim();
    const price = parseInt(document.getElementById("form-price").value) || 0;
    const desc = document.getElementById("form-desc").value.trim();
    const condition = document.querySelector(".condition-option.selected")?.dataset.val || "NEW";

    if (!name) { showToast("❌ Mahsulot nomini kiriting", "error"); return; }
    if (price <= 0) { showToast("❌ Narxni kiriting", "error"); return; }

    const btn = document.getElementById("form-submit-btn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> Saqlanmoqda...';

    try {
        if (editId) {
            await api(`/api/products/${editId}`, {
                method: "PATCH",
                body: JSON.stringify({ name, price, description: desc, condition }),
            });
            showToast("✅ Mahsulot yangilandi", "success");
        } else {
            const qty = parseInt(document.getElementById("form-qty")?.value) || 0;
            await api("/api/products", {
                method: "POST",
                body: JSON.stringify({ name, quantity: qty, price, description: desc, condition }),
            });
            showToast("✅ Mahsulot qo'shildi", "success");
        }

        closeAllModals();
        await loadAllData();
        renderCurrentTab();
    } catch (e) {
        showToast("❌ " + e.message, "error");
        btn.disabled = false;
        btn.textContent = editId ? "💾 Saqlash" : "➕ Qo'shish";
    }
}

// ─── DELETE PRODUCT ───
function confirmDeleteProduct(id, name) {
    closeModal("product-detail-modal");
    document.getElementById("confirm-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="confirm-text">
            🗑 <b>${name}</b> o'chirilsinmi?<br>
            <span style="font-size:12px;color:var(--text-muted)">Bu amalni qaytarib bo'lmaydi.</span>
        </div>
        <div class="confirm-actions">
            <button class="btn btn-ghost" onclick="closeAllModals()">Bekor qilish</button>
            <button class="btn btn-danger" onclick="deleteProduct(${id})">O'chirish</button>
        </div>
    `;
    showModal("confirm-modal");
}

async function deleteProduct(id) {
    try {
        await api(`/api/products/${id}`, { method: "DELETE" });
        showToast("✅ Mahsulot o'chirildi", "success");
        closeAllModals();
        await loadAllData();
        renderCurrentTab();
    } catch (e) {
        showToast("❌ " + e.message, "error");
    }
}

// ─── HISTORY ───
async function renderHistory() {
    $tabContent.innerHTML = `
        <div class="section-title">📜 Kirim/Chiqim tarixi</div>
        <div class="loading-screen" style="height:200px"><div class="loading-spinner"></div><p>Yuklanmoqda...</p></div>
    `;

    await loadTransactions();

    if (transactions.length === 0) {
        $tabContent.innerHTML = `
            <div class="section-title">📜 Kirim/Chiqim tarixi</div>
            <div class="empty-state">
                <div class="empty-icon">📜</div>
                <p>Hozircha hech qanday tranzaksiya yo'q</p>
            </div>
        `;
        return;
    }

    $tabContent.innerHTML = `
        <div class="section-title">📜 Kirim/Chiqim tarixi <span style="color:var(--text-muted);font-size:11px;font-weight:500;">(${transactions.length} ta)</span></div>
        <div class="tx-list">
            ${transactions.map((tx) => `
                <div class="tx-card">
                    <div class="tx-header">
                        <span class="tx-product">${escapeHtml(tx.product_name)}</span>
                        <span class="tx-type ${tx.type}">${tx.type === "kirim" ? "📥 KIRIM" : "📤 CHIQIM"}</span>
                    </div>
                    <div class="tx-details">
                        <span class="tx-amount">${tx.amount} dona × ${formatPrice(tx.price_at_transaction)}</span>
                        <span class="tx-total" style="color:${tx.type === "kirim" ? "var(--accent-green)" : "var(--accent-red)"}">${formatPrice(tx.amount * tx.price_at_transaction)}</span>
                    </div>
                    <div class="tx-date">${formatDate(tx.created_at)}</div>
                </div>
            `).join("")}
        </div>
    `;
}

// ─── LOCATION ───
function renderLocation() {
    $tabContent.innerHTML = `
        <div class="location-card">
            <div class="location-icon">📍</div>
            <div class="location-address">${shopInfo.address || "Manzil ko'rsatilmagan"}</div>
            <div class="location-buttons">
                ${shopInfo.google_maps_url ? `
                    <a href="${shopInfo.google_maps_url}" target="_blank" class="map-btn">
                        <span class="map-icon">🗺</span>
                        Google Maps da ochish
                    </a>
                ` : ""}
                ${shopInfo.yandex_maps_url ? `
                    <a href="${shopInfo.yandex_maps_url}" target="_blank" class="map-btn">
                        <span class="map-icon">🗺</span>
                        Yandex Xaritada ochish
                    </a>
                ` : ""}
            </div>
        </div>
    `;
}

// ─── MODAL MANAGEMENT ───
function showModal(id) {
    document.getElementById("modal-overlay").classList.remove("hidden");
    document.getElementById(id).classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
}

function closeAllModals() {
    document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
    document.getElementById("modal-overlay").classList.add("hidden");
    document.body.style.overflow = "";

    // Remove FAB if not on products tab
    const fab = document.querySelector(".fab");
    if (fab && currentTab !== "products") fab.remove();
}

// ─── ADMIN UI ───
function setupAdminUI() {
    // Admin bo'lmasa admin-only elementlarni yashirish
    if (!isAdmin) {
        document.querySelectorAll(".admin-only").forEach((el) => {
            el.style.display = "none";
        });
    }
}

// ─── INITIALIZATION ───
async function init() {
    try {
        // Telegram user ma'lumotlarini olish
        if (initUser) {
            currentUser = initUser;
        }

        // Ma'lumotlarni yuklash
        await loadAllData();

        // Admin tekshiruvi — agar API ishlayotgan bo'lsa, user autentifikatsiyadan o'tgan
        // Admin-only endpointni test qilish
        try {
            await api("/api/transactions?limit=1");
            isAdmin = true;
        } catch {
            isAdmin = false;
        }

        // UI sozlash
        $loading.classList.add("hidden");
        $main.classList.remove("hidden");
        setupNavigation();
        setupAdminUI();
        renderDashboard();
    } catch (e) {
        console.error("Init error:", e);
        showError(e.message || "Tizimga ulanib bo'lmadi");
    }
}

// Start
init();
