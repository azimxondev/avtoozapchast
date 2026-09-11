/* =====================================================
   AVTO SKLAD — Main App Entry & Navigation Router
   ===================================================== */

let currentTab = "dashboard";

async function loadAllData() {
    try {
        const [prods, stats, period, shop, roleInfo] = await Promise.all([
            api("/api/products"),
            api("/api/statistics"),
            api(`/api/statistics/${currentPeriod}`),
            api("/api/shop"),
            api("/api/admin/me").catch(() => ({ role: "user", is_admin: false, is_head_admin: false })),
        ]);

        products = prods;
        overviewStats = stats;
        periodStats = period;
        shopInfo = shop;
        setAuthRole(roleInfo);

        setupAdminUI();
    } catch (e) {
        console.error("Data load error:", e);
        throw e;
    }
}

function setupAdminUI() {
    const adminRoleBadge = document.getElementById("header-role-badge");
    if (adminRoleBadge) {
        if (isHeadAdmin) {
            adminRoleBadge.innerHTML = `<span class="admin-badge badge-head-admin" style="font-size:10px">🔑 HEAD ADMIN</span>`;
        } else if (isAdmin) {
            adminRoleBadge.innerHTML = `<span class="admin-badge badge-co-admin" style="font-size:10px">👨‍💼 ADMIN</span>`;
        } else {
            adminRoleBadge.innerHTML = ``;
        }
    }

    // Hide admin tab button for normal users if needed
    const adminNavBtn = document.querySelector('.nav-btn[data-tab="admin"]');
    if (adminNavBtn) {
        adminNavBtn.style.display = isAdmin ? "flex" : "none";
    }
}

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
    const $tabContent = document.getElementById("tab-content");
    if ($tabContent) {
        $tabContent.style.animation = "none";
        $tabContent.offsetHeight; // reflow
        $tabContent.style.animation = "fadeIn 0.25s ease";
    }

    switch (currentTab) {
        case "dashboard": renderDashboard(); break;
        case "products": renderProducts(); break;
        case "history": renderHistory(); break;
        case "location": renderLocation(); break;
        case "admin": renderAdminPanel(); break;
    }
}

async function init() {
    const $loading = document.getElementById("loading-screen");
    const $error = document.getElementById("error-screen");
    const $errorMsg = document.getElementById("error-message");
    const $main = document.getElementById("main-content");

    try {
        await loadAllData();

        if ($loading) $loading.classList.add("hidden");
        if ($main) $main.classList.remove("hidden");

        setupNavigation();
        renderDashboard();
    } catch (e) {
        console.error("Init error:", e);
        if ($loading) $loading.classList.add("hidden");
        if ($main) $main.classList.add("hidden");
        if ($errorMsg) $errorMsg.textContent = e.message || "Tizimga ulanib bo'lmadi";
        if ($error) $error.classList.remove("hidden");
    }
}

// Start application
init();
