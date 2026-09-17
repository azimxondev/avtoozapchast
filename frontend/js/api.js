/**
 * Avto Sklad — API Client
 */

const API = {
  baseUrl: "/api",

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    // Attach role for demo mode
    if (State.currentRole) {
      headers["X-Demo-Role"] = State.currentRole;
    }

    // Attach Telegram initData if available
    if (State.telegramInitData) {
      headers["X-Telegram-Init-Data"] = State.telegramInitData;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || "Kutilmagan xatolik yuz berdi.";
        Utils.showToast(errorMsg, "error");
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      if (!options.silent) {
        console.error(`API Error [${endpoint}]:`, err);
      }
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        query.append(k, v);
      }
    }
    const qs = query.toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return this.request(url, { method: "GET" });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
};
