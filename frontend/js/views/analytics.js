/**
 * Avto Sklad — Analytics & Financial Reports View
 * Calendar-aware Daily, Weekly (Mon-Sun), Monthly, Yearly analytics
 * with Historical Navigation and Itemized Sales/Purchases Drill-down.
 */

const AnalyticsView = {
  currentPeriod: "daily",
  targetDate: new Date().toISOString().slice(0, 10),
  lastData: null,

  async render() {
    const container = document.getElementById("tab-content");
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <h2 style="font-size:18px;font-weight:700;color:var(--text-main)">📊 Moliyaviy Tahlil va Buxgalteriya Hisoboti</h2>

        <!-- Period Switcher Pills -->
        <div class="period-pills">
          <button class="period-pill ${this.currentPeriod === 'daily' ? 'active' : ''}" onclick="AnalyticsView.setPeriod('daily')">Kunlik</button>
          <button class="period-pill ${this.currentPeriod === 'weekly' ? 'active' : ''}" onclick="AnalyticsView.setPeriod('weekly')">Haftalik</button>
          <button class="period-pill ${this.currentPeriod === 'monthly' ? 'active' : ''}" onclick="AnalyticsView.setPeriod('monthly')">Oylik</button>
          <button class="period-pill ${this.currentPeriod === 'yearly' ? 'active' : ''}" onclick="AnalyticsView.setPeriod('yearly')">Yillik</button>
        </div>
      </div>

      <!-- Navigation & Date Selector Row -->
      <div id="analytics-nav-bar" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <button id="btn-prev-period" class="btn btn-secondary btn-sm" onclick="AnalyticsView.navigatePrev()">
          ◀️ Oldingi
        </button>
        <button class="btn btn-ghost btn-sm" onclick="AnalyticsView.navigateCurrent()">
          📅 Joriy davr
        </button>
        <button id="btn-next-period" class="btn btn-secondary btn-sm" onclick="AnalyticsView.navigateNext()">
          Keyingi ▶️
        </button>
        <div style="display:flex;gap:6px;align-items:center;margin-left:auto;font-size:12px;color:var(--text-muted)">
          <span>Sana:</span>
          <input type="date" id="analytics-date-picker" class="sort-select" style="padding:4px 8px;font-size:12px" value="${this.targetDate}" onchange="AnalyticsView.setDate(this.value)">
        </div>
      </div>

      <!-- Content Container -->
      <div id="analytics-content-container">
        <div class="skeleton" style="height:120px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:220px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:180px"></div>
      </div>
    `;

    await this.loadReport();
  },

  setPeriod(period) {
    this.currentPeriod = period;
    this.render();
  },

  setDate(dateVal) {
    this.targetDate = dateVal;
    this.loadReport();
  },

  navigatePrev() {
    if (this.lastData && this.lastData.prev_target_date) {
      this.targetDate = this.lastData.prev_target_date;
      const dp = document.getElementById("analytics-date-picker");
      if (dp) dp.value = this.targetDate;
      this.loadReport();
    }
  },

  navigateCurrent() {
    this.targetDate = new Date().toISOString().slice(0, 10);
    const dp = document.getElementById("analytics-date-picker");
    if (dp) dp.value = this.targetDate;
    this.loadReport();
  },

  navigateNext() {
    if (this.lastData && this.lastData.next_target_date && this.lastData.can_navigate_next) {
      this.targetDate = this.lastData.next_target_date;
      const dp = document.getElementById("analytics-date-picker");
      if (dp) dp.value = this.targetDate;
      this.loadReport();
    }
  },

  async loadReport() {
    const content = document.getElementById("analytics-content-container");
    if (!content) return;

    try {
      const data = await API.get("/analytics/period", {
        period: this.currentPeriod,
        target_date: this.targetDate
      });

      this.lastData = data;

      // Update next button disabled state
      const nextBtn = document.getElementById("btn-next-period");
      if (nextBtn) {
        if (!data.can_navigate_next) {
          nextBtn.disabled = true;
          nextBtn.style.opacity = "0.4";
          nextBtn.style.cursor = "not-allowed";
          nextBtn.title = "Kelajakdagi davr uchun tahlil mavjud emas";
        } else {
          nextBtn.disabled = false;
          nextBtn.style.opacity = "1";
          nextBtn.style.cursor = "pointer";
          nextBtn.title = "";
        }
      }

      content.innerHTML = `
        <!-- Formula & Balance Flow Card -->
        <div class="formula-box" style="margin-bottom:20px">
          <div style="font-size:12px;color:#94A3B8;font-weight:600;margin-bottom:6px;text-transform:uppercase">
            ${data.title} — Kassa Oqimi Formulasi:
          </div>
          <div class="formula-code">
            ${data.formula.expression}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
            ${data.formula.explanation}
          </div>
        </div>

        <!-- Period Summary Metrics (Clickable for drill-down) -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Ochilish Kassa</span>
              <span class="metric-icon">🌅</span>
            </div>
            <div class="metric-value">${Utils.formatUZS(data.opening_balance)}</div>
            <div class="metric-sub">Davr boshidagi holat</div>
          </div>

          <div class="metric-card" style="cursor:pointer;border-color:rgba(37,99,235,0.4)" onclick="AnalyticsView.showSalesDrilldown()" title="Sotilgan tovarlar ro'yxatini ko'rish">
            <div class="metric-header">
              <span class="metric-title">Sotuv Tushumi</span>
              <span class="metric-icon">🛒</span>
            </div>
            <div class="metric-value metric-positive">+${Utils.formatUZS(data.revenue)}</div>
            <div class="metric-sub" style="color:var(--brand-blue)">${data.items_sold} dona tovar · <strong>Ko'rish 🔍</strong></div>
          </div>

          <div class="metric-card" style="cursor:pointer;border-color:rgba(239,68,68,0.4)" onclick="AnalyticsView.showPurchasesDrilldown()" title="Kelgan tovarlar partiyasini ko'rish">
            <div class="metric-header">
              <span class="metric-title">Xarid Xarajatlari</span>
              <span class="metric-icon">📥</span>
            </div>
            <div class="metric-value metric-negative">-${Utils.formatUZS(data.expenses)}</div>
            <div class="metric-sub" style="color:#f87171">${data.items_received} dona qabul · <strong>Ko'rish 🔍</strong></div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Sof Foyda</span>
              <span class="metric-icon">💎</span>
            </div>
            <div class="metric-value ${data.profit >= 0 ? 'metric-positive' : 'metric-negative'}">
              ${data.profit >= 0 ? '+' : ''}${Utils.formatUZS(data.profit)}
            </div>
            <div class="metric-sub">Sotuv - Tannarx</div>
          </div>
        </div>

        <!-- Visual Timeline Chart -->
        <div class="chart-section">
          <div class="chart-header">
            <div class="chart-title">📈 Daromad va Xarajat Grafigi</div>
            <div style="font-size:11px;color:var(--text-dim);display:flex;gap:12px">
              <span style="color:#2563EB">■ Tushum (Sotuv)</span>
              <span style="color:#F59E0B">■ Xaridlar</span>
            </div>
          </div>
          <div class="canvas-chart-wrapper">
            <canvas id="period-chart-canvas" class="chart-canvas"></canvas>
          </div>
        </div>

        <!-- Top Selling Products in Period -->
        <div class="chart-section" style="margin-top:20px">
          <div class="chart-title" style="margin-bottom:14px">🏆 Eng ko'p sotilgan tovarlar</div>
          ${data.top_products.length > 0 ? `
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
              <thead>
                <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;text-transform:uppercase">
                  <th style="padding:8px 12px">Mahsulot</th>
                  <th style="padding:8px 12px">Sotilgan miqdor</th>
                  <th style="padding:8px 12px">Jami Tushum</th>
                  <th style="padding:8px 12px">Keltirgan Sof Foyda</th>
                </tr>
              </thead>
              <tbody>
                ${data.top_products.map(tp => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 12px;font-weight:600;color:var(--text-main)">${Utils.escapeHtml(tp.product_name)}</td>
                    <td style="padding:10px 12px">${tp.total_sold} dona</td>
                    <td style="padding:10px 12px">${Utils.formatUZS(tp.total_revenue)}</td>
                    <td style="padding:10px 12px;font-weight:700;color:var(--accent-emerald)">+${Utils.formatUZS(tp.total_profit)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : `
          <div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px">
            Ushbu davrda sotuvlar qayd etilmagan.
          </div>
          `}
        </div>

        <!-- Category Breakdown -->
        ${data.category_sales.length > 0 ? `
        <div class="chart-section" style="margin-top:20px">
          <div class="chart-title" style="margin-bottom:14px">🗂 Toifalar bo'yicha sotuv ulushi</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px">
            ${data.category_sales.map(cs => `
              <div style="background:var(--bg-surface-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <span style="font-size:18px">${cs.category_icon || '📦'}</span>
                  <strong style="font-size:13px;color:var(--text-main)">${cs.category_name}</strong>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">Sotildi: <strong>${cs.items_sold} dona</strong></div>
                <div style="font-size:13px;font-weight:700;color:var(--brand-blue);margin-top:4px">Tushum: ${Utils.formatUZS(cs.total_revenue)}</div>
                <div style="font-size:12px;color:var(--accent-emerald);font-weight:600">Sof foyda: +${Utils.formatUZS(cs.total_profit)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      `;

      // Render chart if points exist
      setTimeout(() => {
        if (data.chart_points && data.chart_points.length > 0) {
          Charts.renderTimelineBarChart("period-chart-canvas", data.chart_points);
        }
      }, 50);
    } catch (err) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Tahlilni yuklashda xatolik</div>
          <div class="empty-desc">${Utils.escapeHtml(err.message)}</div>
        </div>
      `;
    }
  },

  // --------------------------------------------------------------------------
  // Itemized Drill-down Modals for Transparent Accounting (Requirements 36 & 37)
  // --------------------------------------------------------------------------
  showSalesDrilldown() {
    if (!this.lastData || !this.lastData.sales_items) return;
    const items = this.lastData.sales_items;

    const overlay = document.getElementById("modal-overlay");
    const root = document.getElementById("modal-root");
    if (!overlay || !root) return;

    let rowsHtml = "";
    if (items.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Ushbu davrda sotuvlar mavjud emas</td></tr>`;
    } else {
      rowsHtml = items.map(it => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px">
            <div style="font-weight:600;color:var(--text-main)">${Utils.escapeHtml(it.product_name)}</div>
            <div style="font-size:11px;color:var(--text-dim)">Tranzaksiya: ${Utils.escapeHtml(it.tx_number || ('#' + it.id))}</div>
          </td>
          <td style="padding:10px 12px;text-align:center">
            ${it.quantity} dona × ${Utils.formatUZS(it.unit_price)}
          </td>
          <td style="padding:10px 12px;font-weight:700;color:var(--brand-blue);text-align:right">
            ${Utils.formatUZS(it.total_amount)}
          </td>
          <td style="padding:10px 12px;font-weight:600;color:var(--accent-emerald);text-align:right">
            +${Utils.formatUZS(it.profit || 0)}
          </td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text-dim);text-align:right">
            ${Utils.formatDateTime(it.created_at)}
          </td>
        </tr>
      `).join('');
    }

    root.innerHTML = `
      <div class="modal-card" style="max-width:760px;width:95%;max-height:85vh;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-main)">🛒 Sotuv Tushumlari Tafsiloti (Drill-Down)</h3>
            <span style="font-size:12px;color:var(--text-muted)">${this.lastData.title} — Jami: ${Utils.formatUZS(this.lastData.revenue)}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="AnalyticsView.closeDrilldown()" style="font-size:18px">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px 16px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;text-transform:uppercase">
                <th style="padding:8px 12px;text-align:left">Mahsulot</th>
                <th style="padding:8px 12px;text-align:center">Miqdor × Narx</th>
                <th style="padding:8px 12px;text-align:right">Jami Tushum</th>
                <th style="padding:8px 12px;text-align:right">Sof Foyda</th>
                <th style="padding:8px 12px;text-align:right">Vaqt</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
  },

  showPurchasesDrilldown() {
    if (!this.lastData || !this.lastData.purchases_items) return;
    const items = this.lastData.purchases_items;

    const overlay = document.getElementById("modal-overlay");
    const root = document.getElementById("modal-root");
    if (!overlay || !root) return;

    let rowsHtml = "";
    if (items.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Ushbu davrda xaridlar mavjud emas</td></tr>`;
    } else {
      rowsHtml = items.map(it => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px">
            <div style="font-weight:600;color:var(--text-main)">${Utils.escapeHtml(it.product_name)}</div>
            <div style="font-size:11px;color:var(--text-dim)">Tranzaksiya: ${Utils.escapeHtml(it.tx_number || ('#' + it.id))}</div>
          </td>
          <td style="padding:10px 12px;text-align:center">
            ${it.quantity} dona × ${Utils.formatUZS(it.unit_price || it.cost_price)}
          </td>
          <td style="padding:10px 12px;font-weight:700;color:#ef4444;text-align:right">
            -${Utils.formatUZS(it.total_amount)}
          </td>
          <td style="padding:10px 12px;font-size:12px;color:var(--text-muted);text-align:left">
            ${Utils.escapeHtml(it.customer_or_supplier || it.admin_name || 'Ta’minotchi')}
          </td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text-dim);text-align:right">
            ${Utils.formatDateTime(it.created_at)}
          </td>
        </tr>
      `).join('');
    }

    root.innerHTML = `
      <div class="modal-card" style="max-width:760px;width:95%;max-height:85vh;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-main)">📥 Xarid va Partiyalar Tafsiloti (Drill-Down)</h3>
            <span style="font-size:12px;color:var(--text-muted)">${this.lastData.title} — Jami chiqim: -${Utils.formatUZS(this.lastData.expenses)}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="AnalyticsView.closeDrilldown()" style="font-size:18px">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px 16px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;text-transform:uppercase">
                <th style="padding:8px 12px;text-align:left">Tovar / Partiya</th>
                <th style="padding:8px 12px;text-align:center">Miqdor × Xarid narxi</th>
                <th style="padding:8px 12px;text-align:right">Jami Chiqim</th>
                <th style="padding:8px 12px;text-align:left">Ta'minotchi / Mas'ul</th>
                <th style="padding:8px 12px;text-align:right">Vaqt</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
  },

  closeDrilldown() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.style.display = "none";
    }
  }
};
