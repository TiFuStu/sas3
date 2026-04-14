# Glossar

| Begriff | Erklärung | Kontext in der Dokumentation |
|---|---|---|
| SaS2 | Bestehende Altanwendung zur Schadenserfassung, die abgelöst werden soll | Projektbeschreibung, Ist-Analyse |
| SaS3 | Neue Webanwendung als Nachfolger für SaS2 | Projektziel, Soll-Konzept |
| Fachinformatiker für Anwendungsentwicklung | IT-Ausbildungsberuf mit Schwerpunkt Softwareentwicklung | Deckblatt, Einleitung |
| LBM | Landesbetrieb Mobilität Rheinland-Pfalz (Auftraggeber/Umfeld) | Projektumfeld |
| MWVLW | Zuständiges Ministerium über dem LBM | Projektumfeld |
| WSL-Ubuntu | Linux-Entwicklungsumgebung unter Windows Subsystem for Linux | Projektbetreuung und Entwicklungsumgebung |
| Active Directory (AD) | Microsoft-Verzeichnisdienst für Benutzer und Gruppen | Anforderungen, Login, Testphase |
| Authentifizierung | Prüfung von Benutzeridentität (z. B. Login mit Passwort) | Anforderungen, technische Umsetzung |
| Berechtigungssteuerung | Vergabe und Prüfung von Zugriffsrechten je Benutzer/Gruppe | Technische Umsetzung 3.7.2 |
| Gruppenmitgliedschaft | Mitgliedschaft in AD-Gruppen als Grundlage für Rollen/Rechte | Anforderungen, Login, Soll-Ist-Vergleich |
| Rechteprüfung | Fachliche/technische Prüfung, ob eine Aktion erlaubt ist | Login, Testphase, Soll-Ist-Vergleich |
| Webbasierte Anwendung | Anwendung, die über Browser im Netz genutzt wird | Anforderungen, Soll-Konzept |
| Corporate Design | Einheitliche visuelle Gestaltungsrichtlinien der Organisation | Anforderungen, Umsetzung |
| Workflow | Definierter fachlicher Ablauf eines Schadensfalls | Projektziel, technische Umsetzung |
| Statuslogik | Regelwerk für erlaubte Statuswechsel von Fällen | Technische Umsetzung 3.7.3 |
| Schadensfall | Zentrale fachliche Einheit der Anwendung (ein erfasster Schaden) | Gesamte Projektdurchführung |
| Fallanlage | Erfassung und Anlage eines neuen Schadensfalls | Projektziel, Testphase |
| Schadensfallnummer | Eindeutige Kennung eines Falls im Format YYXXXX | Entwicklung 3.3, Testphase |
| Katalogfunktion | Verwaltung und Nutzung von Kostenpositionen im Katalog | Umsetzung 3.4, 3.7.5 |
| Versicherungskatalog | Strukturierte Versicherungsdaten für die Fallbearbeitung | 3.7.5, Soll-Ist-Vergleich |
| Kassenkatalog | Strukturierte Kassendaten für die Bearbeitung/Abrechnung | 3.7.5, Soll-Ist-Vergleich |
| Kostenberechnung | Summierung/Ermittlung von Fallkosten aus Positionen, Menge und Satz | 3.7.5, Testphase |
| Vier-Augen-Prinzip | Freigabeprinzip mit zusätzlicher Prüfung durch zweite Person/Funktion | Ist-Analyse |
| Dummy-Benutzer | Testkonten für reproduzierbare Rechte- und Funktionstests | Login-Umsetzung, Testphase |
| Prozessorientiertes Testvorgehen | Tests entlang des gesamten End-to-End-Ablaufs | Erweiterte Testbetrachtung 4.6.1 |
| Positivtest | Test eines erwarteten gültigen Ablaufs | Erweiterte Testbetrachtung 4.6.1 |
| Fehlerszenario | Testfall für ungültige oder störungsbehaftete Situationen | Erweiterte Testbetrachtung 4.6.1 |
| Regressionstest | Wiederholungstest nach Korrekturen zur Stabilitätssicherung | 4.6.2 |
| Datenkonsistenz | Widerspruchsfreie und regelkonforme Datenhaltung | Risikobetrachtung, 4.6.2 |
| Feldabhängigkeit | Regel, bei der die Gültigkeit eines Feldes von anderen Feldern abhängt | 4.6.2 |
| Sperrlogik | Mechanismus, der Felder nach bestimmten Statuswerten sperrt | 4.6.2 |
| Schichtenmodell | Architekturmuster mit Trennung von UI, Serverlogik und Datenzugriff | 3.7.1 |
| Serverlogik | Zentrale fachliche Verarbeitung auf dem Server | 3.7.1 |
| Gekapselter Datenzugriff | Abgeschirmter DB-Zugriff über definierte Schicht | 3.7.1 |
| Referenzabfrage | Externe oder interne Datenabfrage zur Unterstützung der Eingabe | 3.7.4 |
| Dateiupload | Hochladen von Beweisdateien als fachliche Anforderung | Anforderungen, Grenzen 3.7.6 |
| Revisionssichere Ablage | Manipulationssichere, nachvollziehbare Aufbewahrung von Daten/Dateien | 3.6, 5.4 |
| Aufbewahrungsfrist | Gesetzlich definierter Zeitraum für Datenaufbewahrung | 3.6 |
| SAP-Schnittstelle | Technische Anbindung an SAP für Übergabe und Rückmeldungen | Anforderungen, 3.7.6, Ausblick |
| Zahlungseingang | Eingang und Verbuchung eingehender Zahlungen | Anforderungen, Ist-Analyse |
| Iterative Vorgehensweise | Entwicklung in wiederholten Schritten mit frühem Testen | Fazit 5.3 |
| Wasserfallmodell | Planungsmodell mit strukturierten Phasen | Zeitplanung 2.6 |
| Risikomanagement | Erkennung, Bewertung und Gegensteuerung von Projektrisiken | Projektplanung 2.7 |
| Muss-/Soll-/Kann-Anforderungen | Priorisierungsmodell für Anforderungen nach Wichtigkeit | Projektplanung 2.6 |
| Integrationsanforderung | Anforderung mit Anbindung an externe Systeme/Prozesse | Projektplanung, 3.7.6 |
| Meilenstein-Reporting | Regelmäßige Fortschrittsdokumentation je Projektmeilenstein | 5.5 |
| Definition of Done | Klare Kriterien, wann eine Aufgabe fachlich/technisch abgeschlossen ist | 5.5 |
| Betriebsreife | Eignung einer Funktion für den stabilen produktiven Betrieb | 5.5 |
| Abnahmekriterium | Vorab definierte Kriterien für formale fachliche Freigabe | 5.4 |
