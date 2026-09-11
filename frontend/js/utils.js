/* =====================================================
   AVTO SKLAD — Utility Helpers
   ===================================================== */

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

function escapeHtml(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function showToast(msg, type = "") {
    const $toast = document.getElementById("toast");
    if (!$toast) return;
    $toast.textContent = msg;
    $toast.className = "toast" + (type ? " " + type : "");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        $toast.classList.add("hidden");
    }, 2500);
}

function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
        document.body.classList.add("light-theme");
        const btn = document.getElementById("theme-toggle-btn");
        if (btn) btn.textContent = "☀️";
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light-theme");
    const btn = document.getElementById("theme-toggle-btn");
    if (isLight) {
        if (btn) btn.textContent = "☀️";
        localStorage.setItem("theme", "light");
        showToast("☀️ Kunduzgi rejim", "info");
    } else {
        if (btn) btn.textContent = "🌙";
        localStorage.setItem("theme", "dark");
        showToast("🌙 Tungi rejim", "info");
    }
}

document.addEventListener("DOMContentLoaded", initTheme);

