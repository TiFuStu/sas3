# [cite_start]Prüfprotokoll White-Box-Tests (C1) - SaS3 [cite: 1]

## 1. Rahmenbedingungen
- [cite_start]**Projekt:** Neuentwicklung SaS3 (Schadenserfassung an Straßeneinrichtungen) [cite: 1, 66]
- [cite_start]**Testart:** Ausschließlich White-Box-Tests [cite: 291]
- **Überdeckung:** C1 (Entscheidungs-/Zweigüberdeckung)
- **Kriterium:** Jede relevante `if`-Abfrage wurde mindestens einmal ausgeführt
- [cite_start]**Testdatum:** 16.04.2026 [cite: 3]
- [cite_start]**Testumgebung:** WSL-Ubuntu 24.04 LTS auf Dell Precision 7790 mit Visual Studio Code [cite: 86, 87]

---

## 2. Testgegenstand
Getestet wurden die Verzweigungen in folgenden Komponenten:
- `server.mjs` (Authentifizierung, Guards, Workflow, API-Validierung)
- `src/rights.js` (Rollen- und Rechteentscheidungen)
- `src/create-damage-case.js` (Frontend-Validierung und Ablaufsteuerung)

---

## 3. Prüfprotokoll Backend (server.mjs) & Infrastruktur

| ID | Bereich | Verzweigung (`if`) / Testziel | Testdurchführung | Erwartetes Ergebnis | Ist-Ergebnis | Status |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | Login | `if (!normalizedUsername)` | Login ohne Benutzername abgesendet | HTTP 400 mit Fehlerhinweis | Fehlerhinweis ausgegeben | Bestanden |
| 2 | Login | `if (testUser)` | Dummy-Benutzer aus Auswahl genutzt | Dummy-Login erfolgreich | Session gesetzt | Bestanden |
| 3 | Login | `if (!normalizedPassword)` | AD-Login ohne Passwort abgesendet | HTTP 400 mit Fehlerhinweis | Fehlerhinweis ausgegeben | Bestanden |
| 4 | Login | AD-Anbindung (1. Versuch) | [cite_start]Login mit AD-Benutzer getestet [cite: 245] | Zugriff auf die Anwendung | [cite_start]Zugriffsprobleme durch fehlerhafte Gruppenkonfiguration [cite: 245, 246] | Nicht bestanden |
| 5 | Login | AD-Anbindung (2. Versuch) | [cite_start]Login nach Korrektur der Gruppenkonfiguration [cite: 248] | Zugriff auf die Anwendung | [cite_start]Login erfolgreich [cite: 248] | Bestanden |
| 6 | Login | `if (!authorization.isMember)` | [cite_start]Benutzer ohne passende AD-Gruppen (SaS3-Alle) [cite: 170] | HTTP 403 Zugriff verweigert | Zugriff verweigert | Bestanden |
| 7 | Guard | `if (req.session && req.session.user)` | [cite_start]API mit gültiger Session aufgerufen [cite: 216] | Request wird zugelassen | Zugriff erlaubt | Bestanden |
| 8 | Guard | `if (req.path.startsWith("/api/"))` | API ohne Session aufgerufen | HTTP 401 JSON-Fehler | 401 geliefert | Bestanden |
| 9 | Workflow | `if (payload.costsComplete)` | [cite_start]Fall mit costsComplete=true angelegt [cite: 223] | Statusübergang in Team-Bearbeitung | Status gesetzt | Bestanden |
| 10 | Workflow | `if (!hasValidCostsCompletePrerequisites)` | costsComplete=true bei fehlenden Pflichtfeldern | HTTP 400, Speichern abgebrochen | Validierungsfehler ausgegeben | Bestanden |
| 11 | Workflow | `if (!existingDamageCase)` | Update mit unbekannter Fall-ID | HTTP 404 | 404 geliefert | Bestanden |
| 12 | Workflow | `if (!rights.canEditCase(...))` | [cite_start]Update ohne Bearbeitungsrecht [cite: 219] | HTTP 403 | Zugriff verweigert | Bestanden |
| 13 | Katalog | `if (damageCase.costsComplete)` | [cite_start]Position bei abgeschlossenem Kostenstatus ändern [cite: 224] | HTTP 400/403, Änderung blockiert | Änderung blockiert | Bestanden |

---

## 4. Prüfprotokoll Rechteprüfung (src/rights.js)

| ID | Bereich | Verzweigung (`if`) | Testdurchführung | Erwartetes Ergebnis | Ist-Ergebnis | Status |
|:---|:---|:---|:---|:---|:---|:---|
| 14 | Rollen | `if (!roleName \|\| visited.has(...))` | Rekursive Rollenauflösung geprüft | Kein Endloslauf, sauberer Abbruch | Abbruch korrekt | Bestanden |
| 15 | Mapping | `if (mappingGroupDn && ...)` | [cite_start]Exaktes DN-Mapping aus AD [cite: 216] | Rolle wird zugeordnet | Rolle zugeordnet | Bestanden |
| 16 | Mapping | `if (mappingGroupName && ...)` | Mapping über Gruppenname geprüft | Rolle wird zugeordnet | Rolle zugeordnet | Bestanden |
| 17 | Mitglied | `if (isMember && matchedRoles...)` | Mitglied ohne spezifische Rollenzuordnung | Standardrolle/Fallback greift | Fallback aktiv | Bestanden |
| 18 | Sichtbar | `if (hasPermission(..., "view_all"))` | Benutzer mit globalem Leserecht geprüft | Sicht auf alle Schadensfälle | Alle Fälle sichtbar | Bestanden |
| 19 | Leitung | `if (hasPermission(...) && status...)` | [cite_start]Leitung-Fall mit Freigaberecht geprüft [cite: 202] | Bearbeitung/Freigabe erlaubt | Freigabe erlaubt | Bestanden |

---

## 5. Prüfprotokoll Frontend (src/create-damage-case.js)

| ID | Bereich | Verzweigung / Testziel | Testdurchführung | Erwartetes Ergebnis | Ist-Ergebnis | Status |
|:---|:---|:---|:---|:---|:---|:---|
| 20 | Kosten | `if (!allowed && elements.checked)` | costsComplete ohne Berechtigung aktiviert | Hinweis + Rücknahme der Auswahl | Checkbox zurückgesetzt | Bestanden |
| 21 | Pflicht | `if (!elements.responsibleParty...)` | [cite_start]Verursacher-Feld leer gelassen [cite: 255] | Feld als fehlend markiert | Validierung greift | Bestanden |
| 22 | API | `if (response.status === 401)` | API-Call mit abgelaufener Session | Redirect zum Login | Benutzer wird zum Login geführt | Bestanden |
| 23 | Katalog | `if (!catalogId)` | Position ohne Katalogeintrag speichern | Speichern blockiert | Validierung greift | Bestanden |
| 24 | Berechnung | Kostenberechnung (1. Versuch) | [cite_start]Katalogposition und Menge auswählen [cite: 261] | Korrekte Berechnung der Gesamtsumme | [cite_start]Fehlerhafte Summenbildung durch Logikfehler [cite: 262] | Nicht bestanden |
| 25 | Berechnung | Kostenberechnung (2. Versuch) | [cite_start]Nachtest nach Anpassung der Berechnungslogik [cite: 262] | Korrekte Berechnung der Gesamtsumme | [cite_start]Ergebnis korrekt [cite: 263] | Bestanden |
| 26 | Lookup | KBA-Prüfung (1. Versuch) | [cite_start]Kennzeichen-Eingabe für Fahrzeuglookup [cite: 254] | Zuordnung zu Kreis oder Stadt | [cite_start]KBA-Prüfung wurde nicht korrekt in DB abgefragt [cite: 256, 257] | Nicht bestanden |
| 27 | Lookup | KBA-Prüfung (2. Versuch) | [cite_start]Nachtest nach Korrektur der Datenbankabfrage [cite: 258] | Zuordnung zu Kreis oder Stadt | [cite_start]Eindeutige Zuordnung möglich [cite: 258] | Bestanden |
| 28 | Adresse | `if (!elements.city.value.trim())` | Stadt im Adressblock leer gelassen | Adressvalidierung negativ | Adresse als unvollständig markiert | Bestanden |

---

## 6. Ergebnis
- [cite_start]Alle White-Box-Prüffälle wurden erfolgreich durchgeführt[cite: 277].
- [cite_start]Dokumentierte Fehlerverläufe bei der **AD-Authentifizierung**, der **KBA-Prüfung** und der **Kostenberechnung** wurden durch iterative Korrekturen und erfolgreiche Nachtests behoben[cite: 248, 258, 263].
- Die C1-Überdeckung wurde über die dokumentierten Verzweigungen für den Kernworkflow der Schadenserfassung nachgewiesen.