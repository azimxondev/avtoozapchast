/**
 * Avto Sklad — Stock Modal (Stock In / Stock Out & Sale)
 * Strictly Atomic, Live Profit & Budget Preview, Instant Validation.
 */

const StockModal = {
  currentType: "out", // 'in' or 'out'
  selectedProduct: null,
  productsList: [],

  async open(type = "out", preselectedProductId = null) {
    this.currentType = type;
    const isSale = type === "out";

    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `<div class="modal-sheet"><div style="padding:30px;text-align:center">Yuklanmoqda...</div></div>`;
    document.getElementById("modal-overlay").classList.add("active");
    document.body.classList.add("modal-open");

    try {
      // Load active products for selector
      const res = await API.get("/products", { limit: 100, sort_by: "name_asc" });
      this.productsList = res.items || [];

      let initialProd = null;
      if (preselectedProductId) {
        initialProd = this.productsList.find(p => p.id === preselectedProductId);
      }
      if (!initialProd && this.productsList.length > 0) {
        initialProd = this.productsList[0];
      }
      this.selectedProduct = initialProd;

      const title = isSale ? "🛒 Mahsulot Sotish (Chiqim)" : "📥 Omborga Kirim (Xarid)";
      const priceLabel = isSale ? "Sotish Narxi (UZS) *" : "Xarid Narxi / Tannarx (UZS) *";
      const initialPrice = initialProd ? (isSale ? initialProd.selling_price : initialProd.purchase_price) : 0;

      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            <button type="button" class="modal-close-btn" onclick="StockModal.close()" aria-label="Yopish">✕</button>
          </div>
          <form id="stock-operation-form" onsubmit="StockModal.submit(event)">
            <div class="modal-body">
              <!-- Product Selector -->
              <div class="form-group">
                <label class="form-label">Mahsulotni tanlang *</label>
                <select id="stock-prod-select" class="form-control" required onchange="StockModal.onProductChange(this.value)">
                  ${this.productsList.map(p => `
                    <option value="${p.id}" ${initialProd && p.id === initialProd.id ? 'selected' : ''}>
                      ${Utils.escapeHtml(p.name)} — Mavjud: ${p.quantity} ${p.unit} (${Utils.formatUZS(p.selling_price)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Current Stock Info -->
              <div id="stock-info-box" style="background:var(--bg-main);padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:16px;font-size:12px;display:flex;justify-content:space-between">
                <span>Ombordagi qoldiq: <strong id="stock-current-qty">${initialProd ? initialProd.quantity : 0} ${initialProd ? initialProd.unit : 'dona'}</strong></span>
                <span>Joylashuv: <strong id="stock-shelf">${initialProd && initialProd.shelf_location ? initialProd.shelf_location : '—'}</strong></span>
              </div>

              <div class="form-row">
                <!-- Quantity Input -->
                <div class="form-group">
                  <label class="form-label">Miqdor *</label>
                  <input type="number" id="stock-qty-input" class="form-control" required min="1" value="1" oninput="StockModal.recalculate()">
                  <!-- Quick Steppers -->
                  <div class="quick-stepper">
                    <button type="button" class="stepper-btn" onclick="StockModal.setQty(1)">1</button>
                    <button type="button" class="stepper-btn" onclick="StockModal.setQty(2)">2</button>
                    <button type="button" class="stepper-btn" onclick="StockModal.setQty(4)">4</button>
                    <button type="button" class="stepper-btn" onclick="StockModal.setQty(10)">10</button>
                    ${isSale && initialProd ? `<button type="button" class="stepper-btn" onclick="StockModal.setQty(${initialProd.quantity})">Barchasi (${initialProd.quantity})</button>` : ''}
                  </div>
                </div>

                <!-- Unit Price Input -->
                <div class="form-group">
                  <label class="form-label">${priceLabel}</label>
                  <input type="number" id="stock-price-input" class="form-control" required min="0" value="${initialPrice}" oninput="StockModal.recalculate()">
                </div>
              </div>

              <!-- Customer / Supplier Info -->
              <div class="form-group">
                <label class="form-label">${isSale ? 'Xaridor / Usta (ixtiyoriy)' : 'Yetkazib beruvchi / Diler (ixtiyoriy)'}</label>
                <input type="text" id="stock-party-input" class="form-control" placeholder="${isSale ? 'Mijoz ismi, mashina raqami yoki telefoni' : 'Diler / Firma nomi'}">
              </div>

              <!-- Note -->
              <div class="form-group">
                <label class="form-label">Izoh (ixtiyoriy)</label>
                <input type="text" id="stock-note-input" class="form-control" placeholder="To'lov turi, kafolat yoki boshqa eslatmalar...">
              </div>

              <!-- Live Calculation Preview Banner -->
              <div class="calc-preview-banner">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;font-weight:700">
                  Hisob-kitob oldindan ko'rish:
                </div>
                ${isSale ? `
                <div class="calc-preview-row">
                  <span class="calc-preview-label">Umumiy Sotuv Tushumi:</span>
                  <span class="calc-preview-val" id="calc-revenue" style="color:var(--brand-blue)">0 UZS</span>
                </div>
                <div class="calc-preview-row">
                  <span class="calc-preview-label">Tovar Tannarxi:</span>
                  <span class="calc-preview-val" id="calc-cost">0 UZS</span>
                </div>
                <div class="calc-preview-row" style="border-top:1px dashed var(--border);margin-top:6px;padding-top:6px">
                  <span class="calc-preview-label">Kassaga tushadigan Sof Foyda:</span>
                  <span class="calc-preview-val calc-highlight-profit" id="calc-profit">+0 UZS</span>
                </div>
                ` : `
                <div class="calc-preview-row">
                  <span class="calc-preview-label">Jami Xarid Xarajati:</span>
                  <span class="calc-preview-val" id="calc-expense" style="color:var(--accent-amber)">0 UZS</span>
                </div>
                <div class="calc-preview-row">
                  <span class="calc-preview-label">Kassa balansidan yechiladi:</span>
                  <span class="calc-preview-val" id="calc-budget-deduct" style="color:var(--accent-rose)">-0 UZS</span>
                </div>
                `}
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="StockModal.close()">Bekor qilish</button>
              <button type="submit" class="btn ${isSale ? 'btn-success' : 'btn-primary'}" id="stock-submit-btn">
                ${isSale ? 'Sotuvni tasdiqlash' : 'Kirimni qabul qilish'}
              </button>
            </div>
          </form>
        </div>
      `;

      this.recalculate();
    } catch (err) {
      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-body" style="text-align:center;padding:30px">
            <div>Yuklashda xatolik: ${Utils.escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="StockModal.close()">Yopish</button>
          </div>
        </div>
      `;
    }
  },

  onProductChange(productId) {
    const prod = this.productsList.find(p => String(p.id) === String(productId));
    if (!prod) return;
    this.selectedProduct = prod;

    const qtyBox = document.getElementById("stock-current-qty");
    const shelfBox = document.getElementById("stock-shelf");
    const priceInput = document.getElementById("stock-price-input");

    if (qtyBox) qtyBox.textContent = `${prod.quantity} ${prod.unit}`;
    if (shelfBox) shelfBox.textContent = prod.shelf_location || '—';
    if (priceInput) {
      priceInput.value = this.currentType === "out" ? prod.selling_price : prod.purchase_price;
    }

    this.recalculate();
  },

  setQty(qty) {
    const qtyInput = document.getElementById("stock-qty-input");
    if (qtyInput) {
      qtyInput.value = Math.max(1, qty);
      this.recalculate();
    }
  },

  recalculate() {
    const qtyInput = document.getElementById("stock-qty-input");
    const priceInput = document.getElementById("stock-price-input");
    if (!qtyInput || !priceInput || !this.selectedProduct) return;

    const qty = parseInt(qtyInput.value) || 0;
    const price = parseInt(priceInput.value) || 0;
    const unitCost = this.selectedProduct.purchase_price || 0;

    if (this.currentType === "out") {
      const revenue = qty * price;
      const totalCost = qty * unitCost;
      const profit = revenue - totalCost;

      const revEl = document.getElementById("calc-revenue");
      const costEl = document.getElementById("calc-cost");
      const profEl = document.getElementById("calc-profit");

      if (revEl) revEl.textContent = Utils.formatUZS(revenue);
      if (costEl) costEl.textContent = Utils.formatUZS(totalCost);
      if (profEl) {
        profEl.textContent = `${profit >= 0 ? '+' : ''}${Utils.formatUZS(profit)}`;
        profEl.style.color = profit >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)";
      }

      // Check stock warning
      const submitBtn = document.getElementById("stock-submit-btn");
      if (submitBtn) {
        if (qty > this.selectedProduct.quantity) {
          submitBtn.disabled = true;
          submitBtn.textContent = `Qoldiq yetarli emas (${this.selectedProduct.quantity} ta bor)`;
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = "Sotuvni tasdiqlash";
        }
      }
    } else {
      const expense = qty * price;
      const expEl = document.getElementById("calc-expense");
      const dedEl = document.getElementById("calc-budget-deduct");

      if (expEl) expEl.textContent = Utils.formatUZS(expense);
      if (dedEl) dedEl.textContent = `-${Utils.formatUZS(expense)}`;
    }
  },

  async submit(e) {
    e.preventDefault();
    if (!this.selectedProduct) return;

    const submitBtn = document.getElementById("stock-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Bajarilmoqda...";

    const qty = parseInt(document.getElementById("stock-qty-input").value);
    const price = parseInt(document.getElementById("stock-price-input").value);
    const party = document.getElementById("stock-party-input").value.trim();
    const note = document.getElementById("stock-note-input").value.trim();

    try {
      if (this.currentType === "out") {
        // SALE
        const res = await API.post("/stock/out", {
          product_id: this.selectedProduct.id,
          quantity: qty,
          selling_price: price,
          customer_info: party,
          note: note
        });

        Utils.showToast(res.message || "Sotuv muvaffaqiyatli amalga oshirildi!", "success");
      } else {
        // STOCK IN
        const res = await API.post("/stock/in", {
          product_id: this.selectedProduct.id,
          quantity: qty,
          purchase_price: price,
          supplier: party,
          note: note
        });

        Utils.showToast(res.message || "Kirim muvaffaqiyatli saqlandi!", "success");
      }

      StockModal.close();

      // Refresh current view
      if (State.currentTab === "dashboard") {
        DashboardView.render();
      } else if (State.currentTab === "products") {
        ProductsView.loadProducts();
      } else if (State.currentTab === "transactions") {
        TransactionsView.render();
      } else if (State.currentTab === "analytics") {
        AnalyticsView.render();
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = this.currentType === "out" ? "Sotuvni tasdiqlash" : "Kirimni qabul qilish";
    }
  },

  close() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
};
