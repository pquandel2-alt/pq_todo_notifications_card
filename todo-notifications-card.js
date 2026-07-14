// @ts-check
// =====================================================================
//  Todo Notifications Card v0.2.0
// =====================================================================

class TodoNotificationsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {
      entity: "todo.todo",
      title: "Todo Liste",
      notify_added_title: "📋 Neue Aufgabe",
      notify_added_message: "{{ item }} hinzugefügt",
      notify_completed_title: "✅ Erledigt",
      notify_completed_message: "{{ item }} ist erledigt",
      notify_services: [],
    };
    this._hass = null;
    this._items = [];
    this._previousItems = null;
    this._lastState = null;
    this._inputValue = "";
    this._editingUid = null;
    this._editValue = "";
    this._notifiedUids = new Set();
  }

  setConfig(config) {
    this._config = {
      entity: "todo.todo",
      title: "Todo Liste",
      notify_added_title: "📋 Neue Aufgabe",
      notify_added_message: "{{ item }} hinzugefügt",
      notify_completed_title: "✅ Erledigt",
      notify_completed_message: "{{ item }} ist erledigt",
      notify_services: [],
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    const entityState = hass.states[this._config.entity];
    if (entityState && entityState.state !== this._lastState) {
      this._lastState = entityState.state;
      this._fetchAndCompare();
    }
  }

  async _fetchAndCompare() {
    try {
      const result = await this._hass.callWS({
        type: "todo/item/list",
        entity_id: this._config.entity,
      });
      const current = result.items || [];

      if (this._previousItems !== null) {
        const prevUids = new Set(this._previousItems.map((i) => i.uid));
        const prevByUid = new Map(this._previousItems.map((i) => [i.uid, i]));

        // Neu hinzugefügte Items
        for (const item of current) {
          if (
            item.status === "needs_action" &&
            !prevUids.has(item.uid) &&
            !this._notifiedUids.has(item.uid)
          ) {
            await this._sendNotification(
              this._config.notify_added_title,
              this._config.notify_added_message,
              item.summary
            );
            this._notifiedUids.add(item.uid);
          }
        }

        // Soeben erledigte Items (needs_action → completed)
        for (const item of current) {
          const prev = prevByUid.get(item.uid);
          if (
            prev &&
            prev.status === "needs_action" &&
            item.status === "completed" &&
            !this._notifiedUids.has(`completed_${item.uid}`)
          ) {
            await this._sendNotification(
              this._config.notify_completed_title,
              this._config.notify_completed_message,
              item.summary
            );
            this._notifiedUids.add(`completed_${item.uid}`);
          }
        }

        // Cleanup: gelöschte Items aus notifiedUids entfernen
        for (const uid of Array.from(this._notifiedUids)) {
          const stillExists = current.some((i) => i.uid === uid.replace("completed_", ""));
          if (!stillExists) {
            this._notifiedUids.delete(uid);
          }
        }
      }

      this._previousItems = current;
      this._items = current;
      this._render();
    } catch (err) {
      console.error("Error fetching todo items:", err);
    }
  }

  async _sendNotification(title, message, itemText) {
    if (!this._config.notify_services || this._config.notify_services.length === 0) {
      return;
    }

    const processedTitle = title.replace("{{ item }}", itemText);
    const processedMessage = message.replace("{{ item }}", itemText);

    for (const serviceId of this._config.notify_services) {
      try {
        await this._hass.callService("notify", serviceId, {
          title: processedTitle,
          message: processedMessage,
        });
      } catch (err) {
        console.error(`Error sending notification to ${serviceId}:`, err);
      }
    }
  }

  async _addItem() {
    if (!this._inputValue.trim()) return;

    try {
      await this._hass.callService("todo", "add_item", {
        entity_id: this._config.entity,
        item: this._inputValue.trim(),
      });
      this._inputValue = "";
      await this._fetchAndCompare();
    } catch (err) {
      console.error("Error adding item:", err);
    }
  }

  async _toggleItem(uid, currentStatus) {
    const newStatus = currentStatus === "needs_action" ? "completed" : "needs_action";
    try {
      await this._hass.callService("todo", "update_item", {
        entity_id: this._config.entity,
        item: uid,
        status: newStatus,
      });
      await this._fetchAndCompare();
    } catch (err) {
      console.error("Error toggling item:", err);
    }
  }

  async _deleteItem(uid) {
    try {
      await this._hass.callService("todo", "remove_item", {
        entity_id: this._config.entity,
        item: uid,
      });
      await this._fetchAndCompare();
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }

  async _clearCompleted() {
    try {
      await this._hass.callService("todo", "remove_completed_items", {
        entity_id: this._config.entity,
      });
      await this._fetchAndCompare();
    } catch (err) {
      console.error("Error clearing completed:", err);
    }
  }

  _render() {
    const activeItems = this._items.filter((i) => i.status === "needs_action");
    const completedItems = this._items.filter((i) => i.status === "completed");

    const itemsHtml = activeItems
      .map(
        (item) => `
        <div class="item active">
          <input
            type="checkbox"
            class="checkbox"
            data-uid="${item.uid}"
            aria-label="Mark ${item.summary} as done"
          >
          <span class="item-text">${this._escapeHtml(item.summary)}</span>
          <button class="delete-btn" data-uid="${item.uid}" aria-label="Delete ${item.summary}">
            🗑️
          </button>
        </div>
      `
      )
      .join("");

    const completedHtml = completedItems
      .map(
        (item) => `
        <div class="item completed">
          <input
            type="checkbox"
            class="checkbox"
            data-uid="${item.uid}"
            checked
            aria-label="Mark ${item.summary} as pending"
          >
          <span class="item-text">${this._escapeHtml(item.summary)}</span>
          <button class="delete-btn" data-uid="${item.uid}" aria-label="Delete ${item.summary}">
            🗑️
          </button>
        </div>
      `
      )
      .join("");

    const clearBtn =
      completedItems.length > 0
        ? `<button class="clear-completed-btn">Erledigte löschen (${completedItems.length})</button>`
        : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-color: rgba(255, 255, 255, 0.15);
          --primary-border: rgba(255, 255, 255, 0.25);
          --primary-text: #fff;
          --secondary-text: rgba(255, 255, 255, 0.7);
        }

        .card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid var(--primary-border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          color: var(--primary-text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--primary-border);
        }

        .header-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .header-count {
          font-size: 14px;
          color: var(--secondary-text);
        }

        .input-group {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .input-group input {
          flex: 1;
          background: var(--primary-color);
          border: 1px solid var(--primary-border);
          border-radius: 12px;
          padding: 12px 16px;
          color: var(--primary-text);
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .input-group input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .input-group input::placeholder {
          color: var(--secondary-text);
        }

        .add-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .add-btn:active {
          transform: translateY(0);
        }

        .items-section {
          margin-bottom: 16px;
        }

        .items-label {
          font-size: 12px;
          color: var(--secondary-text);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 8px;
          background: var(--primary-color);
          border-radius: 10px;
          transition: all 0.2s ease;
        }

        .item:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .item.completed {
          opacity: 0.6;
        }

        .item.completed .item-text {
          text-decoration: line-through;
          color: var(--secondary-text);
        }

        .checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #667eea;
          flex-shrink: 0;
        }

        .item-text {
          flex: 1;
          word-break: break-word;
          font-size: 14px;
        }

        .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.6;
          transition: opacity 0.2s ease;
          padding: 4px 8px;
        }

        .delete-btn:hover {
          opacity: 1;
        }

        .clear-completed-btn {
          width: 100%;
          background: var(--primary-color);
          border: 1px solid var(--primary-border);
          border-radius: 10px;
          padding: 10px;
          color: var(--secondary-text);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
          margin-top: 8px;
        }

        .clear-completed-btn:hover {
          background: rgba(255, 255, 255, 0.18);
          color: var(--primary-text);
        }

        .empty-state {
          text-align: center;
          padding: 24px;
          color: var(--secondary-text);
          font-size: 14px;
        }
      </style>

      <div class="card">
        <div class="header">
          <h2 class="header-title">${this._escapeHtml(this._config.title || "Todo Liste")}</h2>
          <span class="header-count">${activeItems.length}</span>
        </div>

        <div class="input-group">
          <input
            type="text"
            placeholder="Neue Aufgabe eingeben..."
            value="${this._escapeHtml(this._inputValue)}"
            class="todo-input"
          >
          <button class="add-btn">Hinzufügen</button>
        </div>

        ${
          activeItems.length === 0 && completedItems.length === 0
            ? '<div class="empty-state">Keine Aufgaben</div>'
            : ""
        }

        ${
          activeItems.length > 0
            ? `
            <div class="items-section">
              <div class="items-label">Aktiv</div>
              ${itemsHtml}
            </div>
          `
            : ""
        }

        ${
          completedItems.length > 0
            ? `
            <div class="items-section">
              <div class="items-label">Erledigt</div>
              ${completedHtml}
              ${clearBtn}
            </div>
          `
            : ""
        }
      </div>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const input = this.shadowRoot.querySelector(".todo-input");
    const addBtn = this.shadowRoot.querySelector(".add-btn");
    const clearBtn = this.shadowRoot.querySelector(".clear-completed-btn");
    const checkboxes = this.shadowRoot.querySelectorAll(".checkbox");
    const deleteBtns = this.shadowRoot.querySelectorAll(".delete-btn");

    if (input) {
      input.addEventListener("input", (e) => {
        this._inputValue = e.target.value;
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this._addItem();
      });
    }

    if (addBtn) {
      addBtn.addEventListener("click", () => this._addItem());
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this._clearCompleted());
    }

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const uid = e.target.dataset.uid;
        const item = this._items.find((i) => i.uid === uid);
        if (item) {
          this._toggleItem(uid, item.status);
        }
      });
    });

    deleteBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const uid = e.target.dataset.uid;
        this._deleteItem(uid);
      });
    });
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  connectedCallback() {
    if (this._hass) {
      this._fetchAndCompare();
    }
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement("todo-notifications-card-editor");
  }

  static getStubConfig() {
    return { entity: "todo.todo", title: "Todo Liste" };
  }
}

class TodoNotificationsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._render();
    }
  }

  _todoEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter((key) => key.startsWith("todo."))
      .sort();
  }

  _emitChange(key, value) {
    this._config[key] = value;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    const entities = this._todoEntities();
    const entityOptions = entities
      .map(
        (e) => `<option value="${e}" ${this._config.entity === e ? "selected" : ""}>${e}</option>`
      )
      .join("");

    const notifyServicesStr = Array.isArray(this._config.notify_services)
      ? this._config.notify_services.join(", ")
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .editor {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .editor-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        label {
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          opacity: 0.7;
        }
        select, input, textarea {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
        .hint {
          font-size: 11px;
          opacity: 0.6;
          margin-top: 4px;
        }
      </style>

      <div class="editor">
        <div class="editor-row">
          <label for="entity">Todo Entity</label>
          <select id="entity" @change="${(e) => this._emitChange("entity", e.target.value)}">
            <option value="">Wähle eine Todo-Entity</option>
            ${entityOptions}
          </select>
        </div>

        <div class="editor-row">
          <label for="title">Titel (Optional)</label>
          <input
            type="text"
            id="title"
            placeholder="z.B. Einkaufsliste"
            value="${this._config.title || ""}"
            @change="${(e) => this._emitChange("title", e.target.value)}"
          >
        </div>

        <div class="editor-row">
          <label for="notify-services">Benachrichtigungs-Services</label>
          <input
            type="text"
            id="notify-services"
            placeholder="z.B. mobile_app_handy_1, mobile_app_handy_2"
            value="${notifyServicesStr}"
            @change="${(e) => this._handleNotifyServicesChange(e.target.value)}"
          >
          <div class="hint">Komma-separiert. Beispiel: mobile_app_iphone, mobile_app_ipad</div>
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _handleNotifyServicesChange(value) {
    const services = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    this._emitChange("notify_services", services);
  }

  _attachEventListeners() {
    const select = this.shadowRoot.querySelector("select");
    const titleInput = this.shadowRoot.querySelector("#title");
    const notifyInput = this.shadowRoot.querySelector("#notify-services");

    if (select) {
      select.addEventListener("change", (e) => {
        this._emitChange("entity", e.target.value);
      });
    }

    if (titleInput) {
      titleInput.addEventListener("change", (e) => {
        this._emitChange("title", e.target.value);
      });
    }

    if (notifyInput) {
      notifyInput.addEventListener("change", (e) => {
        this._handleNotifyServicesChange(e.target.value);
      });
    }
  }
}

customElements.define("todo-notifications-card", TodoNotificationsCard);
customElements.define("todo-notifications-card-editor", TodoNotificationsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "todo-notifications-card",
  name: "Todo Notifications Card",
  description: "Todo-Liste mit State-Change Events für Benachrichtigungen",
  preview: true,
  documentationURL: "https://github.com/pquandel2-alt/pq_todo_notifications_card",
});
