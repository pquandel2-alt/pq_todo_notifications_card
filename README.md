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
        entity: todo.meine_liste                    # Erforderlich
        title: "Einkaufsliste"                       # Optional
        notify_services:                             # Optional - Notifications an diese Services
          - mobile_app_iphone
          - mobile_app_ipad
        notify_added_title: "📋 Neue Aufgabe"       # Optional - Titel für "hinzugefügt"
        notify_added_message: "{{ item }} hinzugefügt"
        notify_completed_title: "✅ Erledigt"       # Optional - Titel für "erledigt"
        notify_completed_message: "{{ item }} ist erledigt"
```

### UI Editor

1. Dashboard → Card hinzufügen → "Todo Notifications Card"
2. **Todo Entity:** Wähle deine Todo-Liste (z.B. `todo.meine_liste`)
3. **Titel:** Optional (default: "Todo Liste")
4. **Benachrichtigungs-Services:** Komma-separiert:
   - `mobile_app_iphone, mobile_app_ipad`
   - Oder nur `mobile_app_handy` für ein Gerät
   - Namen findest du in HA Settings → Devices & Services → Mobile App

## Funktionsweise

Die Card erkennt automatisch, wenn:
- ➕ Ein neues Item hinzugefügt wird → sendet Notification mit `notify_added_title` + `notify_added_message`
- ✅ Ein Item als "erledigt" markiert wird → sendet Notification mit `notify_completed_title` + `notify_completed_message`

### Template-Variablen

In den Nachrichten-Texten:
- **`{{ item }}`** wird durch den Item-Text ersetzt

Beispiel:
```yaml
notify_added_message: "{{ item }} hinzugefügt"
# → "Milch kaufen hinzugefügt"

notify_completed_message: "✅ Du hast '{{ item }}' erledigt!"
# → "✅ Du hast 'Milch kaufen' erledigt!"
```

## ⚠️ Wichtig: Notifications nur wenn Card offen ist

Die Notifications werden von der **Card im Browser** versendet (Client-Side). Das bedeutet:
- ✅ Notifications kommen wenn die Card auf einem Dashboard geladen ist
- ❌ KEINE Notifications wenn kein Dashboard offen ist (auch nicht per Handy-App im Hintergrund)

**Für 24/7-Benachrichtigungen:** Erstelle zusätzlich eine HA-Automation mit
einem Template Sensor, der die Todo-Änderungen verfolgt. Dies ist jedoch komplexer
und braucht externe Tooling (z.B. AppDaemon, Node-RED).

**Die Card ist ideal für Echtzeit-Notifications im Home-Netzwerk** (wenn jemand
gerade am Dashboard ist).

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
