const state = {
  currentUser: null,
  currentCase: null,
  cases: [],
  appliedScope: "own",
  catalogItems: [],
  catalogData: {},
  insuranceCatalog: [],
  insuranceCatalogById: {},
  selectedInsuranceId: "",
  cashDeskCatalog: [],
  responsiblePartyAddressValid: true,
  responsiblePartyAddressLookupTimer: null,
  responsiblePartyAddressSuggestions: [],
};

const elements = {
  caseListBody: document.getElementById("case-list-body"),
  scopeFilter: document.getElementById("scope-filter"),
  refreshList: document.getElementById("refresh-list"),
  newCase: document.getElementById("new-case"),
  saveCase: document.getElementById("save-case"),
  userChip: document.getElementById("user-chip"),
  scopeChip: document.getElementById("scope-chip"),
  editChip: document.getElementById("edit-chip"),
  pageMessage: document.getElementById("page-message"),
  caseId: document.getElementById("case-id"),
  caseNumber: document.getElementById("case-number"),
  status: document.getElementById("status"),
  subject: document.getElementById("subject"),
  damageDate: document.getElementById("damage-date"),
  sapDebitor: document.getElementById("sap-debitor"),
  sapNumber: document.getElementById("sap-number"),
  description: document.getElementById("description"),
  recordingOffice: document.getElementById("recording-office"),
  policeStation: document.getElementById("police-station"),
  policeDiaryNumber: document.getElementById("police-diary-number"),
  street: document.getElementById("street"),
  district: document.getElementById("district"),
  sectionFrom: document.getElementById("section-from"),
  sectionTo: document.getElementById("section-to"),
  direction: document.getElementById("direction"),
  kmStation: document.getElementById("km-station"),
  plateNumber: document.getElementById("plate-number"),
  registrationOffice: document.getElementById("registration-office"),
  responsibleParty: document.getElementById("responsible-party"),
  responsiblePartyAddress: document.getElementById("responsible-party-address"),
  responsiblePartyPostalCode: document.getElementById(
    "responsible-party-postal-code",
  ),
  responsiblePartyCity: document.getElementById("responsible-party-city"),
  responsiblePartyStreet: document.getElementById("responsible-party-street"),
  responsiblePartyHouseNumber: document.getElementById(
    "responsible-party-house-number",
  ),
  responsiblePartyPostalCodeList: document.getElementById(
    "responsible-party-postal-code-list",
  ),
  responsiblePartyCityList: document.getElementById(
    "responsible-party-city-list",
  ),
  responsiblePartyStreetList: document.getElementById(
    "responsible-party-street-list",
  ),
  responsiblePartyAddressHint: document.getElementById(
    "responsible-party-address-hint",
  ),
  insuranceCatalogSelect: document.getElementById("insurance-catalog-select"),
  insurance: document.getElementById("insurance"),
  invoiceRecipientType: document.getElementById("invoice-recipient-type"),
  invoiceTo: document.getElementById("invoice-to"),
  invoiceEmail: document.getElementById("invoice-email"),
  invoicePhone: document.getElementById("invoice-phone"),
  invoiceAddress: document.getElementById("invoice-address"),
  insurancePolicyNumber: document.getElementById("insurance-policy-number"),
  insuranceClaimNumber: document.getElementById("insurance-claim-number"),
  insuranceEmail: document.getElementById("insurance-email"),
  insuranceMasterName: document.getElementById("insurance-master-name"),
  insuranceMasterContact: document.getElementById("insurance-master-contact"),
  insuranceMasterPhone: document.getElementById("insurance-master-phone"),
  insuranceMasterEmail: document.getElementById("insurance-master-email"),
  insuranceMasterStreet: document.getElementById("insurance-master-street"),
  insuranceMasterZip: document.getElementById("insurance-master-zip"),
  insuranceMasterCity: document.getElementById("insurance-master-city"),
  insuranceMasterCountry: document.getElementById("insurance-master-country"),
  cashDesk: document.getElementById("cash-desk"),
  otherCosts: document.getElementById("other-costs"),
  openClaimAmount: document.getElementById("open-claim-amount"),
  assignedTo: document.getElementById("assigned-to"),
  followUpDate: document.getElementById("follow-up-date"),
  costsComplete: document.getElementById("costs-complete"),
  costsCompleteRequirements: document.getElementById(
    "costs-complete-requirements",
  ),
  forwardCase: document.getElementById("forward-case"),
  approveCase: document.getElementById("approve-case"),
  catalogSelect: document.getElementById("catalog-select"),
  catalogMenge: document.getElementById("catalog-menge"),
  catalogAddBtn: document.getElementById("catalog-add-btn"),
  catalogItemsSection: document.getElementById("catalog-items-section"),
  catalogItemsList: document.getElementById("catalog-items-list"),
  catalogTotal: document.getElementById("catalog-total"),
  requiredWorkCustom: document.getElementById("required-work-custom"),
};

function getRequiredWorkInputs() {
  return Array.from(document.querySelectorAll(".required-work"));
}

function getCatalogCostTotal() {
  return (state.catalogItems || []).reduce(
    (total, item) => total + Number(item?.gesamtpreis || 0),
    0,
  );
}

function hasValidCostsCompletePrerequisites() {
  const responsiblePartyAddressValid = Boolean(
    state.responsiblePartyAddressValid,
  );
  const hasResponsibleParty = Boolean(elements.responsibleParty.value.trim());
  const hasInsurance = Boolean(elements.insurance.value.trim());
  const hasCashDesk = Boolean(elements.cashDesk.value.trim());
  const hasAccidentLocation = Boolean(elements.street.value.trim());
  const hasPlateNumber = Boolean(elements.plateNumber.value.trim());
  const hasCalculatedCosts =
    getCatalogCostTotal() > 0 ||
    Number(elements.otherCosts.value || 0) > 0 ||
    Number(elements.openClaimAmount.value || 0) > 0;

  return (
    responsiblePartyAddressValid &&
    hasResponsibleParty &&
    hasInsurance &&
    hasCashDesk &&
    hasAccidentLocation &&
    hasPlateNumber &&
    hasCalculatedCosts
  );
}

function updateCostsCompleteControlState() {
  const allowed = hasValidCostsCompletePrerequisites();
  elements.costsComplete.disabled = !allowed;

  if (!allowed && elements.costsComplete.checked) {
    elements.costsComplete.checked = false;
  }
}

function updateCostsCompleteRequirementsInfo() {
  if (!elements.costsCompleteRequirements) {
    return;
  }

  const missingFields = [];

  if (!elements.responsibleParty.value.trim()) {
    missingFields.push("Verursacher");
  }
  if (
    !state.responsiblePartyAddressValid ||
    !elements.responsiblePartyAddress.value.trim()
  ) {
    missingFields.push("gültige Verursacher-Adresse");
  }
  if (!elements.insurance.value.trim()) {
    missingFields.push("Versicherung");
  }
  if (!elements.cashDesk.value.trim()) {
    missingFields.push("Kasse");
  }
  if (!elements.street.value.trim()) {
    missingFields.push("Unfallort");
  }
  if (!elements.plateNumber.value.trim()) {
    missingFields.push("Kennzeichen");
  }
  if (
    getCatalogCostTotal() <= 0 &&
    Number(elements.otherCosts.value || 0) <= 0 &&
    Number(elements.openClaimAmount.value || 0) <= 0
  ) {
    missingFields.push("berechnete Kosten");
  }

  if (missingFields.length === 0) {
    elements.costsCompleteRequirements.textContent =
      'Alle Voraussetzungen erfüllt. Der Haken für "Kosten komplett erfasst" kann gesetzt werden.';
    elements.costsCompleteRequirements.style.color = "#1c7d3c";
    return;
  }

  elements.costsCompleteRequirements.textContent = `Es fehlen noch: ${missingFields.join(", ")}.`;
  elements.costsCompleteRequirements.style.color = "var(--lbm-gray-dark)";
}

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

async function loadCatalogData() {
  try {
    const catalog = await apiFetch("/api/catalog");
    state.catalogData = {};
    catalog.forEach((item) => {
      state.catalogData[item.id] = item;
    });

    // Update dropdown
    const select = elements.catalogSelect;
    select.innerHTML =
      '<option value="">-- Material/Leistung wählen --</option>';
    catalog.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.bezeichnung} (${item.satz.toFixed(2)} €/${item.einheit})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Katalog konnte nicht geladen werden", error);
  }
}

async function loadInsuranceCatalogData() {
  try {
    const catalog = await apiFetch("/api/insurance-catalog");
    state.insuranceCatalog = catalog || [];
    state.insuranceCatalogById = {};

    const select = elements.insuranceCatalogSelect;
    select.innerHTML =
      '<option value="">-- Versicherung aus Katalog wählen --</option>';

    state.insuranceCatalog.forEach((item) => {
      state.insuranceCatalogById[item.id] = item;
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name}${item.city ? ` - ${item.city}` : ""}${item.email ? ` (${item.email})` : ""}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Versicherungs-Katalog konnte nicht geladen werden", error);
  }
}

function renderCashDeskOptions(selectedValue = "") {
  const uniqueNames = [
    ...new Set(
      (state.cashDeskCatalog || []).map((item) => item?.name).filter(Boolean),
    ),
  ];
  elements.cashDesk.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Kasse aus Katalog wählen --";
  elements.cashDesk.appendChild(placeholder);

  uniqueNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    elements.cashDesk.appendChild(option);
  });

  if (selectedValue && !uniqueNames.includes(selectedValue)) {
    const legacyOption = document.createElement("option");
    legacyOption.value = selectedValue;
    legacyOption.textContent = selectedValue;
    elements.cashDesk.appendChild(legacyOption);
  }

  elements.cashDesk.value = selectedValue || "";
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
}

async function loadCashDeskCatalogData() {
  try {
    const entries = await apiFetch("/api/cash-desks");
    state.cashDeskCatalog = Array.isArray(entries)
      ? entries
          .filter((item) => item?.active !== false && item?.name)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "de"),
          )
      : [];
  } catch (error) {
    console.error("Kassen-Katalog konnte nicht geladen werden", error);
    state.cashDeskCatalog = [];
  }

  renderCashDeskOptions(elements.cashDesk.value || "");
}

function clearInsuranceMasterFields() {
  elements.insuranceMasterName.value = "";
  elements.insuranceMasterContact.value = "";
  elements.insuranceMasterPhone.value = "";
  elements.insuranceMasterEmail.value = "";
  elements.insuranceMasterStreet.value = "";
  elements.insuranceMasterZip.value = "";
  elements.insuranceMasterCity.value = "";
  elements.insuranceMasterCountry.value = "";
}

function setInsuranceFieldsLocked(locked) {
  elements.insurance.readOnly = locked;
  elements.insuranceEmail.readOnly = locked;
  elements.insurancePolicyNumber.readOnly = locked;
  elements.insuranceClaimNumber.readOnly = locked;
}

function setInvoiceRecipientLocked(locked) {
  elements.invoiceTo.readOnly = locked;
  elements.invoiceEmail.readOnly = locked;
  elements.invoicePhone.readOnly = locked;
  elements.invoiceAddress.readOnly = locked;
}

function getResponsiblePartyAddressParts() {
  return {
    postalCode: elements.responsiblePartyPostalCode.value.trim(),
    city: elements.responsiblePartyCity.value.trim(),
    street: elements.responsiblePartyStreet.value.trim(),
    houseNumber: elements.responsiblePartyHouseNumber.value.trim(),
  };
}

function buildResponsiblePartyAddress(
  parts = getResponsiblePartyAddressParts(),
) {
  const streetLine = [parts.street, parts.houseNumber]
    .filter(Boolean)
    .join(" ");
  const cityLine = [parts.postalCode, parts.city].filter(Boolean).join(" ");

  return [streetLine, cityLine].filter(Boolean).join(", ");
}

function splitResponsiblePartyAddress(value) {
  const input = String(value || "").trim();
  if (!input) {
    return { postalCode: "", city: "", street: "", houseNumber: "" };
  }

  const addressParts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const streetPart = addressParts[0] || "";
  const cityPart = addressParts[1] || "";

  const streetMatch = streetPart.match(/^(.*?)(?:\s+(\d+[a-zA-Z]?))?$/);
  const cityMatch = cityPart.match(/^(\d{4,5})\s+(.*)$/);

  return {
    street: streetMatch?.[1]?.trim() || streetPart,
    houseNumber: streetMatch?.[2]?.trim() || "",
    postalCode: cityMatch?.[1]?.trim() || "",
    city: cityMatch?.[2]?.trim() || cityPart,
  };
}

function syncResponsiblePartyAddressValue() {
  elements.responsiblePartyAddress.value = buildResponsiblePartyAddress();
}

function applyResponsiblePartyAddressFallbackValue() {
  const fallbackValue = "Lookup nicht verfuegbar";

  if (!elements.responsiblePartyCity.value.trim()) {
    elements.responsiblePartyCity.value = fallbackValue;
  }

  if (!elements.responsiblePartyStreet.value.trim()) {
    elements.responsiblePartyStreet.value = fallbackValue;
  }

  if (!elements.district.value.trim()) {
    elements.district.value = fallbackValue;
  }

  syncResponsiblePartyAddressValue();
}

function updateResponsiblePartyAddressSuggestions(matches) {
  state.responsiblePartyAddressSuggestions = Array.isArray(matches)
    ? matches
    : [];

  const postalCodes = [
    ...new Set(
      state.responsiblePartyAddressSuggestions
        .map((item) => item.zipCode)
        .filter(Boolean),
    ),
  ];
  const cities = [
    ...new Set(
      state.responsiblePartyAddressSuggestions
        .map((item) => item.city)
        .filter(Boolean),
    ),
  ];
  const streets = [
    ...new Set(
      state.responsiblePartyAddressSuggestions
        .map((item) => item.street)
        .filter(Boolean),
    ),
  ];

  if (elements.responsiblePartyPostalCodeList) {
    elements.responsiblePartyPostalCodeList.innerHTML = postalCodes
      .map((value) => `<option value="${value}"></option>`)
      .join("");
  }

  if (elements.responsiblePartyCityList) {
    elements.responsiblePartyCityList.innerHTML = cities
      .map((value) => `<option value="${value}"></option>`)
      .join("");
  }

  if (elements.responsiblePartyStreetList) {
    elements.responsiblePartyStreetList.innerHTML = streets
      .map((value) => `<option value="${value}"></option>`)
      .join("");
  }
}

function setResponsiblePartyAddressHint(message, isError = false) {
  if (!elements.responsiblePartyAddressHint) {
    return;
  }

  elements.responsiblePartyAddressHint.textContent =
    message || "PLZ eingeben und passende Orte und Straßen auswählen.";
  elements.responsiblePartyAddressHint.style.color = isError
    ? "#a51d2d"
    : "var(--lbm-gray-dark)";
}

async function lookupResponsiblePartyAddress() {
  const parts = getResponsiblePartyAddressParts();
  const query = new URLSearchParams({
    postalCode: parts.postalCode,
    city: parts.city,
    street: parts.street,
    houseNumber: parts.houseNumber,
  });

  if (!parts.postalCode && !parts.city && !parts.street && !parts.houseNumber) {
    state.responsiblePartyAddressValid = true;
    updateResponsiblePartyAddressSuggestions([]);
    setResponsiblePartyAddressHint(
      "PLZ eingeben und passende Orte und Straßen auswählen.",
    );
    return;
  }

  try {
    const result = await apiFetch(`/api/lookup/address?${query.toString()}`);
    const matches = result?.matches || [];
    updateResponsiblePartyAddressSuggestions(matches);

    if (matches.length === 1) {
      const match = matches[0];
      if (!parts.postalCode && match.zipCode) {
        elements.responsiblePartyPostalCode.value = match.zipCode;
      }
      if (!parts.city && match.city) {
        elements.responsiblePartyCity.value = match.city;
      }
      if (!parts.street && match.streetName) {
        elements.responsiblePartyStreet.value = match.streetName;
      }
      if (!parts.houseNumber && match.houseNumber) {
        elements.responsiblePartyHouseNumber.value = match.houseNumber;
      }
      if (!parts.city && match.district && !elements.district.value) {
        elements.district.value = match.district;
      }
      syncResponsiblePartyAddressValue();
    }

    const normalizedCurrent = buildResponsiblePartyAddress()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/,/g, "");
    const exactMatch = Boolean(
      result?.exactMatch ||
      matches.some(
        (item) =>
          (item.address || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/,/g, "") === normalizedCurrent,
      ),
    );
    state.responsiblePartyAddressValid = exactMatch;

    if (exactMatch) {
      setResponsiblePartyAddressHint("Adresse im Verzeichnis gefunden.");
    } else if (matches.length > 0) {
      setResponsiblePartyAddressHint(
        "Passende Adressen gefunden. Bitte einen Vorschlag auswählen.",
      );
    } else {
      applyResponsiblePartyAddressFallbackValue();
      setResponsiblePartyAddressHint(
        "Keine passende Adresse gefunden. Bitte prüfen oder einen Vorschlag auswählen.",
        true,
      );
    }
  } catch (error) {
    console.warn("Address lookup failed", error);
    applyResponsiblePartyAddressFallbackValue();
    state.responsiblePartyAddressValid = false;
    setResponsiblePartyAddressHint(
      "Adressprüfung derzeit nicht verfügbar.",
      true,
    );
  }
}

function syncInvoiceRecipientFields() {
  const recipientType = elements.invoiceRecipientType.value || "verursacher";

  if (recipientType === "versicherung") {
    const selectedInsurance =
      state.insuranceCatalogById[state.selectedInsuranceId];
    elements.invoiceTo.value =
      selectedInsurance?.name || elements.insurance.value || "";
    elements.invoiceAddress.value = [
      selectedInsurance?.street || elements.insuranceMasterStreet.value || "",
      [
        selectedInsurance?.zipCode || elements.insuranceMasterZip.value || "",
        selectedInsurance?.city || elements.insuranceMasterCity.value || "",
      ]
        .filter(Boolean)
        .join(" "),
      selectedInsurance?.country || elements.insuranceMasterCountry.value || "",
    ]
      .filter(Boolean)
      .join(", ");
    elements.invoiceEmail.value =
      selectedInsurance?.email || elements.insuranceMasterEmail.value || "";
    elements.invoicePhone.value =
      selectedInsurance?.phone || elements.insuranceMasterPhone.value || "";
    setInvoiceRecipientLocked(true);
    return;
  }

  if (recipientType === "verursacher") {
    elements.invoiceTo.value = elements.responsibleParty.value || "";
    elements.invoiceAddress.value = buildResponsiblePartyAddress() || "";
    elements.invoiceEmail.value = elements.invoiceEmail.value || "";
    elements.invoicePhone.value = elements.invoicePhone.value || "";
    setInvoiceRecipientLocked(true);
    return;
  }

  elements.invoiceTo.value = elements.invoiceTo.value || "";
  setInvoiceRecipientLocked(false);
}

function applyInvoiceRecipientSelection(recipientType) {
  elements.invoiceRecipientType.value = recipientType;

  if (recipientType === "versicherung") {
    syncInvoiceRecipientFields();
    return;
  }

  if (recipientType === "verursacher") {
    elements.invoiceTo.value = elements.responsibleParty.value || "";
    elements.invoiceAddress.value = buildResponsiblePartyAddress() || "";
    elements.invoiceEmail.value = "";
    elements.invoicePhone.value = "";
    setInvoiceRecipientLocked(true);
    return;
  }

  elements.invoiceTo.value = "";
  elements.invoiceAddress.value = "";
  elements.invoiceEmail.value = "";
  elements.invoicePhone.value = "";
  setInvoiceRecipientLocked(false);
}

function resetInsuranceSelection() {
  state.selectedInsuranceId = "";
  elements.insuranceCatalogSelect.value = "";
  clearInsuranceMasterFields();
  setInsuranceFieldsLocked(false);
  syncInvoiceRecipientFields();
}

function applyInsuranceSelection(insuranceId) {
  const item = state.insuranceCatalogById[insuranceId];
  if (!item) {
    resetInsuranceSelection();
    return;
  }

  state.selectedInsuranceId = insuranceId;
  elements.insurance.value = item.name || "";
  elements.invoiceTo.value = item.contactPerson || item.name || "";
  elements.insuranceEmail.value = item.email || "";

  elements.insuranceMasterName.value = item.name || "";
  elements.insuranceMasterContact.value = item.contactPerson || "";
  elements.insuranceMasterPhone.value = item.phone || "";
  elements.insuranceMasterEmail.value = item.email || "";
  elements.insuranceMasterStreet.value = item.street || "";
  elements.insuranceMasterZip.value = item.zipCode || "";
  elements.insuranceMasterCity.value = item.city || "";
  elements.insuranceMasterCountry.value = item.country || "Deutschland";

  setInsuranceFieldsLocked(true);
}

function renderCatalogItems() {
  // Katalog wird jetzt auf der separaten Kostenberechnung-Seite verwaltet
  // Diese Funktion ist rückwärtskompatibel, aber wird nicht mehr verwendet
  const catalogItemsListElement = document.getElementById("catalog-items-list");
  const catalogItemsSectionElement = document.getElementById(
    "catalog-items-section",
  );

  if (!catalogItemsListElement || !catalogItemsSectionElement) {
    return; // Elemente existieren nicht (neue Seite)
  }

  if (!state.catalogItems || state.catalogItems.length === 0) {
    catalogItemsSectionElement.style.display = "none";
    return;
  }

  catalogItemsSectionElement.style.display = "block";

  let total = 0;
  catalogItemsListElement.innerHTML = state.catalogItems
    .map((item) => {
      total += item.gesamtpreis;
      return `
      <tr>
        <td>${item.bezeichnung}</td>
        <td style="text-align: center;">${item.einheit}</td>
        <td style="text-align: center;">${item.menge.toFixed(2)}</td>
        <td style="text-align: right;">${item.satz.toFixed(2)} €</td>
        <td style="text-align: right;">${item.gesamtpreis.toFixed(2)} €</td>
        <td style="text-align: center;">
          <button type="button" onclick="removeCatalogPosition('${item.id}')" style="padding: 4px 8px; background-color: #cc0000; color: white; border: none; border-radius: 3px; cursor: pointer;">Entfernen</button>
        </td>
      </tr>
    `;
    })
    .join("");

  const catalogTotalElement = document.getElementById("catalog-total");
  if (catalogTotalElement) {
    catalogTotalElement.textContent = total.toFixed(2).replace(".", ",") + " €";
  }
  updateCostsCompleteControlState();
}

async function loadCatalogItemsForCase(caseId) {
  if (!caseId) {
    state.catalogItems = [];
    renderCatalogItems();
    return;
  }

  try {
    const items = await apiFetch(
      `/api/damage-cases/${encodeURIComponent(caseId)}/catalog-items`,
    );
    state.catalogItems = items || [];
    renderCatalogItems();
  } catch (error) {
    console.error("Katalogpositionen konnten nicht geladen werden", error);
    state.catalogItems = [];
    renderCatalogItems();
  }
}

function addCatalogPosition() {
  const catalogId = elements.catalogSelect.value;
  const menge = parseFloat(elements.catalogMenge.value);

  if (!catalogId) {
    setMessage("Bitte wählen Sie ein Material/eine Leistung aus");
    return;
  }

  if (!menge || menge <= 0) {
    setMessage("Bitte geben Sie eine gültige Menge ein");
    return;
  }

  const catalogItem = state.catalogData[catalogId];
  if (!catalogItem) {
    setMessage("Katalogposition nicht gefunden");
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

  state.catalogItems.push(position);
  renderCatalogItems();
  updateCostsSummary();

  elements.catalogSelect.value = "";
  elements.catalogMenge.value = "1";
  setMessage(`Position "${catalogItem.bezeichnung}" hinzugefügt`);
}

function removeCatalogPosition(posId) {
  state.catalogItems = state.catalogItems.filter((item) => item.id !== posId);
  renderCatalogItems();
  updateCostsSummary();
  setMessage("Position entfernt");
}

function updateCostsSummary() {
  const catalogTotal = getCatalogCostTotal();
  const otherCosts = parseFloat(elements.otherCosts.value || 0);
  const openClaim = parseFloat(elements.openClaimAmount.value || 0);
  const totalCosts = catalogTotal + otherCosts;

  const sumDisplayCatalog = document.getElementById("sum-display-catalog");
  const sumDisplayOther = document.getElementById("sum-display-other");
  const sumDisplayTotalInput = document.getElementById(
    "sum-display-total-input",
  );
  const costsSummarySection = document.getElementById("costs-summary-section");

  if (sumDisplayCatalog) {
    sumDisplayCatalog.textContent =
      catalogTotal.toFixed(2).replace(".", ",") + " €";
  }
  if (sumDisplayOther) {
    sumDisplayOther.textContent =
      otherCosts.toFixed(2).replace(".", ",") + " €";
  }
  if (sumDisplayTotalInput) {
    sumDisplayTotalInput.value = totalCosts.toFixed(2).replace(".", ",") + " €";
  }
  if (costsSummarySection) {
    costsSummarySection.style.display =
      catalogTotal > 0 || otherCosts > 0 || openClaim > 0 ? "block" : "none";
  }
}

function updateStatusChips() {
  const currentCase = state.currentCase;
  const canCreate = state.currentUser?.permissions?.includes("create_case");
  const canEditCurrent = currentCase ? currentCase.canEdit : canCreate;

  elements.userChip.textContent = `${state.currentUser?.displayName || state.currentUser?.username || "Unbekannt"} · ${state.currentUser?.roleLabels?.join(", ") || "keine Rolle"}`;
  elements.scopeChip.textContent =
    state.appliedScope === "all"
      ? "Sicht: alle sichtbaren Fälle"
      : "Sicht: eigene Fälle";
  elements.editChip.textContent = canEditCurrent
    ? "Bearbeitung möglich"
    : "Nur lesender Zugriff";
  elements.editChip.style.display = "inline-block";
  elements.editChip.classList.toggle("warn", !canEditCurrent);
}

function setMessage(message) {
  elements.pageMessage.textContent = message;
  elements.pageMessage.style.display = message ? "block" : "none";
}

function setFormDisabled(disabled) {
  document.querySelectorAll("[data-edit-control]").forEach((element) => {
    element.disabled = disabled;
  });
  elements.saveCase.disabled = disabled;
}

function clearForm() {
  elements.caseId.value = "";
  elements.caseNumber.value = "wird beim Speichern vergeben";
  elements.status.value = "Neu";
  elements.subject.value = "";
  elements.damageDate.value = "";
  elements.sapDebitor.value = "";
  elements.sapNumber.value = "";
  elements.description.value = "";
  elements.recordingOffice.value = "";
  elements.policeStation.value = "";
  elements.policeDiaryNumber.value = "";
  elements.street.value = "";
  elements.district.value = "";
  elements.sectionFrom.value = "";
  elements.sectionTo.value = "";
  elements.direction.value = "";
  elements.kmStation.value = "";
  elements.plateNumber.value = "";
  elements.registrationOffice.value = "";
  elements.responsibleParty.value = "";
  elements.responsiblePartyPostalCode.value = "";
  elements.responsiblePartyCity.value = "";
  elements.responsiblePartyStreet.value = "";
  elements.responsiblePartyHouseNumber.value = "";
  elements.responsiblePartyAddress.value = "";
  state.responsiblePartyAddressValid = true;
  updateResponsiblePartyAddressSuggestions([]);
  setResponsiblePartyAddressHint(
    "PLZ eingeben und passende Orte und Straßen auswählen.",
  );
  elements.insurance.value = "";
  elements.invoiceRecipientType.value = "verursacher";
  elements.invoiceTo.value = "";
  elements.invoiceEmail.value = "";
  elements.invoicePhone.value = "";
  elements.invoiceAddress.value = "";
  elements.insurancePolicyNumber.value = "";
  elements.insuranceClaimNumber.value = "";
  elements.insuranceEmail.value = "";
  resetInsuranceSelection();
  renderCashDeskOptions("");
  elements.otherCosts.value = "0.00";
  elements.openClaimAmount.value = "0.00";
  elements.assignedTo.value =
    state.currentUser?.displayName || state.currentUser?.username || "";
  elements.followUpDate.value = "";
  elements.costsComplete.checked = false;
  getRequiredWorkInputs().forEach((input) => {
    input.checked = false;
  });
  if (elements.requiredWorkCustom) {
    elements.requiredWorkCustom.value = "";
  }
  state.catalogItems = [];
  renderCatalogItems();
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
  updateCostsSummary();
  updateActionButtons(null);
}

function collectPayload() {
  syncResponsiblePartyAddressValue();
  const selectedRequiredWorks = getRequiredWorkInputs()
    .filter((input) => input.checked)
    .map((input) => input.value);
  const customRequiredWork = String(
    elements.requiredWorkCustom?.value || "",
  ).trim();

  if (customRequiredWork) {
    selectedRequiredWorks.push(customRequiredWork);
  }

  return {
    status: elements.status.value,
    subject: elements.subject.value,
    damageDate: elements.damageDate.value,
    sapDebitor: elements.sapDebitor.value,
    sapNumber: elements.sapNumber.value,
    description: elements.description.value,
    recordingOffice: elements.recordingOffice.value,
    policeStation: elements.policeStation.value,
    policeDiaryNumber: elements.policeDiaryNumber.value,
    street: elements.street.value,
    district: elements.district.value,
    sectionFrom: elements.sectionFrom.value,
    sectionTo: elements.sectionTo.value,
    direction: elements.direction.value,
    kmStation: elements.kmStation.value,
    plateNumber: elements.plateNumber.value,
    registrationOffice: elements.registrationOffice.value,
    responsibleParty: elements.responsibleParty.value,
    responsiblePartyAddress: elements.responsiblePartyAddress.value,
    insurance: elements.insurance.value,
    invoiceRecipientType: elements.invoiceRecipientType.value,
    invoiceTo: elements.invoiceTo.value,
    invoiceEmail: elements.invoiceEmail.value,
    invoicePhone: elements.invoicePhone.value,
    invoiceAddress: elements.invoiceAddress.value,
    insurancePolicyNumber: elements.insurancePolicyNumber.value,
    insuranceClaimNumber: elements.insuranceClaimNumber.value,
    insuranceEmail: elements.insuranceEmail.value,
    cashDesk: elements.cashDesk.value,
    otherCosts: elements.otherCosts.value,
    openClaimAmount: elements.openClaimAmount.value,
    catalogTotal: getCatalogCostTotal(),
    catalogItemCount: (state.catalogItems || []).length,
    assignedTo: elements.assignedTo.value,
    followUpDate: elements.followUpDate.value,
    costsComplete: elements.costsComplete.checked,
    requiredWorks: selectedRequiredWorks,
  };
}

function populateResponsiblePartyAddress(addressValue) {
  const parts = splitResponsiblePartyAddress(addressValue);
  elements.responsiblePartyPostalCode.value = parts.postalCode || "";
  elements.responsiblePartyCity.value = parts.city || "";
  elements.responsiblePartyStreet.value = parts.street || "";
  elements.responsiblePartyHouseNumber.value = parts.houseNumber || "";
  syncResponsiblePartyAddressValue();
}

function populateForm(damageCase) {
  elements.caseId.value = damageCase.id || "";
  elements.caseNumber.value = damageCase.caseNumber || "";
  elements.status.value = damageCase.status || "Neu";
  elements.subject.value = damageCase.subject || "";
  elements.damageDate.value = damageCase.damageDate || "";
  elements.sapDebitor.value = damageCase.sapDebitor || "";
  elements.sapNumber.value = damageCase.sapNumber || "";
  elements.description.value = damageCase.description || "";
  elements.recordingOffice.value = damageCase.recordingOffice || "";
  elements.policeStation.value = damageCase.policeStation || "";
  elements.policeDiaryNumber.value = damageCase.policeDiaryNumber || "";
  elements.street.value = damageCase.street || "";
  elements.district.value = damageCase.district || "";
  elements.sectionFrom.value = damageCase.sectionFrom || "";
  elements.sectionTo.value = damageCase.sectionTo || "";
  elements.direction.value = damageCase.direction || "";
  elements.kmStation.value = damageCase.kmStation || "";
  elements.plateNumber.value = damageCase.plateNumber || "";
  elements.registrationOffice.value = damageCase.registrationOffice || "";
  elements.responsibleParty.value = damageCase.responsibleParty || "";
  populateResponsiblePartyAddress(damageCase.responsiblePartyAddress || "");
  state.responsiblePartyAddressValid = true;
  elements.insurance.value = damageCase.insurance || "";
  elements.invoiceRecipientType.value =
    damageCase.invoiceRecipientType || "verursacher";
  elements.invoiceTo.value = damageCase.invoiceTo || "";
  elements.invoiceEmail.value = damageCase.invoiceEmail || "";
  elements.invoicePhone.value = damageCase.invoicePhone || "";
  elements.invoiceAddress.value = damageCase.invoiceAddress || "";
  elements.insurancePolicyNumber.value = damageCase.insurancePolicyNumber || "";
  elements.insuranceClaimNumber.value = damageCase.insuranceClaimNumber || "";
  elements.insuranceEmail.value = damageCase.insuranceEmail || "";
  renderCashDeskOptions(damageCase.cashDesk || "");
  elements.otherCosts.value = Number(damageCase.otherCosts || 0).toFixed(2);
  elements.openClaimAmount.value = Number(
    damageCase.openClaimAmount || 0,
  ).toFixed(2);
  elements.assignedTo.value = damageCase.assignedTo || "";
  elements.followUpDate.value = damageCase.followUpDate || "";
  elements.costsComplete.checked = Boolean(damageCase.costsComplete);

  updateActionButtons(damageCase);

  const requiredWorks = Array.isArray(damageCase.requiredWorks)
    ? damageCase.requiredWorks
    : [];

  const predefinedRequiredWorks = new Set(
    getRequiredWorkInputs().map((input) => input.value),
  );

  getRequiredWorkInputs().forEach((input) => {
    input.checked = requiredWorks.includes(input.value);
  });

  if (elements.requiredWorkCustom) {
    const customRequiredWorks = requiredWorks.filter(
      (value) => !predefinedRequiredWorks.has(value),
    );
    elements.requiredWorkCustom.value = customRequiredWorks.join(", ");
  }

  syncInvoiceRecipientFields();
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
  updateCostsSummary();

  setFormDisabled(!damageCase.canEdit);
}

function updateActionButtons(damageCase) {
  if (!damageCase) {
    elements.forwardCase.style.display = "none";
    elements.approveCase.style.display = "none";
    return;
  }

  const perms = state.currentUser?.permissions || [];
  elements.forwardCase.style.display =
    perms.includes("forward_to_leitung") && damageCase.status === "Team"
      ? "inline-block"
      : "none";
  elements.approveCase.style.display =
    perms.includes("approve_case") && damageCase.status === "Leitung"
      ? "inline-block"
      : "none";
}

function renderCaseList() {
  elements.caseListBody.innerHTML = "";

  if (state.cases.length === 0) {
    elements.caseListBody.innerHTML =
      '<div class="empty-state">Keine Fälle gefunden</div>';
    return;
  }

  state.cases.forEach((item) => {
    const row = document.createElement("div");
    row.className = `case-item ${state.currentCase?.id === item.id ? "active" : ""}`;
    row.dataset.caseId = item.id;
    row.innerHTML = `
            <div class="case-item-title">${item.caseNumber} - ${item.subject}</div>
            <div class="case-item-meta">${item.status} | ${item.street || "Keine Straße"}</div>
        `;

    row.addEventListener("click", async () => {
      await loadCase(row.dataset.caseId);
    });
    elements.caseListBody.appendChild(row);
  });
}

async function loadCaseList() {
  const selectedScope = elements.scopeFilter.value;
  const data = await apiFetch(
    `/api/damage-cases?scope=${encodeURIComponent(selectedScope)}`,
  );
  if (!data) {
    return;
  }

  state.cases = data.items || [];
  state.appliedScope = data.appliedScope || "own";
  elements.scopeFilter.value = state.appliedScope;
  renderCaseList();
  updateStatusChips();

  if (state.currentCase) {
    const currentCase = state.cases.find(
      (item) => item.id === state.currentCase.id,
    );
    if (currentCase) {
      // Already loaded
      return;
    }
  }

  if (!state.currentCase && state.cases.length > 0) {
    await loadCase(state.cases[0].id);
  }
}

async function loadCase(caseId) {
  resetInsuranceSelection();
  state.catalogItems = [];
  renderCatalogItems();

  const damageCase = await apiFetch(
    `/api/damage-cases/${encodeURIComponent(caseId)}`,
  );
  if (!damageCase) {
    return;
  }

  state.currentCase = damageCase;
  populateForm(damageCase);
  clearInsuranceMasterFields();
  setInsuranceFieldsLocked(false);
  await loadCatalogItemsForCase(caseId);
  updateStatusChips();
  renderCaseList();
  setMessage(`Fall ${damageCase.caseNumber} geladen.`);
}

async function startNewCase() {
  state.currentCase = null;
  clearForm();
  setFormDisabled(!state.currentUser?.permissions?.includes("create_case"));
  updateStatusChips();
  renderCaseList();

  try {
    const data = await apiFetch("/api/next-case-number");
    elements.caseNumber.value = data.nextNumber || "wird automatisch vergeben";
    setMessage(
      `Neuer Schadensfall vorbereitet. Reservierte Nummer: ${data.nextNumber}.`,
    );
  } catch (error) {
    console.error("Could not fetch next case number", error);
    setMessage("Neuer Schadensfall vorbereitet.");
  }
}

async function saveCase() {
  syncInvoiceRecipientFields();
  const payload = collectPayload();
  if (payload.responsiblePartyAddress && !state.responsiblePartyAddressValid) {
    await lookupResponsiblePartyAddress(payload.responsiblePartyAddress);
  }
  if (payload.responsiblePartyAddress && !state.responsiblePartyAddressValid) {
    setMessage(
      "Bitte wählen Sie eine gültige Anschrift des Verursachers aus dem Vorschlag aus",
    );
    return;
  }
  if (!payload.invoiceRecipientType) {
    setMessage("Bitte wählen Sie einen Rechnungsempfänger aus");
    return;
  }

  if (!payload.invoiceTo || !payload.invoiceAddress) {
    setMessage(
      "Bitte Rechnungsempfänger und Rechnungsadresse vollständig ausfüllen",
    );
    return;
  }

  if (
    payload.invoiceRecipientType === "andere" &&
    (!payload.invoiceEmail || !payload.invoicePhone)
  ) {
    setMessage(
      "Bitte E-Mail und Telefon für 'Andere Stelle' vollständig ausfüllen",
    );
    return;
  }
  const caseId = elements.caseId.value;
  const url = caseId
    ? `/api/damage-cases/${encodeURIComponent(caseId)}`
    : "/api/damage-cases";
  const method = caseId ? "PUT" : "POST";

  const savedCase = await apiFetch(url, {
    method,
    body: JSON.stringify(payload),
  });

  // Save catalog items if they exist
  if (savedCase.id && state.catalogItems && state.catalogItems.length > 0) {
    try {
      // Remove old items and add new ones
      for (const item of state.catalogItems) {
        // Only add items that don't have a database ID yet (new items)
        if (item.id.startsWith("temp_")) {
          await apiFetch(
            `/api/damage-cases/${encodeURIComponent(savedCase.id)}/catalog-items`,
            {
              method: "POST",
              body: JSON.stringify({
                catalogId: item.catalogId,
                menge: item.menge,
              }),
            },
          );
        }
      }
    } catch (error) {
      console.error(
        "Katalogpositionen konnten nicht gespeichert werden",
        error,
      );
      setMessage(
        `Fall gespeichert, aber Katalogpositionen konnten nicht gespeichert werden: ${error.message}`,
      );
    }
  }

  state.currentCase = savedCase;
  populateForm(savedCase);
  await loadCaseList();
  setMessage(`Fall ${savedCase.caseNumber} wurde erfolgreich gespeichert.`);
}

async function forwardCase() {
  const caseId = elements.caseId.value;
  if (!caseId) return;

  const payload = collectPayload();
  payload.forwardToLeitung = true;

  const savedCase = await apiFetch(
    `/api/damage-cases/${encodeURIComponent(caseId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  state.currentCase = null;
  clearForm();
  await loadCaseList();
  setMessage(`Fall ${savedCase.caseNumber} wurde an Leitung weitergeleitet.`);
}

async function approveCase() {
  const caseId = elements.caseId.value;
  if (!caseId) return;

  const payload = collectPayload();
  payload.approve = true;

  const savedCase = await apiFetch(
    `/api/damage-cases/${encodeURIComponent(caseId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  state.currentCase = null;
  clearForm();
  await loadCaseList();
  setMessage(`Fall ${savedCase.caseNumber} wurde freigegeben.`);
}

async function initialisePage() {
  try {
    state.currentUser = await apiFetch("/api/me");
    if (!state.currentUser) {
      return;
    }

    const canViewAll =
      state.currentUser.permissions.includes("view_all_cases") ||
      state.currentUser.permissions.includes("view_team_cases");
    const canCreate = state.currentUser.permissions.includes("create_case");

    if (!canViewAll) {
      elements.scopeFilter.innerHTML =
        '<option value="own">Eigene Fälle</option>';
    } else {
      elements.scopeFilter.innerHTML = `
                <option value="own">Eigene Fälle</option>
                <option value="department">Abteilung</option>
                <option value="all">Alle</option>
            `;
    }

    elements.newCase.hidden = !canCreate;

    // Load catalog data
    await loadCatalogData();
    await loadInsuranceCatalogData();
    await loadCashDeskCatalogData();

    await startNewCase();
    await loadCaseList();
  } catch (error) {
    setMessage(`Fehler beim Laden der Seite: ${error.message}`);
    elements.caseListBody.innerHTML = `<div class="empty-state">${error.message}</div>`;
    setFormDisabled(true);
  }
}

async function withUiFeedback(action) {
  try {
    await action();
  } catch (error) {
    setMessage(error.message);
  }
}

// Event Listeners
elements.refreshList.addEventListener("click", () =>
  withUiFeedback(loadCaseList),
);
elements.scopeFilter.addEventListener("change", () =>
  withUiFeedback(loadCaseList),
);
elements.newCase.addEventListener("click", startNewCase);
elements.saveCase.addEventListener("click", () => withUiFeedback(saveCase));
elements.forwardCase.addEventListener("click", () =>
  withUiFeedback(forwardCase),
);
elements.approveCase.addEventListener("click", () =>
  withUiFeedback(approveCase),
);

elements.catalogSelect.addEventListener("change", function () {
  if (this.value) {
    elements.catalogMenge.focus();
  }
});

elements.catalogMenge.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    addCatalogPosition();
  }
});

elements.catalogAddBtn.addEventListener("click", addCatalogPosition);

elements.invoiceRecipientType.addEventListener("change", () => {
  applyInvoiceRecipientSelection(elements.invoiceRecipientType.value);
  updateCostsCompleteControlState();
});

elements.responsibleParty.addEventListener("input", () => {
  if (elements.invoiceRecipientType.value === "verursacher") {
    elements.invoiceTo.value = elements.responsibleParty.value || "";
  }
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});

function triggerResponsiblePartyAddressLookup() {
  syncResponsiblePartyAddressValue();
  if (elements.invoiceRecipientType.value === "verursacher") {
    elements.invoiceAddress.value = buildResponsiblePartyAddress() || "";
  }

  state.responsiblePartyAddressValid = false;
  updateCostsCompleteRequirementsInfo();
  window.clearTimeout(state.responsiblePartyAddressLookupTimer);
  state.responsiblePartyAddressLookupTimer = window.setTimeout(() => {
    lookupResponsiblePartyAddress();
  }, 250);
}

elements.responsiblePartyPostalCode.addEventListener(
  "input",
  triggerResponsiblePartyAddressLookup,
);
elements.responsiblePartyCity.addEventListener(
  "input",
  triggerResponsiblePartyAddressLookup,
);
elements.responsiblePartyStreet.addEventListener(
  "input",
  triggerResponsiblePartyAddressLookup,
);
elements.responsiblePartyHouseNumber.addEventListener(
  "input",
  triggerResponsiblePartyAddressLookup,
);

elements.responsiblePartyPostalCode.addEventListener("blur", () => {
  window.clearTimeout(state.responsiblePartyAddressLookupTimer);
  lookupResponsiblePartyAddress();
});

elements.responsiblePartyCity.addEventListener("blur", () => {
  window.clearTimeout(state.responsiblePartyAddressLookupTimer);
  lookupResponsiblePartyAddress();
});

elements.responsiblePartyStreet.addEventListener("blur", () => {
  window.clearTimeout(state.responsiblePartyAddressLookupTimer);
  lookupResponsiblePartyAddress();
});

elements.responsiblePartyHouseNumber.addEventListener("blur", () => {
  window.clearTimeout(state.responsiblePartyAddressLookupTimer);
  lookupResponsiblePartyAddress();
});

elements.insuranceCatalogSelect.addEventListener("change", function () {
  if (!this.value) {
    resetInsuranceSelection();
    updateCostsCompleteRequirementsInfo();
    updateCostsCompleteControlState();
    return;
  }

  applyInsuranceSelection(this.value);
  if (elements.invoiceRecipientType.value === "versicherung") {
    syncInvoiceRecipientFields();
  }
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});

elements.plateNumber.addEventListener("blur", async () => {
  const plate = elements.plateNumber.value;
  if (!plate) return;
  try {
    const data = await apiFetch(
      `/api/lookup/vehicle?plate=${encodeURIComponent(plate)}`,
    );
    if (data) {
      elements.insurance.value = data.insurance || "";
      elements.registrationOffice.value = data.registrationOffice || "";
      elements.insuranceEmail.value = data.insuranceEmail || "";
      updateCostsCompleteRequirementsInfo();
      updateCostsCompleteControlState();
    }
  } catch (e) {
    console.warn("Lookup failed", e);
  }
});

elements.street.addEventListener("blur", async () => {
  const street = elements.street.value;
  if (!street) return;
  try {
    const data = await apiFetch(
      `/api/lookup/street?street=${encodeURIComponent(street)}`,
    );
    if (data) {
      elements.district.value = data.district || "";
    }
    updateCostsCompleteRequirementsInfo();
    updateCostsCompleteControlState();
  } catch (e) {
    console.warn("Lookup failed", e);
  }
});

elements.street.addEventListener("input", () => {
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.plateNumber.addEventListener("input", () => {
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.insurance.addEventListener("input", () => {
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.cashDesk.addEventListener("change", () => {
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.otherCosts.addEventListener("input", () => {
  updateCostsSummary();
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.openClaimAmount.addEventListener("input", () => {
  updateCostsSummary();
  updateCostsCompleteRequirementsInfo();
  updateCostsCompleteControlState();
});
elements.costsComplete.addEventListener("change", () => {
  if (elements.costsComplete.checked && !hasValidCostsCompletePrerequisites()) {
    elements.costsComplete.checked = false;
    setMessage(
      "Kosten komplett erfasst kann erst gesetzt werden, wenn alle Voraussetzungen erfüllt sind.",
    );
  }
});

document.addEventListener("DOMContentLoaded", initialisePage);
