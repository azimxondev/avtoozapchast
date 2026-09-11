/* =====================================================
   AVTO SKLAD — Admin Panel & Role Management JS
   ===================================================== */

let adminList = [];

async function loadAdmins() {
    try {
        adminList = await api("/api/admin/list");
    } catch {
        adminList = [];
    }
}

async function renderAdminPanel() {
    const $tabContent = document.getElementById("tab-content");
    if (!$tabContent) return;

    if (!isAdmin) {
        $tabContent.innerHTML = `
            <div style="text-align:center;padding:40px 20px;background:var(--bg-card);border-radius:var(--radius-xl);border:1px solid var(--border)">
                <div style="font-size:48px;margin-bottom:12px">🔒</div>
                <div style="font-size:16px;font-weight:700;color:var(--accent-rose);margin-bottom:6px">Ruxsat Yo'q</div>
                <p style="font-size:13px;color:var(--text-muted)">Ushbu bo'lim faqat Adminlar va Bosh Admin uchun mo'ljallangan.</p>
            </div>
        `;
        return;
    }

    $tabContent.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Sizning rolingiz</div>
            <div class="admin-badge ${isHeadAdmin ? "badge-head-admin" : "badge-co-admin"}">
                ${isHeadAdmin ? "🔑 BOSH ADMIN (HEAD ADMIN)" : "👨‍💼 CO-ADMIN"}
            </div>
        </div>

        <div class="section-title">
            <span>👥 Adminlar Ro'yxati</span>
            ${isHeadAdmin ? `<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="openAddAdminModal()">+ Qo'shish</button>` : ""}
        </div>

        <div id="admin-list-container">
            <div style="text-align:center;padding:20px 0;color:var(--text-muted)">Yuklanmoqda...</div>
        </div>
    `;

    await loadAdmins();
    renderAdminList();
}

function renderAdminList() {
    const $container = document.getElementById("admin-list-container");
    if (!$container) return;

    if (adminList.length === 0) {
        $container.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted)">Adminlar topilmadi</div>`;
        return;
    }

    $container.innerHTML = adminList.map((a) => `
        <div class="admin-card">
            <div class="admin-info">
                <div class="admin-name">${escapeHtml(a.full_name || "Admin")}</div>
                <div class="admin-id">Telegram ID: ${a.telegram_id}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <span class="admin-badge ${a.is_head_admin ? "badge-head-admin" : "badge-co-admin"}" style="font-size:10px">
                    ${a.is_head_admin ? "Bosh Admin" : "Co-Admin"}
                </span>
                ${(isHeadAdmin && !a.is_head_admin) ? `
                    <button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeAdmin(${a.telegram_id})">✕</button>
                ` : ""}
            </div>
        </div>
    `).join("");
}

function openAddAdminModal() {
    document.getElementById("product-form-content").innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-header">
            <div class="modal-title">➕ Yangi Co-Admin qo'shish</div>
            <button class="modal-close" onclick="closeAllModals()">✕</button>
        </div>

        <div class="form-group">
            <label class="form-label">Telegram ID</label>
            <input class="form-input" id="admin-tg-id" type="number" placeholder="Masalan: 123456789" inputmode="numeric">
        </div>

        <button class="btn btn-primary btn-full btn-lg" id="add-admin-submit-btn" onclick="submitAddAdmin()">
            ➕ Admin sifatida tasdiqlash
        </button>
    `;
    showModal("product-form-modal");
}

async function submitAddAdmin() {
    const input = document.getElementById("admin-tg-id");
    const tid = parseInt(input?.value) || 0;

    if (!tid) {
        showToast("❌ Yaroqli Telegram ID kiriting", "error");
        return;
    }

    const btn = document.getElementById("add-admin-submit-btn");
    btn.disabled = true;
    btn.textContent = "Qo'shilmoqda...";

    try {
        await api("/api/admin/add", {
            method: "POST",
            body: JSON.stringify({ telegram_id: tid }),
        });

        showToast(`✅ Admin (${tid}) qo'shildi`, "success");
        closeAllModals();
        await renderAdminPanel();
    } catch (e) {
        showToast("❌ " + e.message, "error");
        btn.disabled = false;
        btn.textContent = "➕ Admin sifatida tasdiqlash";
    }
}

async function removeAdmin(telegramId) {
    if (!confirm(`Haqiqatan ham ${telegramId} adminlikdan chiqarilsinmi?`)) return;

    try {
        await api(`/api/admin/${telegramId}`, { method: "DELETE" });
        showToast("✅ Adminlik muvaffaqiyatli bekor qilindi", "success");
        await renderAdminPanel();
    } catch (e) {
        showToast("❌ " + e.message, "error");
    }
}
