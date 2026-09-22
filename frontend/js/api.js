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
        let errorMsg = "Kutilmagan xatolik yuz berdi.";
        if (typeof data.detail === "string") {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(d => {
            const loc = Array.isArray(d.loc) ? d.loc.filter(x => x !== 'body').join('.') : '';
            return loc ? `${loc}: ${d.msg || 'Noto\'g\'ri qiymat'}` : (d.msg || JSON.stringify(d));
          }).join("; ");
        } else if (data.message) {
          errorMsg = data.message;
        } else if (response.statusText) {
          errorMsg = `Server xatosi (${response.status}): ${response.statusText}`;
        }
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
