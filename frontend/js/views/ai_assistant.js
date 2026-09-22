/**
 * Avto Sklad — AI Voice Assistant View
 * Conversational dialogue, Text-to-Speech (TTS), intent execution, and safe system actions.
 */

const AIAssistantView = {
  recognition: null,
  isRecording: false,
  isSpeaking: false,
  messages: [
    {
      sender: "bot",
      text: "Assalomu alaykum! Men Avto Sklad AI aqlli yordamchisiman. Mahsulotlar qoldig'i, narxlar, obshiy stock yoki ombor bo'yicha savollaringiz bo'lsa, bemalol yozing.",
      action: null
    }
  ],

  open() {
    this.renderUI();
  },

  close() {
    this.stopVoice();
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    const drawer = document.getElementById("ai-assistant-drawer");
    if (drawer) drawer.remove();
  },

  renderUI() {
    const existing = document.getElementById("ai-assistant-drawer");
    if (existing) existing.remove();

    const drawer = document.createElement("div");
    drawer.id = "ai-assistant-drawer";
    drawer.className = "ai-drawer";
    drawer.onclick = (e) => {
      if (e.target === drawer) AIAssistantView.close();
    };

    drawer.innerHTML = `
      <div class="ai-drawer-content" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="ai-chat-header">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">🤖</span>
            <div>
              <div style="font-weight:700;color:var(--text-main);font-size:16px">Avto Sklad AI Yordamchi</div>
              <div style="font-size:12px;color:var(--accent-emerald);display:flex;align-items:center;gap:4px">
                <span style="width:6px;height:6px;background:var(--accent-emerald);border-radius:50%;display:inline-block"></span> Onlayn (AI Chat)
              </div>
            </div>
          </div>
          <button class="scanner-close-btn" onclick="AIAssistantView.close()">✕</button>
        </div>

        <!-- Chat messages container -->
        <div class="ai-chat-messages" id="ai-chat-messages"></div>

        <!-- Quick Suggestions Chips -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding:8px 16px;scrollbar-width:none">
          <button class="filter-chip" onclick="AIAssistantView.sendQuickPrompt('Spark oyna nechta bor?')">🔍 Spark oyna nechta?</button>
          <button class="filter-chip" onclick="AIAssistantView.sendQuickPrompt('Nexia 1 bakavoy nech pul?')">💰 Nexia 1 bakavoy narxi?</button>
          <button class="filter-chip" onclick="AIAssistantView.sendQuickPrompt('Do\'kon manzili va ish vaqti?')">📍 Manzil & Ish vaqti</button>
          <button class="filter-chip" onclick="AIAssistantView.sendQuickPrompt('Scannerni och')">📷 Skaner</button>
          <button class="filter-chip" onclick="AIAssistantView.sendQuickPrompt('Dostavka xizmati bormi?')">🚚 Dostavka</button>
        </div>

        <!-- Input Bar -->
        <div class="ai-chat-input-bar">
          <button id="ai-mic-trigger-btn" class="ai-mic-trigger" onclick="AIAssistantView.toggleSpeech()" title="Ovoz bilan gapirish">
            🎙️
          </button>
          <input type="text" id="ai-chat-text-input" class="ai-chat-input" placeholder="Savol yoki buyruq yozing..." onkeydown="if(event.key==='Enter') AIAssistantView.submitInput()">
          <button class="ai-send-btn" onclick="AIAssistantView.submitInput()" title="Yuborish">
            ➤
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);
    this.renderMessages();
  },

  renderMessages() {
    const container = document.getElementById("ai-chat-messages");
    if (!container) return;

    container.innerHTML = this.messages.map((m, idx) => {
      if (m.sender === "user") {
        return `
          <div class="ai-msg-wrapper user">
            <div class="ai-msg user">${m.text}</div>
          </div>
        `;
      } else {
        return `
          <div class="ai-msg-wrapper bot">
            <div class="ai-bot-sender-badge">
              <span class="badge-icon">✨</span>
              <span>AI Yordamchi</span>
            </div>
            <div class="ai-msg bot">
              ${m.isThinking ? `
                <div class="ai-typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              ` : `
                <div class="ai-msg-content">${m.text}</div>
                ${m.action ? `
                  <button type="button" class="ai-msg-action-btn" onclick="AIAssistantView.triggerAction(${idx})">
                    <span>🚀</span> ${Utils.escapeHtml(m.action.label || 'Davom etish')}
                  </button>
                ` : ''}
              `}
            </div>
          </div>
        `;
      }
    }).join("");

    container.scrollTop = container.scrollHeight;
  },

  sendQuickPrompt(text) {
    const input = document.getElementById("ai-chat-text-input");
    if (input) input.value = text;
    this.submitInput();
  },

  submitInput() {
    const input = document.getElementById("ai-chat-text-input");
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    input.value = "";
    this.handleUserQuery(query);
  },

  async handleUserQuery(query) {
    this.messages.push({ sender: "user", text: Utils.escapeHtml(query) });
    this.renderMessages();

    // Modern typing pulse indicator
    const thinkingIdx = this.messages.length;
    this.messages.push({ sender: "bot", text: "", isThinking: true, action: null });
    this.renderMessages();

    try {
      const res = await API.post("/ai/assistant/chat", { message: query });
      const answer = res.answer || "Kechirasiz, javob topilmadi.";

      this.messages[thinkingIdx] = {
        sender: "bot",
        text: answer,
        isThinking: false,
        action: res.action,
        voice_text: res.voice_text
      };
      this.renderMessages();

      // Voice/audio speech synthesis is disabled (text-only mode)
    } catch (err) {
      this.messages[thinkingIdx] = {
        sender: "bot",
        text: "Kechirasiz, xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
        isThinking: false,
        action: null
      };
      this.renderMessages();
    }
  },

  toggleSpeech() {
    if (this.isRecording) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  },

  startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Utils.showToast("Ovozli nutqni tanish qo'llab-quvvatlanmaydi", "warning");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "uz-UZ";
      this.recognition.interimResults = false;

      const micBtn = document.getElementById("ai-mic-trigger-btn");
      const input = document.getElementById("ai-chat-text-input");

      this.recognition.onstart = () => {
        this.isRecording = true;
        if (micBtn) micBtn.classList.add("recording");
        if (input) input.placeholder = "🔴 Eshitilmoqda... Gapiring...";
      };

      this.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          this.handleUserQuery(transcript);
        }
      };

      this.recognition.onerror = () => {
        this.stopVoice();
      };

      this.recognition.onend = () => {
        this.stopVoice();
      };

      this.recognition.start();
    } catch (e) {
      console.warn("Speech recognition error:", e);
      this.stopVoice();
    }
  },

  stopVoice() {
    this.isRecording = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
    const micBtn = document.getElementById("ai-mic-trigger-btn");
    const input = document.getElementById("ai-chat-text-input");
    if (micBtn) micBtn.classList.remove("recording");
    if (input) input.placeholder = "Savol yoki buyruq yozing...";
  },

  speakAnswer(text) {
    // Text-to-speech audio reading is permanently disabled
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  },

  triggerAction(idx) {
    const m = this.messages[idx];
    if (!m || !m.action) return;

    this.close();
    const action = m.action;

    switch (action.type) {
      case "OPEN_SCANNER":
        if (typeof ScannerView !== "undefined") ScannerView.open();
        break;
      case "OPEN_VOICE_PRODUCT":
        if (typeof VoiceProductAssistant !== "undefined") VoiceProductAssistant.open();
        break;
      case "VIEW_PRODUCT":
        if (typeof ProductsView !== "undefined" && ProductsView.openDetailModal) {
          ProductsView.openDetailModal(action.product_id);
        }
        break;
      case "NAVIGATE_TAB":
        if (typeof App !== "undefined") {
          App.navigate(action.tab, action.params);
        }
        break;
      default:
        console.log("Unknown action:", action);
    }
  }
};
