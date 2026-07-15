# 21Kevage Webseiten-Service

Landingpage für den Webseiten-Service von 21Kevage.

## Geplante URL

`https://21kevage.com/webseiten-service/`

## Struktur

- `index.html` – Landingpage
- `assets/images/` – Hero- und Projektgrafiken
- `assets/css/` – ausgelagerte Stylesheets bei späterem Ausbau
- `assets/js/` – JavaScript und spätere Interaktionen
- `functions/api/contact.js` – optionale Cloudflare-Pages-Function für das Kontaktformular

## Hero-Grafik

Vorgesehener Dateiname:

`assets/images/hero-21kevage-architecture-v2.webp`

Empfohlene HTML-Einbindung:

```html
<img
  src="assets/images/hero-21kevage-architecture-v2.webp"
  alt="21 Kevage Webdesign mit einer modernen Beispielwebseite für das fiktive Muster Architekturbüro"
  width="1536"
  height="1024"
  fetchpriority="high"
  decoding="async">
```

## Deployment

Die Landingpage kann bei Cloudflare Pages direkt aus dem Repository veröffentlicht werden. Als Root-Verzeichnis kann je nach gewünschtem Aufbau entweder das Repository oder `webseiten-service` verwendet werden.

Die Arbeiten erfolgen zunächst auf dem Branch `feature/landingpage-v2` und werden erst nach Prüfung in `main` übernommen.
