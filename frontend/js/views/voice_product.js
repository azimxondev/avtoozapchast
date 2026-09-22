/**
 * Avto Sklad — AI Voice Product Assistant
 * Speech-to-text, entity recognition, missing info clarification,
 * and structured preview confirmation before saving to database.
 */

const VoiceProductAssistant = {
  recognition: null,
  isRecording: false,
  detectedLang: "uz-UZ",
  currentParsedData: null,

  async open() {
    if (!State.categories || State.categories.length === 0) {
      try {
        const catRes = await API.get("/categories");
        if (catRes.categories && catRes.categories.length > 0) {
          State.categories = catRes.categories;
        }
      } catch (e) {
        console.warn("Categories fetch error:", e);
      }
    }
    this.renderUI();
  },

  close() {
    this.stopRecording();
    const overlay = document.getElementById("voice-product-modal-overlay");
    if (overlay) overlay.remove();
  },

  renderUI() {
    const existing = document.getElementById("voice-product-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "voice-product-modal-overlay";
    overlay.className = "modal-overlay active";
    overlay.onclick = (e) => {
      if (e.target === overlay) VoiceProductAssistant.close();
    };

    overlay.innerHTML = `
      <div class="voice-modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title" style="display:flex;align-items:center;gap:8px">
            <span>🎙️</span> AI Ovozli Mahsulot Qo'shish
          </div>
          <button class="modal-close-btn" onclick="VoiceProductAssistant.close()">✕</button>
        </div>

        <div id="voice-content-body">
          <div class="voice-status-container">
            <div class="voice-mic-wrapper">
              <div class="voice-mic-pulse" id="voice-mic-pulse"></div>
              <button id="voice-mic-btn" class="voice-mic-btn" onclick="VoiceProductAssistant.toggleRecording()" title="Ovoz yozish">
                🎙️
              </button>
            </div>

            <div class="voice-status-title" id="voice-status-title">Gapirish uchun mikrofonga bosing</div>
            <div class="voice-status-desc" id="voice-status-desc">
              Masalan: <i>"BMW E39 bamperdan 15 dona bor, narxi 450 ming"</i> yoki <i>"Gentra fara 10 ta, 300 ming"</i>
            </div>

            <div class="voice-live-transcript" id="voice-transcript-box">
              Ovoz kutilmoqda...
            </div>
          </div>

          <!-- Language Selector Chips -->
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:14px">
            <button class="filter-chip ${this.detectedLang === 'uz-UZ' ? 'active' : ''}" onclick="VoiceProductAssistant.setLang('uz-UZ')">🇺🇿 O'zbekcha</button>
            <button class="filter-chip ${this.detectedLang === 'ru-RU' ? 'active' : ''}" onclick="VoiceProductAssistant.setLang('ru-RU')">🇷🇺 Русский</button>
            <button class="filter-chip ${this.detectedLang === 'en-US' ? 'active' : ''}" onclick="VoiceProductAssistant.setLang('en-US')">🇬🇧 English</button>
          </div>

          <!-- Manual Text Fallback Drawer -->
          <div style="background:var(--bg-surface-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;margin-bottom:10px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600">YOKI MATN SHAKLIDA YOZING:</div>
            <div style="display:flex;gap:8px">
              <input type="text" id="voice-manual-input" class="form-control" placeholder="Masalan: BMW bamper 15 ta 450 ming..." style="font-size:13px">
              <button class="btn btn-primary btn-sm" onclick="VoiceProductAssistant.submitManualText()">Yuborish</button>
            </div>
          </div>
        </div>

        <!-- Dynamic Confirmation or Clarification Container -->
        <div id="voice-result-area"></div>
      </div>
    `;

    document.body.appendChild(overlay);
  },

  setLang(lang) {
    this.detectedLang = lang;
    const chips = document.querySelectorAll(".voice-modal-sheet .filter-chip");
    chips.forEach(c => c.classList.remove("active"));
    event.target.classList.add("active");
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  },

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Utils.showToast("Ushbu brauzerda ovozli nutqni tanish (SpeechRecognition) qo'llab-quvvatlanmaydi. Matn orqali kiriting.", "warning");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.detectedLang;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      const micBtn = document.getElementById("voice-mic-btn");
      const pulse = document.getElementById("voice-mic-pulse");
      const title = document.getElementById("voice-status-title");
      const desc = document.getElementById("voice-status-desc");
      const box = document.getElementById("voice-transcript-box");

      this.recognition.onstart = () => {
        this.isRecording = true;
        if (micBtn) micBtn.classList.add("recording");
        if (pulse) pulse.classList.add("active");
        if (title) title.innerHTML = "<span style='color:var(--accent-rose)'>🔴 Eshitilmoqda...</span>";
        if (desc) desc.textContent = "Mahsulot nomi, miqdori va narxini bemalol ayting...";
        if (box) box.textContent = "Tinglamoqda...";
      };

      this.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(r => r[0].transcript)
          .join("");
        if (box) box.textContent = transcript;
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech error:", event.error);
        if (title) title.textContent = "Ovozni aniqlashda xatolik yuz berdi";
        this.stopRecording();
      };

      this.recognition.onend = () => {
        this.stopRecording();
        const recognizedText = box ? box.textContent.trim() : "";
        if (recognizedText && recognizedText !== "Tinglamoqda..." && recognizedText !== "Ovoz kutilmoqda...") {
          this.processVoiceText(recognizedText);
        }
      };

      this.recognition.start();
    } catch (e) {
      console.error("SpeechRecognition start failed:", e);
      this.stopRecording();
    }
  },

  stopRecording() {
    this.isRecording = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
    const micBtn = document.getElementById("voice-mic-btn");
    const pulse = document.getElementById("voice-mic-pulse");
    const title = document.getElementById("voice-status-title");
    if (micBtn) micBtn.classList.remove("recording");
    if (pulse) pulse.classList.remove("active");
    if (title) title.textContent = "Tahlil qilinmoqda...";
  },

  submitManualText() {
    const input = document.getElementById("voice-manual-input");
    if (!input || !input.value.trim()) {
      Utils.showToast("Iltimos, matn kiriting", "warning");
      return;
    }
    const box = document.getElementById("voice-transcript-box");
    if (box) box.textContent = input.value.trim();
    this.processVoiceText(input.value.trim());
  },

  async processVoiceText(text) {
    const title = document.getElementById("voice-status-title");
    const desc = document.getElementById("voice-status-desc");
    if (title) title.innerHTML = "⏳ <span style='color:var(--brand-blue)'>AI tahlil qilmoqda...</span>";
    if (desc) desc.textContent = "Ma'lumotlar ajratib olinmoqda va bazadagi tovarlar tekshirilmoqda...";

    try {
      const res = await API.post("/ai/parse-voice-product", { text });
      if (!res.success && res.error) {
        Utils.showToast(res.error, "error");
        if (title) title.textContent = "Qaytadan urinib ko'ring";
        return;
      }

      this.currentParsedData = res;

      // Check if clarification is needed
      if (res.needs_clarification) {
        this.renderClarification(res);
        return;
      }

      // Check if update intent or new product creation
      if (res.mode === "UPDATE_STOCK") {
        this.renderUpdateConfirmation(res);
      } else {
        this.renderCreateConfirmation(res.product);
      }
    } catch (err) {
      if (title) title.textContent = "Xatolik yuz berdi";
    }
  },

  renderClarification(res) {
    const resArea = document.getElementById("voice-result-area");
    if (!resArea) return;

    resArea.innerHTML = `
      <div class="voice-preview-card" style="border-color:var(--accent-amber)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:24px">❓</span>
          <div>
            <div style="font-weight:700;color:var(--accent-amber)">Qo'shimcha ma'lumot kerak</div>
            <div style="font-size:12px;color:var(--text-muted)">AI ba'zi parametrlarni aniqlashtirmoqchi</div>
          </div>
        </div>
        <p style="font-size:14px;color:var(--text-main);margin-bottom:14px;font-weight:600">
          "${Utils.escapeHtml(res.clarification_prompt)}"
        </p>
        <div style="display:flex;gap:8px">
          <input type="text" id="clarify-input" class="form-control" placeholder="Javobingiz (masalan: 15 ta, 450 ming)..." style="flex:1">
          <button class="btn btn-primary" onclick="VoiceProductAssistant.submitClarification()">Javob berish</button>
        </div>
      </div>
    `;

    setTimeout(() => {
      const inp = document.getElementById("clarify-input");
      if (inp) inp.focus();
    }, 100);
  },

  submitClarification() {
    const inp = document.getElementById("clarify-input");
    if (!inp || !inp.value.trim()) return;
    const box = document.getElementById("voice-transcript-box");
    const combined = (box ? box.textContent : "") + " " + inp.value.trim();
    this.processVoiceText(combined);
  },

  renderUpdateConfirmation(res) {
    const resArea = document.getElementById("voice-result-area");
    if (!resArea) return;

    resArea.innerHTML = `
      <div class="voice-preview-card" style="border-color:var(--accent-emerald)">
        <div class="voice-preview-header">
          <div>
            <span class="badge badge-success" style="margin-bottom:4px">Mavjud Tovar Qoldig'ini Oshirish</span>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-main)">${Utils.escapeHtml(res.product_name)}</h3>
            <div style="font-size:12px;color:var(--text-muted)">Artikul: <b>${Utils.escapeHtml(res.sku)}</b></div>
          </div>
        </div>

        <div style="background:var(--bg-surface);padding:12px;border-radius:var(--radius-md);margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;color:var(--text-muted)">Hozirgi qoldiq:</span>
            <span style="font-size:14px;font-weight:700;color:var(--text-main)">${res.prev_stock} ${Utils.escapeHtml(res.unit)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;color:var(--brand-blue);font-weight:700">Qo'shiladigan miqdor:</span>
            <span style="font-size:16px;font-weight:800;color:var(--accent-emerald)">+${res.add_quantity} ${Utils.escapeHtml(res.unit)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--border);padding-top:8px">
            <span style="font-size:13px;color:var(--text-main);font-weight:600">Yangi qoldiq bo'ladi:</span>
            <span style="font-size:16px;font-weight:800;color:var(--brand-blue)">${res.new_stock} ${Utils.escapeHtml(res.unit)}</span>
          </div>
        </div>

        <div class="voice-preview-actions">
          <button class="btn btn-secondary" style="flex:1" onclick="VoiceProductAssistant.close()">Bekor qilish</button>
          <button class="btn btn-primary" style="flex:2" id="confirm-voice-update-btn" onclick="VoiceProductAssistant.executeStockUpdate()">
            ✅ Tasdiqlash va Saqlash
          </button>
        </div>
      </div>
    `;
  },

  async executeStockUpdate() {
    const data = this.currentParsedData;
    if (!data || !data.product_id) return;

    const btn = document.getElementById("confirm-voice-update-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saqlanmoqda...";
    }

    try {
      await API.post("/stock/in", {
        product_id: data.product_id,
        quantity: data.add_quantity,
        purchase_price: data.purchase_price || 0,
        supplier: "AI Ovozli Kirim",
        note: `Ovozli buyruq orqali kiritildi (+${data.add_quantity} ${data.unit})`
      });

      Utils.showToast(`✅ ${data.product_name} qoldig'iga +${data.add_quantity} dona muvaffaqiyatli qo'shildi!`, "success");
      this.close();

      // Refresh view if on products or inventory
      if (typeof ProductsView !== "undefined") ProductsView.render();
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "✅ Tasdiqlash va Saqlash";
      }
    }
  },

  renderCreateConfirmation(p) {
    const resArea = document.getElementById("voice-result-area");
    if (!resArea) return;

    resArea.innerHTML = `
      <div class="voice-preview-card">
        <div class="voice-preview-header">
          <div>
            <span class="badge badge-primary" style="margin-bottom:4px">Yangi Mahsulot Preview</span>
            <div style="font-size:16px;font-weight:700;color:var(--text-main)" id="conf-name-display">${Utils.escapeHtml(p.name)}</div>
          </div>
        </div>

        <form id="voice-confirm-form" onsubmit="VoiceProductAssistant.executeProductCreate(event)">
          <div class="voice-preview-grid">
            <div class="voice-preview-item">
              <span class="voice-preview-label">Mahsulot Nomi</span>
              <input type="text" name="name" class="form-control" value="${Utils.escapeHtml(p.name)}" required style="font-size:13px;padding:6px 10px">
            </div>
            <div class="voice-preview-item">
              <span class="voice-preview-label">Artikul (SKU)</span>
              <input type="text" name="sku" class="form-control" value="${Utils.escapeHtml(p.sku)}" required style="font-size:13px;padding:6px 10px">
            </div>
            <div class="voice-preview-item">
              <span class="voice-preview-label">Miqdor (Dona)</span>
              <input type="number" name="quantity" class="form-control" value="${p.quantity}" min="1" required style="font-size:13px;padding:6px 10px">
            </div>
            <div class="voice-preview-item">
              <span class="voice-preview-label">Sotish Narxi (UZS)</span>
              <input type="number" name="selling_price" class="form-control" value="${p.selling_price}" min="0" required style="font-size:13px;padding:6px 10px">
            </div>
            <div class="voice-preview-item">
              <span class="voice-preview-label">Tannarx (UZS)</span>
              <input type="number" name="purchase_price" class="form-control" value="${p.purchase_price}" min="0" style="font-size:13px;padding:6px 10px">
            </div>
            <div class="voice-preview-item">
              <span class="voice-preview-label">Toifa</span>
              <select name="category_id" class="form-control" style="font-size:13px;padding:6px 10px">
                ${State.categories.map(c => `
                  <option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.icon} ${c.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="voice-preview-actions">
            <button type="button" class="btn btn-secondary" style="flex:1" onclick="VoiceProductAssistant.close()">Bekor qilish</button>
            <button type="submit" class="btn btn-primary" style="flex:2" id="confirm-save-prod-btn">
              ✅ Tasdiqlash va Saqlash
            </button>
          </div>
        </form>
      </div>
    `;
  },

  async executeProductCreate(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("confirm-save-prod-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saqlanmoqda...";
    }

    const formData = new FormData(form);
    const p = (this.currentParsedData && this.currentParsedData.product) || {};

    const name = (formData.get("name") || "").trim();
    const sku = (formData.get("sku") || "").trim();
    const categoryId = parseInt(formData.get("category_id"), 10) || 1;
    const quantity = Math.max(0, parseInt(formData.get("quantity") || 0, 10));
    const sellingPrice = Math.max(0, parseInt(formData.get("selling_price") || 0, 10));
    const purchasePrice = Math.max(0, parseInt(formData.get("purchase_price") || 0, 10));

    const payload = {
      name,
      sku,
      category_id: categoryId,
      quantity,
      selling_price: sellingPrice,
      purchase_price: purchasePrice,
      brand: p.brand || "",
      car_brand: p.car_brand || "",
      car_model: p.car_model || "",
      shelf_location: p.shelf_location || "A-01",
      condition: "NEW",
      unit: "dona",
      description: p.description || ""
    };

    try {
      await API.post("/products", payload);
      Utils.showToast(`✅ '${payload.name}' mahsuloti omborga muvaffaqiyatli saqlandi!`, "success");
      VoiceProductAssistant.close();
      if (typeof ProductsView !== "undefined" && ProductsView.render) ProductsView.render();
    } catch (err) {
      // Toast displayed by API client
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "✅ Tasdiqlash va Saqlash";
      }
    }
  }
};
