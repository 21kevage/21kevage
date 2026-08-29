# zeigdich.

Unternehmenswebsite für den Webseitenservice von 21 Kevage.

## Betrieb

Die Website wird als statische Seite über Cloudflare Pages ausgeliefert. Das Kontaktformular läuft als Cloudflare Pages Function und versendet Anfragen über Resend.

Für das Kontaktformular werden folgende Umgebungsvariablen benötigt:

| Variable | Pflicht | Zweck |
| --- | --- | --- |
| `RESEND_API_KEY` | Ja | API-Schlüssel für Resend |
| `CONTACT_TO` | Nein | Empfängeradresse, Standard ist `kontakt@21kevage.com` |
| `CONTACT_FROM` | Nein | Verifizierte Absenderadresse, Standard ist `zeigdich. <kontakt@mail.21kevage.com>` |

Geheimnisse dürfen nicht im Repository gespeichert werden.

## Releaseprüfung

1. Cloudflare Pages baut aus dem Repository-Stammverzeichnis.
2. `RESEND_API_KEY` ist in Produktion gesetzt.
3. Die Domain `mail.21kevage.com` ist bei Resend verifiziert.
4. Startseite, Kontaktformular, Danke-Seite, Impressum und Datenschutz wurden geprüft.
5. Die drei externen Referenzlinks sind erreichbar.
