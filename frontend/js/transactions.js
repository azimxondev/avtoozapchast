/* =====================================================
   AVTO SKLAD — Transaction History JS
   ===================================================== */

let transactions = [];

async function loadTransactions() {
    try {
        transactions = await api("/api/transactions");
    } catch {
        transactions = [];
    }
}

async function renderHistory() {
    const $tabContent = document.getElementById("tab-content");
    if (!$tabContent) return;

    $tabContent.innerHTML = `
        <div class="section-title">📜 Kirim/Chiqim Tarixi</div>
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">Yuklanmoqda...</div>
    `;

    await loadTransactions();

    if (transactions.length === 0) {
        $tabContent.innerHTML = `
            <div class="section-title">📜 Kirim/Chiqim Tarixi</div>
            <div class="empty-state" style="text-align:center;padding:40px 0;color:var(--text-muted)">
                <div style="font-size:40px;margin-bottom:8px">📜</div>
                <p>Hozircha hech qanday kirim/chiqim tranzaksiyasi mavjud emas</p>
            </div>
        `;
        return;
    }

    $tabContent.innerHTML = `
        <div class="section-title">
            <span>📜 Kirim/Chiqim Tarixi</span>
            <span style="color:var(--text-muted);font-size:12px;font-weight:500;">(${transactions.length} ta)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
            ${transactions.map((tx) => `
                <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <span style="font-weight:600;font-size:14px;color:var(--text-primary)">${escapeHtml(tx.product_name)}</span>
                        <span class="product-badge ${tx.type === "kirim" ? "badge-new" : "badge-used"}">${tx.type === "kirim" ? "📥 KIRIM" : "📤 CHIQIM"}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary)">
                        <span>${tx.amount} dona × ${formatPrice(tx.price_at_transaction)}</span>
                        <span style="font-weight:700;color:${tx.type === "kirim" ? "var(--accent-emerald)" : "var(--accent-rose)"}">${formatPrice(tx.amount * tx.price_at_transaction)}</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${formatDate(tx.created_at)}</div>
                </div>
            `).join("")}
        </div>
    `;
}
