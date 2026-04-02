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
  responsiblePartyAddress: document.getElementById("responsible-party-address"),
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
  forwardCase: document.getElementById("forward-case"),
  approveCase: document.getElementById("approve-case"),
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
  elements.responsiblePartyAddress.value = "";
  elements.insurance.value = "";
  elements.invoiceTo.value = "";
  elements.insurancePolicyNumber.value = "";
  elements.insuranceClaimNumber.value = "";
  elements.insuranceEmail.value = "";
  elements.cashDesk.value = "";
  elements.otherCosts.value = "0.00";
  elements.openClaimAmount.value = "0.00";
  elements.assignedTo.value =
    state.currentUser?.kurzel || state.currentUser?.username || "";
  elements.followUpDate.value = "";
  elements.costsComplete.checked = false;
  getRequiredWorkInputs().forEach((input) => {
    input.checked = false;
  });
  updateActionButtons(null);
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
    responsiblePartyAddress: elements.responsiblePartyAddress.value,
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
  elements.caseNumber.value = damageCase.caseNumber || "";
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
  elements.responsiblePartyAddress.value =
    damageCase.responsiblePartyAddress || "";
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

  updateActionButtons(damageCase);

  const requiredWorks = Array.isArray(damageCase.requiredWorks)
    ? damageCase.requiredWorks
    : [];
  getRequiredWorkInputs().forEach((input) => {
    input.checked = requiredWorks.includes(input.value);
  });

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
  const damageCase = await apiFetch(
    `/api/damage-cases/${encodeURIComponent(caseId)}`,
  );
  if (!damageCase) {
    return;
  }

  state.currentCase = damageCase;
  populateForm(damageCase);
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
  } catch (e) {
    console.warn("Lookup failed", e);
  }
});

document.addEventListener("DOMContentLoaded", initialisePage);
