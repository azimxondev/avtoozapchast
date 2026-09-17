/**
 * Avto Sklad — Transactions & Accounting Ledger View
 */

const TransactionsView = {
  state: {
    page: 1,
    limit: 20,
    tx_type: "",
    q: ""
  },

  async render(params = {}) {
    if (params) {
      this.state = { ...this.state, ...params };
    }

    const container = document.getElementById("tab-content");
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <h2 style="font-size:18px;font-weight:700;color:var(--text-main)">📜 Buxgalteriya va Tranzaksiyalar Tarixi</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="TransactionsView.render()">Yangilash</button>
        </div>
      </div>

      <!-- Filters Row -->
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <div class="search-box-wrapper" style="max-width:320px">
          <span class="search-icon">🔍</span>
          <input type="text" id="tx-search-input" class="search-input" placeholder="TX raqami, mahsulot..." value="${Utils.escapeHtml(this.state.q)}">
        </div>

        <select class="sort-select" id="tx-type-filter" onchange="TransactionsView.filterByType(this.value)">
          <option value="" ${!this.state.tx_type ? 'selected' : ''}>Barcha turlar</option>
          <option value="chiqim" ${this.state.tx_type === 'chiqim' ? 'selected' : ''}>Sotuvlar (Chiqim)</option>
          <option value="kirim" ${this.state.tx_type === 'kirim' ? 'selected' : ''}>Xaridlar (Kirim)</option>
          <option value="tuzatish" ${this.state.tx_type === 'tuzatish' ? 'selected' : ''}>Balans Tuzatish</option>
        </select>
      </div>

      <!-- Transactions Table / List Container -->
      <div id="tx-list-container">
        <div class="skeleton" style="height:350px"></div>
      </div>
    `;

    const searchInput = document.getElementById("tx-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", Utils.debounce((e) => {
        this.state.q = e.target.value.trim();
        this.state.page = 1;
        this.loadTransactions();
      }, 350));
    }

    await this.loadTransactions();
  },

  async loadTransactions() {
    const listContainer = document.getElementById("tx-list-container");
    if (!listContainer) return;

    try {
      const data = await API.get("/transactions", this.state);
      const { items, total, page, total_pages } = data;

      if (items.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-title">Tranzaksiyalar topilmadi</div>
            <div class="empty-desc">Tanlangan mezonlar bo'yicha operatsiyalar mavjud emas.</div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <!-- Desktop Table View -->
        <div class="desktop-table-view" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
              <thead>
                <tr style="background:var(--bg-surface-elevated);border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;text-transform:uppercase">
                  <th style="padding:12px 16px">Tranzaksiya / Mahsulot</th>
                  <th style="padding:12px 14px">Turi</th>
                  <th style="padding:12px 14px">Miqdor</th>
                  <th style="padding:12px 14px">Summa</th>
                  <th style="padding:12px 14px">Sof Foyda</th>
                  <th style="padding:12px 14px">Kassa Balansi</th>
                  <th style="padding:12px 16px;text-align:right">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(t => {
                  let badgeColor = "var(--brand-blue)";
                  let badgeBg = "var(--brand-blue-subtle)";
                  if (t.type === "chiqim") {
                    badgeColor = "var(--accent-emerald)";
                    badgeBg = "var(--accent-emerald-subtle)";
                  } else if (t.type === "tuzatish") {
                    badgeColor = "var(--accent-amber)";
                    badgeBg = "var(--accent-amber-subtle)";
                  }

                  return `
                    <tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="TransactionsView.openDetail(${t.id})">
                      <td style="padding:12px 16px">
                        <strong style="color:var(--text-main)">${t.tx_number}</strong>
                        <div style="font-size:11px;color:var(--text-dim)">${Utils.escapeHtml(t.product_name || 'Kassa amali')}</div>
                        <div style="font-size:10px;color:var(--text-dim)">${Utils.formatDateTime(t.created_at)}</div>
                      </td>
                      <td style="padding:12px 14px">
                        <span style="background:${badgeBg};color:${badgeColor};padding:3px 8px;border-radius:var(--radius-sm);font-weight:600;font-size:11px">
                          ${t.type_label}
                        </span>
                      </td>
                      <td style="padding:12px 14px">
                        ${t.quantity} ${t.unit || 'dona'}
                      </td>
                      <td style="padding:12px 14px;font-weight:700;color:${t.type === 'chiqim' ? 'var(--accent-emerald)' : 'var(--text-main)'}">
                        ${t.type === 'chiqim' ? '+' : (t.type === 'kirim' ? '-' : '')}${Utils.formatUZS(t.total_amount)}
                      </td>
                      <td style="padding:12px 14px;color:var(--accent-emerald);font-weight:600">
                        ${t.formatted_profit}
                      </td>
                      <td style="padding:12px 14px;font-size:12px;color:var(--text-muted)">
                        ${Utils.formatUZS(t.new_balance)}
                      </td>
                      <td style="padding:12px 16px;text-align:right">
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); TransactionsView.openDetail(${t.id})">
                          Ko'rish →
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile Card View -->
        <div class="mobile-tx-cards">
          ${items.map(t => {
            let badgeClass = "badge-primary";
            let amountColor = "var(--text-main)";
            let sign = "";
            if (t.type === "chiqim") {
              badgeClass = "badge-success";
              amountColor = "#34D399";
              sign = "+";
            } else if (t.type === "kirim") {
              badgeClass = "badge-danger";
              amountColor = "#F87171";
              sign = "-";
            } else if (t.type === "tuzatish") {
              badgeClass = "badge-warning";
            }

            return `
              <div class="card p-3 mb-2" onclick="TransactionsView.openDetail(${t.id})" style="cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span class="badge ${badgeClass}">${t.type_label}</span>
                    <span style="font-size:11px;font-family:monospace;color:var(--text-dim)">${t.tx_number}</span>
                  </div>
                  <div style="font-size:14px;font-weight:800;color:${amountColor}">
                    ${sign}${Utils.formatUZS(t.total_amount)}
                  </div>
                </div>
                <div style="font-size:13px;font-weight:700;color:var(--text-main);margin-bottom:4px;line-height:1.3">
                  ${Utils.escapeHtml(t.product_name || 'Kassa amali')}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:8px;margin-top:6px">
                  <span>${Utils.formatDateTime(t.created_at)} · ${t.quantity} ${t.unit || 'dona'}</span>
                  <span>Kassa: <strong style="color:var(--text-main)">${Utils.formatUZS(t.new_balance)}</strong></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Pagination -->
        ${total_pages > 1 ? `
        <div class="pagination-container">
          <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="TransactionsView.changePage(${page - 1})">
            ← Oldingi
          </button>
          <span class="page-indicator">${page} / ${total_pages}</span>
          <button class="btn btn-secondary btn-sm" ${page >= total_pages ? 'disabled' : ''} onclick="TransactionsView.changePage(${page + 1})">
            Keyingi →
          </button>
        </div>
        ` : ''}
      `;
    } catch (err) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Tranzaksiyalarni yuklashda xatolik</div>
          <div class="empty-desc">${Utils.escapeHtml(err.message)}</div>
        </div>
      `;
    }
  },

  filterByType(typeVal) {
    this.state.tx_type = typeVal;
    this.state.page = 1;
    this.loadTransactions();
  },

  changePage(newPage) {
    this.state.page = newPage;
    this.loadTransactions();
  },

  async openDetail(txId) {
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = `<div class="modal-sheet"><div style="padding:30px;text-align:center">Yuklanmoqda...</div></div>`;
    document.getElementById("modal-overlay").classList.add("active");

    try {
      const data = await API.get(`/transactions/${txId}`);
      const { transaction: t, explanation } = data;

      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">
              <span>🧾</span> Tranzaksiya ${t.tx_number}
            </div>
            <button class="modal-close-btn" onclick="TransactionsView.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <!-- Transparent Formula Card -->
            <div class="formula-box">
              <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">
                Buxgalteriya Kassa O'zgarishi:
              </div>
              <div class="formula-code">
                ${explanation.formula_balance}
              </div>
              ${t.type === 'chiqim' ? `
              <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;margin-top:8px;margin-bottom:4px">
                Sof Foyda Formulasi:
              </div>
              <div class="formula-code" style="color:var(--accent-emerald)">
                ${explanation.formula_profit}
              </div>
              ` : ''}
            </div>

            <!-- Details Grid -->
            <div style="background:var(--bg-main);border-radius:var(--radius-md);padding:14px;font-size:13px;line-height:1.8">
              <div><strong>Mahsulot:</strong> ${Utils.escapeHtml(t.product_name || 'Kassa operatsiyasi')}</div>
              <div><strong>Operatsiya turi:</strong> ${t.type.toUpperCase()}</div>
              <div><strong>Miqdor:</strong> ${t.quantity} ${t.unit || 'dona'}</div>
              <div><strong>Birlik narxi:</strong> ${Utils.formatUZS(t.unit_price)}</div>
              ${t.type === 'chiqim' ? `<div><strong>Birlik tannarxi:</strong> ${Utils.formatUZS(t.cost_price)}</div>` : ''}
              <div><strong>Jami summa:</strong> <strong style="color:var(--text-main)">${Utils.formatUZS(t.total_amount)}</strong></div>
              ${t.type === 'chiqim' ? `<div><strong>Sof Foyda:</strong> <strong style="color:var(--accent-emerald)">+${Utils.formatUZS(t.profit)}</strong></div>` : ''}
              <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
                <div><strong>Ombor qoldig'i:</strong> ${t.prev_stock} dona → <strong style="color:var(--text-main)">${t.new_stock} dona</strong></div>
                <div><strong>Kassa balansi:</strong> ${Utils.formatUZS(t.prev_balance)} → <strong style="color:var(--text-main)">${Utils.formatUZS(t.new_balance)}</strong></div>
              </div>
              <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
                <div><strong>Mas'ul xodim:</strong> ${Utils.escapeHtml(t.admin_name || 'Admin')}</div>
                <div><strong>Mijoz / Diler:</strong> ${Utils.escapeHtml(t.customer_or_supplier || '—')}</div>
                <div><strong>Vaqt:</strong> ${Utils.formatDateTime(t.created_at)}</div>
                ${t.note ? `<div><strong>Izoh:</strong> ${Utils.escapeHtml(t.note)}</div>` : ''}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="TransactionsView.closeModal()">Yopish</button>
          </div>
        </div>
      `;
    } catch (err) {
      modalRoot.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-body" style="text-align:center;padding:30px">
            <div>Xatolik: ${Utils.escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="TransactionsView.closeModal()">Yopish</button>
          </div>
        </div>
      `;
    }
  },

  closeModal() {
    document.getElementById("modal-overlay").classList.remove("active");
  }
};
