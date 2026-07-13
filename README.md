# Todo Notifications Card

Eine Home-Assistant Custom Card für Todo-Listen mit intelligenten State-Change Events für unterschiedliche, inhaltsbezogene Benachrichtigungen.

## Features

- 📋 Todo-Liste mit glasmorph Design
- ✅ Items abhaken (completed/needs_action)
- ➕ Neue Items hinzufügen
- 🗑️ Items einzeln oder als Batch löschen
- 🔔 Custom Events bei Hinzufügen/Erledigen (mit Item-Text)
- 🤖 Integration mit Home-Assistant Automationen

## Installation

### Via HACS

1. **HACS öffnen** → Custom repositories
2. Repository URL: `https://github.com/pquandel2-alt/pq_todo_notifications_card`
3. Kategorie: Lovelace
4. Installieren & Lovelace neu laden

### Manuell

1. `todo-notifications-card.js` in dein HA-Config `/www/` Verzeichnis kopieren
2. Dashboard-YAML oder UI:

```yaml
type: custom:todo-notifications-card
entity: todo.meine_liste
title: "Meine Aufgaben"
```

## Konfiguration

### YAML

```yaml
views:
  - title: Todo
    cards:
      - type: custom:todo-notifications-card
        entity: todo.meine_liste        # Erforderlich
        title: "Einkaufsliste"           # Optional (Default: "Todo Liste")
```

### UI Editor

Dashboard → Card hinzufügen → Todo Notifications Card → Dropdowns ausfüllen

## Funktionsweise

### Events

Die Card feuert zwei Custom Events:

1. **`pq_todo_item_added`** — wenn ein neues Item hinzugefügt wird
   - `event_data.item` — Titel des Items
   - `event_data.entity_id` — Die Todo-Entity

2. **`pq_todo_item_completed`** — wenn ein Item auf `completed` gesetzt wird
   - `event_data.item` — Titel des Items
   - `event_data.entity_id` — Die Todo-Entity

### Automation Beispiel

```yaml
alias: "📋 Todo Benachrichtigungen"
description: ""
trigger:
  - platform: event
    event_type: pq_todo_item_added
    id: hinzugefuegt
  - platform: event
    event_type: pq_todo_item_completed
    id: erledigt
condition: []
action:
  - choose:
      - conditions:
          - condition: trigger
            id: hinzugefuegt
        sequence:
          - service: notify.mobile_app_dein_handy
            data:
              title: "📋 Neue Aufgabe"
              message: "{{ trigger.event.data.item }} hinzugefügt"
      - conditions:
          - condition: trigger
            id: erledigt
        sequence:
          - service: notify.mobile_app_dein_handy
            data:
              title: "✅ Erledigt!"
              message: "{{ trigger.event.data.item }} ist erledigt"
mode: parallel
```

## Wichtig

⚠️ **Event-Triggering nur wenn Card offen ist**

Die Card feuert Events über `set hass()` — das läuft nur, wenn die Card im Browser
aktiv ist oder das Dashboard geöffnet ist. Für vollständige 24/7-Überwachung:

- Option A: Automation mit automatisierter Todo-Entity-Überwachung (z.B. via Template Sensors)
- Option B: HA-interner State-Change Trigger auf die Todo-Entity (zeigt nur den Count, nicht den Item-Text)

Die Card ist ideal für **Home-Gebrauch mit Manual-Überwachung**.

## Styling

Die Card nutzt CSS-Variablen für dunkles Theme. Für helles Theme / Anpassung:

```yaml
todo-notifications-card:
  --primary-color: rgba(0, 0, 0, 0.15)
  --primary-border: rgba(0, 0, 0, 0.25)
  --primary-text: #000
  --secondary-text: rgba(0, 0, 0, 0.7)
```

## Debugging

1. **Browser-Console** (F12) — auf JS-Fehler prüfen
2. **HA Developer Tools** → Events → Nach `pq_todo_` filtern
3. **Lovelace-Konfiguration** → YAML-Konfiguration → raw-editor
4. **HA Logs** (settings → System → Logs)

## Lizenz

MIT

## Support

Fehler? → [GitHub Issues](https://github.com/pquandel2-alt/pq_todo_notifications_card/issues)
