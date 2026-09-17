/**
 * Avto Sklad — Utility Functions
 */

const Utils = {
  /**
   * Format UZS currency: e.g. 150000 -> "150 000 UZS"
   */
  formatUZS(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "0 UZS";
    const num = Math.round(Number(amount));
    const parts = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${parts} UZS`;
  },

  /**
   * Format date/time cleanly for Uzbekistan (DD.MM.YYYY, HH:mm)
   */
  formatDateTime(dateStr) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year}, ${hours}:${mins}`;
    } catch {
      return dateStr;
    }
  },

  /**
   * Debounce helper for instant search
   */
  debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /**
   * Safe HTML escaping to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Toast notification
   */
  showToast(message, type = "info") {
    // Respect Do Not Disturb (DND) application preference
    if (window.AVTO_SKLAD_DND && type === "info") {
      return;
    }
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";

    toast.innerHTML = `<span>${icon}</span><span style="flex:1">${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
