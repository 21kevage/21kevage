# PRISMA

PRISMA ist eine mobile Progressive Web App: ein abstraktes Gesicht im Stil alter Musik-Visualisierungen, das auf Mikrofon und Sprach-Ausgabe reagiert.

## Was bereits funktioniert

- Vollbild-Visualizer mit einem erkennbaren Gesicht aus Neon-Partikeln, Equalizer-Balken und Wellen.
- Reaktion auf das Mikrofon im Visualizer-Modus.
- Installierbar auf Android über Chrome oder Samsung Internet.
- Vorbereitung für ein echtes Sprachgespräch über OpenAI Realtime und WebRTC.
- Der OpenAI-Schlüssel liegt ausschließlich in der Server-Umgebung, nie auf dem Handy.

## Für das erste Handy-Testen

1. Die Dateien auf Cloudflare Pages hochladen oder aus einem GitHub-Repository bereitstellen.
2. Die Seite auf dem Android-Handy in Chrome öffnen.
3. Im Browser-Menü **Zum Startbildschirm hinzufügen** wählen.
4. PRISMA starten und den Mikrofonzugriff erlauben.

Ohne die unten beschriebene Server-Variable funktioniert PRISMA als reiner Mikrofon-Visualizer.

## Echte Sprachgespräche aktivieren

Die Datei `functions/api/realtime-call.js` ist eine Cloudflare-Pages-Function. Beim Deployment wird sie automatisch als `/api/realtime-call` bereitgestellt.

In Cloudflare Pages folgende Umgebungsvariable als Secret hinterlegen:

```
OPENAI_API_KEY=<dein OpenAI API Key>
```

Optional:

```
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_VOICE=marin
PRISMA_INSTRUCTIONS=Deine eigene Systemanweisung
```

Die App schickt nur das WebRTC-Angebot und eine zufällig erzeugte lokale Kennung an die Function. Die Function erstellt die Verbindung zu OpenAI und gibt die WebRTC-Antwort zurück. Der API-Schlüssel gelangt dadurch nie in die PWA.

## Lokale Prüfung

```
npm run check
python3 -m http.server 4173
```

Danach `http://localhost:4173` öffnen. Der lokale Webserver kann die Cloudflare-Function nicht ausführen, deshalb startet dort nur der Visualizer-Modus.

## Android-Sideload

Im Unterordner `android` liegt der native Android-Container. Er lädt die PRISMA-Oberfläche aus der APK und fragt das Mikrofon erst beim Start eines Gesprächs an.

Die fertige Test-APK ist mit einer Android-Debug-Signatur versehen und läuft ab Android 8. Für die spätere Echtzeit-Verbindung kann in der Info-Ansicht der APK die HTTPS-Adresse der Cloudflare-Function gespeichert werden. Der OpenAI-Schlüssel wird dabei nie in der APK gespeichert.

## Wichtige Grenze

PRISMA nutzt einen eigenen API-Assistenten. Es kann eine gewünschte Persönlichkeit und gespeicherte Notizen bekommen, aber nicht automatisch die private Erinnerung oder den Verlauf eines bestehenden ChatGPT-Chats übernehmen.
