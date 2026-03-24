const state = {
  currentUser: null,
  currentCase: null,
  cases: [],
  appliedScope: "own",
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
  description: document.getElementById("description"),
  street: document.getElementById("street"),
  district: document.getElementById("district"),
  sectionFrom: document.getElementById("section-from"),
  sectionTo: document.getElementById("section-to"),
  direction: document.getElementById("direction"),
  kmStation: document.getElementById("km-station"),
  plateNumber: document.getElementById("plate-number"),
  registrationOffice: document.getElementById("registration-office"),
  responsibleParty: document.getElementById("responsible-party"),
  insurance: document.getElementById("insurance"),
  invoiceTo: document.getElementById("invoice-to"),
  insurancePolicyNumber: document.getElementById("insurance-policy-number"),
  insuranceClaimNumber: document.getElementById("insurance-claim-number"),
  insuranceEmail: document.getElementById("insurance-email"),
  cashDesk: document.getElementById("cash-desk"),
  otherCosts: document.getElementById("other-costs"),
  openClaimAmount: document.getElementById("open-claim-amount"),
  assignedTo: document.getElementById("assigned-to"),
  followUpDate: document.getElementById("follow-up-date"),
  costsComplete: document.getElementById("costs-complete"),
};

function getRequiredWorkInputs() {
  return Array.from(document.querySelectorAll(".required-work"));
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
  elements.editChip.classList.toggle("warn", !canEditCurrent);
}

function setMessage(message) {
  elements.pageMessage.textContent = message;
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
  elements.description.value = "";
  elements.street.value = "";
  elements.district.value = "";
  elements.sectionFrom.value = "";
  elements.sectionTo.value = "";
  elements.direction.value = "";
  elements.kmStation.value = "";
  elements.plateNumber.value = "";
  elements.registrationOffice.value = "";
  elements.responsibleParty.value = "";
  elements.insurance.value = "";
  elements.invoiceTo.value = "";
  elements.insurancePolicyNumber.value = "";
  elements.insuranceClaimNumber.value = "";
  elements.insuranceEmail.value = "";
  elements.cashDesk.value = "";
  elements.otherCosts.value = "0.00";
  elements.openClaimAmount.value = "0.00";
  elements.assignedTo.value =
    state.currentUser?.displayName || state.currentUser?.username || "";
  elements.followUpDate.value = "";
  elements.costsComplete.checked = false;
  getRequiredWorkInputs().forEach((input) => {
    input.checked = false;
  });
}

function collectPayload() {
  return {
    status: elements.status.value,
    subject: elements.subject.value,
    damageDate: elements.damageDate.value,
    description: elements.description.value,
    street: elements.street.value,
    district: elements.district.value,
    sectionFrom: elements.sectionFrom.value,
    sectionTo: elements.sectionTo.value,
    direction: elements.direction.value,
    kmStation: elements.kmStation.value,
    plateNumber: elements.plateNumber.value,
    registrationOffice: elements.registrationOffice.value,
    responsibleParty: elements.responsibleParty.value,
    insurance: elements.insurance.value,
    invoiceTo: elements.invoiceTo.value,
    insurancePolicyNumber: elements.insurancePolicyNumber.value,
    insuranceClaimNumber: elements.insuranceClaimNumber.value,
    insuranceEmail: elements.insuranceEmail.value,
    cashDesk: elements.cashDesk.value,
    otherCosts: elements.otherCosts.value,
    openClaimAmount: elements.openClaimAmount.value,
    assignedTo: elements.assignedTo.value,
    followUpDate: elements.followUpDate.value,
    costsComplete: elements.costsComplete.checked,
    requiredWorks: getRequiredWorkInputs()
      .filter((input) => input.checked)
      .map((input) => input.value),
  };
}

function populateForm(damageCase) {
  elements.caseId.value = damageCase.id || "";
  elements.caseNumber.value =
    damageCase.caseNumber || "wird beim Speichern vergeben";
  elements.status.value = damageCase.status || "Neu";
  elements.subject.value = damageCase.subject || "";
  elements.damageDate.value = damageCase.damageDate || "";
  elements.description.value = damageCase.description || "";
  elements.street.value = damageCase.street || "";
  elements.district.value = damageCase.district || "";
  elements.sectionFrom.value = damageCase.sectionFrom || "";
  elements.sectionTo.value = damageCase.sectionTo || "";
  elements.direction.value = damageCase.direction || "";
  elements.kmStation.value = damageCase.kmStation || "";
  elements.plateNumber.value = damageCase.plateNumber || "";
  elements.registrationOffice.value = damageCase.registrationOffice || "";
  elements.responsibleParty.value = damageCase.responsibleParty || "";
  elements.insurance.value = damageCase.insurance || "";
  elements.invoiceTo.value = damageCase.invoiceTo || "";
  elements.insurancePolicyNumber.value = damageCase.insurancePolicyNumber || "";
  elements.insuranceClaimNumber.value = damageCase.insuranceClaimNumber || "";
  elements.insuranceEmail.value = damageCase.insuranceEmail || "";
  elements.cashDesk.value = damageCase.cashDesk || "";
  elements.otherCosts.value = Number(damageCase.otherCosts || 0).toFixed(2);
  elements.openClaimAmount.value = Number(
    damageCase.openClaimAmount || 0,
  ).toFixed(2);
  elements.assignedTo.value = damageCase.assignedTo || "";
  elements.followUpDate.value = damageCase.followUpDate || "";
  elements.costsComplete.checked = Boolean(damageCase.costsComplete);

  const requiredWorks = Array.isArray(damageCase.requiredWorks)
    ? damageCase.requiredWorks
    : [];
  getRequiredWorkInputs().forEach((input) => {
    input.checked = requiredWorks.includes(input.value);
  });
}

function renderCaseList() {
  if (!state.cases.length) {
    elements.caseListBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">Keine Fälle im aktuellen Sichtbereich gefunden.</td></tr>';
    return;
  }

  elements.caseListBody.innerHTML = state.cases
    .map((damageCase) => {
      const isActive = damageCase.id === state.currentCase?.id;
      return `
            <tr class="case-row ${isActive ? "active" : ""}" data-case-id="${damageCase.id}">
                <td>
                    <strong>${damageCase.caseNumber || "ohne Nummer"}</strong><br>
                    <small class="text-muted">${damageCase.damageDate || "kein Datum"}</small>
                </td>
                <td>${damageCase.status || "Neu"}</td>
                <td>${damageCase.responsibleParty || "unbekannt"}</td>
                <td>${damageCase.assignedTo || damageCase.createdBy || "-"}</td>
            </tr>
        `;
    })
    .join("");

  document.querySelectorAll(".case-row").forEach((row) => {
    row.addEventListener("click", async () => {
      await loadCase(row.dataset.caseId);
    });
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
      await loadCase(currentCase.id);
      return;
    }
  }

  if (!state.currentCase && state.cases.length) {
    await loadCase(state.cases[0].id);
  }
}

async function loadCase(caseId) {
  const damageCase = await apiFetch(
    `/api/damage-cases/${encodeURIComponent(caseId)}`,
  );
  if (!damageCase) {
    return;
  }

  state.currentCase = damageCase;
  populateForm(damageCase);
  setFormDisabled(!damageCase.canEdit);
  updateStatusChips();
  renderCaseList();
  setMessage(
    `Fall ${damageCase.caseNumber} geladen. Eigentümer: ${damageCase.createdBy || "unbekannt"}.`,
  );
}

function startNewCase() {
  state.currentCase = null;
  clearForm();
  setFormDisabled(!state.currentUser?.permissions?.includes("create_case"));
  updateStatusChips();
  renderCaseList();
  setMessage(
    "Neuer Schadensfall vorbereitet. Die Schaden-Nummer wird beim Speichern vergeben.",
  );
}

async function saveCase() {
  const payload = collectPayload();
  const caseId = elements.caseId.value;
  const url = caseId
    ? `/api/damage-cases/${encodeURIComponent(caseId)}`
    : "/api/damage-cases";
  const method = caseId ? "PUT" : "POST";

  const savedCase = await apiFetch(url, {
    method,
    body: JSON.stringify(payload),
  });

  state.currentCase = savedCase;
  populateForm(savedCase);
  setFormDisabled(!savedCase.canEdit);
  updateStatusChips();
  setMessage(`Fall ${savedCase.caseNumber} wurde erfolgreich gespeichert.`);
  await loadCaseList();
}

async function initialisePage() {
  try {
    state.currentUser = await apiFetch("/api/me");
    if (!state.currentUser) {
      return;
    }

    const canViewAll = state.currentUser.permissions.includes("view_all_cases");
    const canCreate = state.currentUser.permissions.includes("create_case");

    if (!canViewAll) {
      elements.scopeFilter.innerHTML =
        '<option value="own">Eigene Fälle</option>';
    }

    elements.newCase.hidden = !canCreate;
    startNewCase();
    await loadCaseList();
  } catch (error) {
    setMessage(`Fehler beim Laden der Seite: ${error.message}`);
    elements.caseListBody.innerHTML = `<tr><td colspan="4" class="empty-state">${error.message}</td></tr>`;
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

elements.refreshList.addEventListener("click", () =>
  withUiFeedback(loadCaseList),
);
elements.scopeFilter.addEventListener("change", () =>
  withUiFeedback(loadCaseList),
);
elements.newCase.addEventListener("click", startNewCase);
elements.saveCase.addEventListener("click", () => withUiFeedback(saveCase));

document.addEventListener("DOMContentLoaded", initialisePage);
