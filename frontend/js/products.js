/* =====================================================
   AVTO SKLAD — Products & Stock Operations JS
   ===================================================== */

let products = [];
let stockModalProductId = null;
let stockModalType = null;
let stockModalAmount = 1;

function renderProducts() {
    const $tabContent = document.getElementById("tab-content");
    const $main = document.getElementById("main-content");
    if (!$tabContent) return;

    $tabContent.innerHTML = `
        <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" id="search-input" placeholder="Mahsulot nomini qidirish..." autocomplete="off">
        </div>
        <div class="section-title">
            <span>📦 Sklad mahsulotlari</span>
            <span style="color:var(--text-muted);font-size:12px;font-weight:500;">(${products.length} ta)</span>
        </div>
        <div class="product-list" id="product-list"></div>
    `;

    if (isAdmin) {
        const existingFab = document.querySelector('.fab');
        if (!existingFab) {
            const fab = document.createElement("button");
            fab.className = "fab admin-only";
            fab.innerHTML = "+";
            fab.onclick = () => openProductForm();
            if ($main) $main.appendChild(fab);
        }
    }

    renderProductList(products);

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.toLowerCase().trim();
            const filtered = products.filter((p) =>
                p.name.toLowerCase().includes(q)
            );
            renderProductList(filtered);
        });
    }
}

function renderProductList(list) {
    const $list = document.getElementById("product-list");
    if (!$list) return;

    if (list.length === 0) {
        $list.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:40px 0;color:var(--text-muted)">
                <div style="font-size:40px;margin-bottom:8px">📦</div>
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

function openProductDetail(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;

    const stockValue = p.quantity * p.price;

    document.getElementById("product-detail-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-header">
            <div>
                <div class="product-badge ${p.condition === "NEW" ? "badge-new" : "badge-used"}" style="margin-bottom:6px">${p.condition === "NEW" ? "✅ Yangi" : "🔄 B/U"}</div>
                <div class="modal-title" style="font-size:20px">${escapeHtml(p.name)}</div>
                <div style="font-size:18px;font-weight:700;color:var(--accent-emerald);margin-top:4px">${formatPrice(p.price)}</div>
            </div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:var(--bg-card);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border)">
            <div>
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Qoldiq</div>
                <div style="font-size:16px;font-weight:700;color:${p.quantity <= 3 ? "var(--accent-rose)" : "var(--text-primary)"}">${p.quantity} dona</div>
            </div>
            <div>
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Sklad Qiymati</div>
                <div style="font-size:16px;font-weight:700;color:var(--accent-emerald)">${formatPrice(stockValue)}</div>
            </div>
        </div>

        ${p.description ? `
            <div style="margin-bottom:16px;background:var(--bg-card);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border)">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase">Tavsif</div>
                <p style="font-size:13px;color:var(--text-secondary);line-height:1.4">${escapeHtml(p.description)}</p>
            </div>
        ` : ""}

        ${isAdmin ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <button class="btn btn-danger btn-lg" onclick="openStockModal(${p.id}, 'out')">➖ Chiqim</button>
                <button class="btn btn-success btn-lg" onclick="openStockModal(${p.id}, 'in')">➕ Kirim</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <button class="btn btn-ghost" onclick="openProductForm(${p.id})">✏️ Tahrirlash</button>
                <button class="btn btn-ghost" onclick="confirmDeleteProduct(${p.id}, '${escapeHtml(p.name)}')">🗑 O'chirish</button>
            </div>
        ` : ""}
    `;

    showModal("product-detail-modal");
}

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
            <div class="modal-title">${isOut ? "📤 Chiqim (Sotuv)" : "📥 Kirim (Ombor)"}</div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div style="text-align:center;margin-bottom:12px">
            <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${escapeHtml(p.name)}</div>
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
                <span class="value" style="color:${isOut ? "var(--accent-rose)" : "var(--accent-emerald)"}">${formatPrice(totalPrice)}</span>
            </div>
            <div class="stock-summary-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
                <span class="label">Yangi qoldiq</span>
                <span class="value" style="color:${!canProceed ? "var(--accent-rose)" : "var(--text-primary)"}">${canProceed ? newQty + " dona" : "❌ Yetarli emas!"}</span>
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
        btn.textContent = "Kutilmoqda...";
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
            <div style="display:flex;gap:10px">
                <button type="button" class="btn ${(!p || p.condition === "NEW") ? "btn-primary" : "btn-ghost"}" id="cond-new" onclick="selectCondition('NEW')">✅ Yangi</button>
                <button type="button" class="btn ${(p && p.condition === "USED") ? "btn-primary" : "btn-ghost"}" id="cond-used" onclick="selectCondition('USED')">🔄 B/U</button>
            </div>
            <input type="hidden" id="form-condition" value="${p ? p.condition : "NEW"}">
        </div>

        <div class="form-group">
            <label class="form-label">Tavsif (ixtiyoriy)</label>
            <textarea class="form-textarea" id="form-desc" placeholder="Mahsulot haqida...">${isEdit ? (p.description || "") : ""}</textarea>
        </div>

        <button class="btn btn-primary btn-full btn-lg" id="form-submit-btn" onclick="submitProductForm(${editId || "null"})">
            ${isEdit ? "💾 Saqlash" : "➕ Qo'shish"}
        </button>
    `;

    showModal("product-form-modal");
}

function selectCondition(val) {
    document.getElementById("form-condition").value = val;
    document.getElementById("cond-new").className = val === "NEW" ? "btn btn-primary" : "btn btn-ghost";
    document.getElementById("cond-used").className = val === "USED" ? "btn btn-primary" : "btn btn-ghost";
}

async function submitProductForm(editId) {
    const name = document.getElementById("form-name").value.trim();
    const price = parseInt(document.getElementById("form-price").value) || 0;
    const desc = document.getElementById("form-desc").value.trim();
    const condition = document.getElementById("form-condition").value || "NEW";

    if (!name) { showToast("❌ Mahsulot nomini kiriting", "error"); return; }
    if (price <= 0) { showToast("❌ Narxni kiriting", "error"); return; }

    const btn = document.getElementById("form-submit-btn");
    btn.disabled = true;
    btn.textContent = "Saqlanmoqda...";

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

function confirmDeleteProduct(id, name) {
    closeModal("product-detail-modal");
    document.getElementById("confirm-content").innerHTML = `
        <div class="modal-handle"></div>
        <div style="text-align:center;margin-bottom:20px">
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">🗑 ${name} o'chirilsinmi?</div>
            <div style="font-size:12px;color:var(--text-muted)">Bu amalni qaytarib bo'lmaydi.</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
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
