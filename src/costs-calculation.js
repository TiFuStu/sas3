// Kostenberechnung Zustand
const costsState = {
  currentCase: null,
  currentUser: null,
  catalogItems: [],
  catalogData: {},
  otherCosts: 0,
  openClaimAmount: 0,
};

// DOM-Elemente
const costsElements = {
  caseNumberDisplay: document.getElementById("case-number-display"),
  backButton: document.getElementById("back-to-case"),
  catalogSelect: document.getElementById("catalog-select"),
  catalogMenge: document.getElementById("catalog-menge"),
  addCatalogBtn: document.getElementById("add-catalog-btn"),
  catalogTable: document.getElementById("catalog-table"),
  catalogItemsTbody: document.getElementById("catalog-items-tbody"),
  noCatalogItems: document.getElementById("no-catalog-items"),
  otherCostsInput: document.getElementById("other-costs"),
  openClaimAmountInput: document.getElementById("open-claim-amount"),
  sumCatalog: document.getElementById("sum-catalog"),
  sumOther: document.getElementById("sum-other"),
  sumOpen: document.getElementById("sum-open"),
  sumTotal: document.getElementById("sum-total"),
  progressContainer: document.getElementById("progress-container"),
  breakdownDetails: document.getElementById("breakdown-details"),
  costsCompleteInfo: document.getElementById("costs-complete-info"),
  statusMessage: document.getElementById("status-message"),
  resetCostsBtn: document.getElementById("reset-costs-btn"),
  saveCostsBtn: document.getElementById("save-costs-btn"),
};

// API Hilfsfunktion
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    window.location.href = "/";
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof body === "string" ? body : body.error || "Unbekannter Fehler";
    throw new Error(errorMessage);
  }

  return body;
}

// Nachricht anzeigen
function showMessage(message, type = "success") {
  costsElements.statusMessage.textContent = message;
  costsElements.statusMessage.className = `status-message ${type}`;
  setTimeout(() => {
    costsElements.statusMessage.className = "status-message";
  }, 3000);
}

// Katalog laden
async function loadCatalog() {
  try {
    const catalog = await apiFetch("/api/catalog");
    costsState.catalogData = {};
    catalog.forEach((item) => {
      costsState.catalogData[item.id] = item;
    });

    const select = costsElements.catalogSelect;
    select.innerHTML = '<option value="">-- Material/Leistung wählen --</option>';
    catalog.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.bezeichnung} (${item.satz.toFixed(2)} €/${item.einheit})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Katalog konnte nicht geladen werden", error);
    showMessage("Katalog konnte nicht geladen werden", "error");
  }
}

// Katalogposition hinzufügen
function addCatalogPosition() {
  const catalogId = costsElements.catalogSelect.value;
  const menge = parseFloat(costsElements.catalogMenge.value || 0);

  if (!catalogId) {
    showMessage("Bitte wählen Sie ein Material/eine Leistung aus", "error");
    return;
  }

  if (!menge || menge <= 0) {
    showMessage("Bitte geben Sie eine gültige Menge ein", "error");
    return;
  }

  const catalogItem = costsState.catalogData[catalogId];
  if (!catalogItem) {
    showMessage("Katalogposition nicht gefunden", "error");
    return;
  }

  const position = {
    id: `temp_${Date.now()}`,
    catalogId,
    bezeichnung: catalogItem.bezeichnung,
    einheit: catalogItem.einheit,
    menge,
    satz: catalogItem.satz,
    gesamtpreis: catalogItem.satz * menge,
  };

  costsState.catalogItems.push(position);
  renderCatalogItems();
  updateSummary();

  costsElements.catalogSelect.value = "";
  costsElements.catalogMenge.value = "1";
  showMessage(`Position "${catalogItem.bezeichnung}" hinzugefügt`, "success");
}

// Katalogposition entfernen
function removeCatalogPosition(posId) {
  costsState.catalogItems = costsState.catalogItems.filter(
    (item) => item.id !== posId
  );
  renderCatalogItems();
  updateSummary();
  showMessage("Position entfernt", "success");
}

// Katalogpositionen rendern
function renderCatalogItems() {
  const tbody = costsElements.catalogItemsTbody;
  tbody.innerHTML = "";

  if (costsState.catalogItems.length === 0) {
    costsElements.catalogTable.style.display = "none";
    costsElements.noCatalogItems.style.display = "block";
    return;
  }

  costsElements.catalogTable.style.display = "table";
  costsElements.noCatalogItems.style.display = "none";

  costsState.catalogItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.bezeichnung}</td>
      <td class="text-center">${item.einheit}</td>
      <td class="text-center">${item.menge.toFixed(2)}</td>
      <td class="text-right">${item.satz.toFixed(2)}€</td>
      <td class="text-right">${item.gesamtpreis.toFixed(2)}€</td>
      <td class="text-center">
        <button type="button" class="delete-btn" onclick="removeCatalogPosition('${item.id}')">Entfernen</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Zusammenfassung berechnen und aktualisieren
function updateSummary() {
  const catalogTotal = costsState.catalogItems.reduce(
    (sum, item) => sum + (item.gesamtpreis || 0),
    0
  );
  const otherCosts = parseFloat(costsElements.otherCostsInput.value || 0);
  const openClaimAmount = parseFloat(costsElements.openClaimAmountInput.value || 0);
  const total = catalogTotal + otherCosts + openClaimAmount;

  // Speichern im Zustand
  costsState.otherCosts = otherCosts;
  costsState.openClaimAmount = openClaimAmount;

  // Zahlen formatieren
  const formatCurrency = (value) => value.toFixed(2).replace(".", ",") + " €";

  // Zusammenfassung aktualisieren
  costsElements.sumCatalog.textContent = formatCurrency(catalogTotal);
  costsElements.sumOther.textContent = formatCurrency(otherCosts);
  costsElements.sumOpen.textContent = formatCurrency(openClaimAmount);
  costsElements.sumTotal.textContent = formatCurrency(total);

  // Kostenverteilung aktualisieren
  updateCostDistribution(catalogTotal, otherCosts, openClaimAmount, total);

  // Kostenvollständigkeit prüfen
  updateCostsCompleteStatus(total);
}

// Kostenverteilung visualisieren
function updateCostDistribution(catalog, other, open, total) {
  const container = costsElements.progressContainer;
  const detailsContainer = costsElements.breakdownDetails;

  if (total === 0) {
    container.innerHTML = '<div style="color: var(--lbm-gray-dark); font-style: italic;">Keine Kosten erfasst</div>';
    detailsContainer.innerHTML = "";
    return;
  }

  const catalogPercent = (catalog / total) * 100;
  const otherPercent = (other / total) * 100;
  const openPercent = (open / total) * 100;

  // Progress Bar
  let progressHtml = '<div class="progress-bar">';
  if (catalog > 0)
    progressHtml += `<div class="progress-segment segment-catalog" style="width: ${catalogPercent}%;">${catalogPercent.toFixed(0)}%</div>`;
  if (other > 0)
    progressHtml += `<div class="progress-segment segment-other" style="width: ${otherPercent}%;">${otherPercent.toFixed(0)}%</div>`;
  if (open > 0)
    progressHtml += `<div class="progress-segment segment-open" style="width: ${openPercent}%;">${openPercent.toFixed(0)}%</div>`;
  progressHtml += "</div>";
  container.innerHTML = progressHtml;

  // Details
  let detailsHtml = "";
  if (catalog > 0)
    detailsHtml += `<div class="breakdown-item"><span>🔷 Katalog-Positionen:</span> <strong>${catalog.toFixed(2).replace(".", ",")} € (${catalogPercent.toFixed(1)}%)</strong></div>`;
  if (other > 0)
    detailsHtml += `<div class="breakdown-item"><span>🔹 Sonstige Kosten:</span> <strong>${other.toFixed(2).replace(".", ",")} € (${otherPercent.toFixed(1)}%)</strong></div>`;
  if (open > 0)
    detailsHtml += `<div class="breakdown-item"><span>🔸 Offene Forderung:</span> <strong>${open.toFixed(2).replace(".", ",")} € (${openPercent.toFixed(1)}%)</strong></div>`;

  detailsContainer.innerHTML = detailsHtml;
}

// Kostenvollständigkeit-Status aktualisieren
function updateCostsCompleteStatus(total) {
  const element = costsElements.costsCompleteInfo;
  const requirements = [];
  let allMet = true;

  if (!costsState.currentCase?.responsibleParty?.trim()) {
    requirements.push("✗ Verursacher");
    allMet = false;
  } else {
    requirements.push("✓ Verursacher");
  }

  if (!costsState.currentCase?.insurance?.trim()) {
    requirements.push("✗ Versicherung");
    allMet = false;
  } else {
    requirements.push("✓ Versicherung");
  }

  if (!costsState.currentCase?.cashDesk?.trim()) {
    requirements.push("✗ Kasse");
    allMet = false;
  } else {
    requirements.push("✓ Kasse");
  }

  if (!costsState.currentCase?.street?.trim()) {
    requirements.push("✗ Unfallort");
    allMet = false;
  } else {
    requirements.push("✓ Unfallort");
  }

  if (!costsState.currentCase?.plateNumber?.trim()) {
    requirements.push("✗ Kennzeichen");
    allMet = false;
  } else {
    requirements.push("✓ Kennzeichen");
  }

  if (total <= 0) {
    requirements.push("✗ Kosten erfasst");
    allMet = false;
  } else {
    requirements.push("✓ Kosten erfasst");
  }

  const statusText = allMet
    ? "✓ Alle Voraussetzungen erfüllt. 'Kosten komplett erfasst' kann gesetzt werden."
    : "Es fehlen noch Voraussetzungen für 'Kosten komplett erfasst'.";

  element.innerHTML = `
    <div style="line-height: 1.6;">
      ${statusText}
      <div style="margin-top: 0.75rem; font-size: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
        ${requirements.map((req) => `<div>${req}</div>`).join("")}
      </div>
    </div>
  `;

  element.style.background = allMet ? "#d4edda" : "#fff3cd";
  element.style.color = allMet ? "#155724" : "#856404";
}

// Benutzer und Schadensfall laden
async function loadCurrentCase() {
  try {
    const user = await apiFetch("/api/me");
    costsState.currentUser = user;

    // Schadensfall-ID aus URL-Parametern
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get("caseId");

    if (!caseId) {
      showMessage("Keine Schadensfall-ID angegeben", "error");
      costsElements.backButton.style.display = "block";
      return;
    }

    // Schadensfall laden
    const damageCase = await apiFetch(`/api/damage-cases/${caseId}`);
    costsState.currentCase = damageCase;

    // UI aktualisieren
    costsElements.caseNumberDisplay.textContent =
      damageCase.caseNumber || caseId;
    costsElements.backButton.href = `/create-damage-case?caseId=${caseId}`;

    // Kosten aus Schadensfall laden
    costsElements.otherCostsInput.value = (damageCase.otherCosts || 0).toFixed(2);
    costsElements.openClaimAmountInput.value = (
      damageCase.openClaimAmount || 0
    ).toFixed(2);

    // Katalogpositionen laden
    const positions = await apiFetch(
      `/api/damage-cases/${caseId}/catalog-items`
    );
    if (Array.isArray(positions)) {
      costsState.catalogItems = positions.map((item) => ({
        id: item.id,
        catalogId: item.catalogId,
        bezeichnung: item.bezeichnung,
        einheit: item.einheit,
        menge: item.menge,
        satz: item.satz,
        gesamtpreis: item.gesamtpreis,
      }));
    }

    renderCatalogItems();
    updateSummary();
  } catch (error) {
    console.error("Fehler beim Laden des Schadenfalls", error);
    showMessage("Fehler beim Laden des Schadenfalls", "error");
  }
}

// Kosten speichern
async function saveCosts() {
  try {
    const caseId = new URLSearchParams(window.location.search).get("caseId");
    if (!caseId) {
      showMessage("Keine Schadensfall-ID angegeben", "error");
      return;
    }

    // Katalogpositionen speichern (Hinzufügen neuer Positionen)
    for (const item of costsState.catalogItems) {
      if (item.id.startsWith("temp_")) {
        // Neue Position hinzufügen
        await apiFetch(`/api/damage-cases/${caseId}/catalog-items`, {
          method: "POST",
          body: JSON.stringify({
            catalogId: item.catalogId,
            menge: item.menge,
          }),
        });
      }
    }

    // Schadensfall mit Kosteninfo aktualisieren
    const catalogTotal = costsState.catalogItems.reduce(
      (sum, item) => sum + (item.gesamtpreis || 0),
      0
    );

    await apiFetch(`/api/damage-cases/${caseId}`, {
      method: "PUT",
      body: JSON.stringify({
        otherCosts: costsState.otherCosts,
        openClaimAmount: costsState.openClaimAmount,
        catalogTotal: catalogTotal,
        catalogItemCount: costsState.catalogItems.length,
      }),
    });

    showMessage("Kosten erfolgreich gespeichert", "success");

    // Nach 1 Sekunde zurück zum Schadensfall
    setTimeout(() => {
      window.location.href = `/create-damage-case?caseId=${caseId}`;
    }, 1000);
  } catch (error) {
    console.error("Fehler beim Speichern der Kosten", error);
    showMessage("Fehler beim Speichern der Kosten", "error");
  }
}

// Kosten zurücksetzen
function resetCosts() {
  if (
    confirm(
      "Sind Sie sicher, dass Sie alle Eingaben zurücksetzen möchten?"
    )
  ) {
    costsState.catalogItems = [];
    costsElements.otherCostsInput.value = "0.00";
    costsElements.openClaimAmountInput.value = "0.00";
    renderCatalogItems();
    updateSummary();
    showMessage("Kosten zurückgesetzt", "success");
  }
}

// Event Listener
costsElements.addCatalogBtn.addEventListener("click", addCatalogPosition);
costsElements.otherCostsInput.addEventListener("input", updateSummary);
costsElements.openClaimAmountInput.addEventListener("input", updateSummary);
costsElements.resetCostsBtn.addEventListener("click", resetCosts);
costsElements.saveCostsBtn.addEventListener("click", saveCosts);

// Katalog-Select auf Enter
costsElements.catalogMenge.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addCatalogPosition();
  }
});

// Initialisierung
async function init() {
  try {
    await loadCatalog();
    await loadCurrentCase();
  } catch (error) {
    console.error("Initialisierungsfehler", error);
    showMessage("Fehler beim Laden der Anwendung", "error");
  }
}

// Seite laden
window.addEventListener("DOMContentLoaded", init);
