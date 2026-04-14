# Anwenderdokumentation SaS3

## 1. Zweck der Anwendung
SaS3 unterstützt die Erfassung, Bearbeitung und den Abschluss von Schadensfällen an Straßeneinrichtungen.

Die Anwendung bietet:
- Anmeldung mit Active Directory oder Dummy-Benutzer (je nach Umgebung)
- Übersicht über eigene, dienststellenbezogene oder alle sichtbaren Fälle
- Erfassung und Bearbeitung von Schadensfällen
- Kataloggestützte Kostenverwaltung
- Verwaltung von Versicherungs- und Kassenstammdaten
- Rechteverwaltung und Datenbank-Konfiguration (nur berechtigte Benutzer)

## 2. Rollen und Berechtigungen
Welche Funktionen sichtbar sind, hängt von Ihrer Rolle ab.

Typische Unterschiede:
- Erfasser: eigene Fälle anlegen und bearbeiten
- Bearbeiter/Team: Teamfälle bearbeiten, ggf. an Leitung weiterleiten
- Leitung: freigabepflichtige Fälle prüfen und abschließen
- Admin: zusätzliche Administrationsseiten (Rechteverwaltung, DB-Konfiguration)

Hinweis:
Nicht jeder Benutzer sieht alle Schaltflächen. Fehlende Buttons sind in der Regel berechtigungsbedingt.

## 3. Anmeldung
### 3.1 Aufruf
1. Öffnen Sie die Anmeldeseite der Anwendung.
2. Wählen Sie eine der zwei Anmeldearten:
   - Active Directory: Benutzername + Passwort
   - Dummy-Benutzer: Auswahl aus der Liste (Test/Schulung)

### 3.2 Benutzername für AD
Folgende Formate sind möglich:
- vorname.nachname
- DOMAIN\\benutzer
- benutzer@domain

### 3.3 Nach erfolgreicher Anmeldung
Sie werden automatisch zur Übersicht weitergeleitet.

## 4. Startseite: Fälle-Übersicht
Die Übersicht ist Ihre zentrale Arbeitsseite.

Elemente:
- Filter für Sichtbereich: Meine Fälle, Dienststelle, Alle Fälle (rollenabhängig)
- Tabelle mit Fallnummer, Betreff, Dienststelle, Ersteller, Datum, Status
- Schaltfläche Neuer Fall (nur mit entsprechender Berechtigung)
- Links zu Katalogen, Rechteverwaltung, Datenbank-Konfiguration (rollenabhängig)

Typischer Ablauf:
1. Sichtbereich auswählen.
2. Fall in der Tabelle anklicken, um Details zu öffnen.
3. Oder Neuen Fall anlegen.

## 5. Schadensfall anlegen und bearbeiten
## 5.1 Neuen Fall starten
1. In der Übersicht auf Neuer Fall klicken.
2. Die Anwendung reserviert eine Fallnummer.
3. Formular ausfüllen und speichern.

## 5.2 Wichtige Eingabebereiche
- Allgemeines: Betreff, Datum, Beschreibung
- Unfall-/Ortsdaten: Straße, Abschnitt, Richtung, km-Angabe
- Verursacherdaten: Name, Kennzeichen, Adresse
- Versicherungs- und Rechnungsdaten
- Kostenangaben: Katalogpositionen, sonstige Kosten, offene Forderung

## 5.3 Automatische Unterstützungen
- Kennzeichen-Lookup kann Versicherungs- und Zulassungsdaten ergänzen.
- Straßen-Lookup kann die Dienststelle/Region unterstützen.
- Adressprüfung unterstützt bei der Verursacheradresse.

Wichtig:
Wenn die Adresse nicht als gültig erkannt wird, kann der Fall nicht mit ungültiger Adresse gespeichert werden.

## 5.4 Rechnungsempfänger
Wählbare Empfängerarten:
- Verursacher
- Versicherung
- Andere Stelle

Bei Andere Stelle müssen die Kontaktdaten vollständig ausgefüllt sein.

## 5.5 Kosten komplett erfasst
Die Option Kosten komplett erfasst kann erst gesetzt werden, wenn alle Voraussetzungen erfüllt sind, insbesondere:
- Verursacher vorhanden
- gültige Verursacheradresse
- Versicherung gesetzt
- Kasse gesetzt
- Unfallort gesetzt
- Kennzeichen gesetzt
- mindestens eine Kostenbasis vorhanden (Katalogsumme, sonstige Kosten oder offene Forderung)

## 5.6 Speichern
1. Auf Speichern klicken.
2. Bei Erfolg erscheint eine Bestätigung.
3. Der Fall wird in der Liste aktualisiert.

## 6. Workflow: Weiterleiten und Freigeben
Je nach Rolle und Status stehen zusätzliche Aktionen zur Verfügung.

- An Leitung weiterleiten:
  - sichtbar für berechtigte Bearbeiter
  - typischerweise bei Status Team

- Prüfen & Freigeben:
  - sichtbar für berechtigte Leitung
  - typischerweise bei Status Leitung

Nach Aktion wird der Fallstatus entsprechend fortgeschrieben.

## 7. Kataloge bedienen
## 7.1 Kosten-Katalog
Zweck:
Pflege von Material-/Leistungspositionen mit Satz, Einheit, Kategorie und Aktiv-Status.

Typische Aktionen:
- neue Position anlegen
- bestehende Position bearbeiten
- Position deaktivieren/löschen

## 7.2 Versicherungs-Katalog
Zweck:
Pflege von Versicherungsstammdaten für die Fallbearbeitung.

Typische Aktionen:
- Eintrag anlegen
- Eintrag bearbeiten
- Aktiv/Inaktiv schalten
- über Suche filtern

## 7.3 Kassen-Katalog
Zweck:
Pflege der verfügbaren Kassen, aus denen im Fall ausgewählt wird.

Typische Aktionen:
- Kasse hinzufügen
- Kasse bearbeiten
- Kasse aktivieren/deaktivieren

## 8. Rechteverwaltung (Admin)
In der Rechteverwaltung können AD-Gruppen internen Rollen zugeordnet werden.

Ablauf:
1. Gruppen-/Rollen-Zuordnung hinzufügen oder bearbeiten.
2. Ungültige/alte Zuordnung entfernen.
3. Zuordnungen speichern.

Zusätzlich wird eine Benutzerliste mit Rollen angezeigt.

## 9. Datenbank-Konfiguration (Admin)
Hier werden Verbindungen für zwei Umgebungen gepflegt:
- Produktiv-Datenbank
- Dummy-Datenbank

Ablauf je Bereich:
1. Host, Port, Datenbankname, Benutzer, Passwort eintragen.
2. Verbindung testen.
3. Konfiguration speichern.

Hinweis:
Fehlermeldungen beim Test weisen meist auf Netzwerk, Zugangsdaten oder Erreichbarkeit des DB-Servers hin.

## 10. Abmelden
Über Abmelden in der Kopfzeile wird die Sitzung beendet und zur Anmeldeseite zurückgeleitet.

## 11. Häufige Probleme und Lösungen
### Problem: Anmeldung fehlgeschlagen
- Benutzernameformat prüfen
- Passwort prüfen
- AD-Erreichbarkeit prüfen

### Problem: Speichern nicht möglich
- Pflichtfelder prüfen
- Rechnungsempfänger vollständig ausfüllen
- Verursacheradresse mit gültigem Vorschlag übernehmen

### Problem: Schaltfläche fehlt
- Berechtigung/Rolle prüfen
- Fallstatus prüfen (z. B. Weiterleiten/Freigeben)

### Problem: Keine Fälle sichtbar
- Filterbereich prüfen (Eigene/Dienststelle/Alle)
- prüfen, ob Fälle im gewählten Bereich vorhanden sind

## 12. Funktionsumfang aktuell
Im aktuellen Stand noch nicht umgesetzt:
- Dateiupload für Beweisdaten
- SAP-Schnittstelle für automatisierte Übergaben

Diese Punkte sind als nächste Ausbaustufe vorgesehen.
