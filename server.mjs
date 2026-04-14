import express from "express";
import fs from "fs";
import path from "path";
import session from "express-session";
import bodyParser from "body-parser";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import local CommonJS modules (Node.js treats module.exports as default export)
import db from "./src/db.js";
import rights from "./src/rights.js";
import LDAPSearch from "./src/LDAPSearch.js";

// ESM shims for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Data for Lookups (would normally be in another DB)
const VEHICLE_DATA = {
  "B-AB-123": {
    insurance: "HUK Coburg",
    registrationOffice: "Berlin",
    insuranceEmail: "kfz@huk.de",
  },
  "HH-CD-456": {
    insurance: "Allianz",
    registrationOffice: "Hamburg",
    insuranceEmail: "service@allianz.de",
  },
  "M-EF-789": {
    insurance: "R+V Versicherung",
    registrationOffice: "München",
    insuranceEmail: "info@ruv.de",
  },
};

const STREET_DATA = {
  Hauptstraße: { district: "Berlin-Mitte", sections: ["Nord", "Süd", "Mitte"] },
  Bahnhofstraße: {
    district: "Hamburg-Altona",
    sections: ["Gleis 1-4", "Bahnhofsvorplatz"],
  },
  Ringweg: {
    district: "München-Sendling",
    sections: ["Äußerer Ring", "Innerer Ring"],
  },
};

function normalizeLookupQuery(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildAddressLabel(address) {
  const parts = [];

  if (address.street) {
    const streetParts = [address.street, address.houseNumber]
      .filter(Boolean)
      .join(" ");
    if (streetParts) {
      parts.push(streetParts);
    }
  }

  const cityParts = [address.zipCode, address.city].filter(Boolean).join(" ");
  if (cityParts) {
    parts.push(cityParts);
  }

  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(", ");
}

function mapNominatimAddress(item) {
  const address = item?.address || {};
  const street =
    address.road ||
    address.pedestrian ||
    address.cycleway ||
    address.path ||
    "";
  const houseNumber = address.house_number || "";
  const zipCode = address.postcode || "";
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.suburb ||
    "";
  const district =
    address.city_district ||
    address.county ||
    address.state_district ||
    address.state ||
    "";
  const country = address.country || "";
  const streetLine = [street, houseNumber].filter(Boolean).join(" ");

  return {
    address: buildAddressLabel({
      street: streetLine || street,
      houseNumber: "",
      zipCode,
      city,
      country,
    }),
    street: streetLine || street,
    streetName: street,
    houseNumber,
    zipCode,
    city,
    district,
    country,
  };
}

function normalizeAddressForCompare(address) {
  return normalizeLookupQuery(buildAddressLabel(address))
    .replace(/\s+/g, " ")
    .replace(/,/g, "");
}

let lastAddressLookupWarningAt = 0;

function isTransientAddressLookupError(error) {
  if (!error) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const code = error.code || error.cause?.code;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  return message.includes("timeout") || message.includes("fetch failed");
}

function logAddressLookupWarning(message, error) {
  const now = Date.now();
  // Reduce repeated lookup noise when internet/DNS is temporarily unavailable.
  if (now - lastAddressLookupWarningAt < 60000) {
    return;
  }

  lastAddressLookupWarningAt = now;
  const reason = error?.cause?.code || error?.code || error?.name || "UNKNOWN";
  console.warn(`${message} (${reason})`);
}

async function fetchAddressSuggestionsFromInternet(query) {
  const normalized = normalizeLookupQuery(query);
  if (!normalized) {
    return [];
  }

  const searchQuery = /^\d{4,5}$/.test(normalized)
    ? `${query} Deutschland`
    : query;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("limit", "10");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SaS3/1.0 (address-lookup)",
        "Accept-Language": "de",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(mapNominatimAddress)
      .filter((item) => item.address)
      .slice(0, 10);
  } catch (error) {
    if (isTransientAddressLookupError(error)) {
      logAddressLookupWarning("Adress-Lookup derzeit nicht erreichbar", error);
      return [];
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const configPath = path.join(__dirname, "/config/config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const dummyUsers = new Map(
  (config.testUsers || []).map((user) => [user.username.toLowerCase(), user]),
);

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: config.server?.sessionSecret || "sas3-secret-key-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }),
);

app.use((req, _res, next) => {
  const scope = req.session?.user?.isDummy ? "dummy" : "main";
  db.runWithScope(scope, next);
});

app.use("/src", express.static(path.join(__dirname, "src")));

function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }

  res.redirect("/login");
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (rights.hasPermission(req.session?.user, permission)) {
      return next();
    }

    res
      .status(403)
      .json({ error: "Zugriff verweigert", missingPermission: permission });
  };
}

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (rights.hasAnyPermission(req.session?.user, permissions)) {
      return next();
    }

    res
      .status(403)
      .json({ error: "Zugriff verweigert", requiredPermissions: permissions });
  };
}

async function fetchDirectoryUser(username) {
  const searcher = new LDAPSearch(
    config.ldap.realm,
    config.ldap.username,
    config.ldap.password,
  );
  const filter = config.ldap.userFilter.replace("{{username}}", username);

  try {
    const results = await searcher.search(
      filter,
      "dn",
      "memberOf",
      "mail",
      "givenName",
      "sn",
      "displayName",
      "cn",
      "sAMAccountName",
      "department",
    );

    if (results && results.length > 0) {
      const result = results[0];
      return {
        dn: result.dn ? result.dn[0] : null,
        memberOf: result.memberOf || [],
        mail: result.mail ? result.mail[0] : "",
        givenName: result.givenName ? result.givenName[0] : "",
        sn: result.sn ? result.sn[0] : "",
        displayName: result.displayName ? result.displayName[0] : "",
        cn: result.cn ? result.cn[0] : "",
        sAMAccountName: result.sAMAccountName
          ? result.sAMAccountName[0]
          : username,
        department: result.department ? result.department[0] : "",
      };
    }
  } catch (error) {
    console.error("fetchDirectoryUser error", error);
  }

  return null;
}

async function fetchDirectoryGroups() {
  const searcher = new LDAPSearch(
    config.ldap.realm,
    config.ldap.username,
    config.ldap.password,
  );

  try {
    const results = await searcher.search(
      "(&(objectClass=group)(cn=*))",
      "cn",
      "dn",
    );

    const groups = (results || [])
      .map((entry) => ({
        name: entry.cn ? entry.cn[0] : "",
        dn: entry.dn ? entry.dn[0] : "",
      }))
      .filter((group) => group.name || group.dn)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return groups;
  } catch (error) {
    console.error("fetchDirectoryGroups error", error);
    return [];
  }
}

function saveConfig() {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function getRoleOptions() {
  return Object.entries(config.rights?.roles || {}).map(
    ([name, definition]) => ({
      name,
      label: definition?.label || name,
    }),
  );
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function normalizeLoginUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const withoutDomainPrefix = raw.includes("\\") ? raw.split("\\").pop() : raw;
  const withoutUpnSuffix = withoutDomainPrefix.includes("@")
    ? withoutDomainPrefix.split("@")[0]
    : withoutDomainPrefix;

  return withoutUpnSuffix.trim();
}

function buildSessionUser(username, directoryUser, authorization) {
  const isDummyUser = Boolean(directoryUser?.isDummy);
  const firstName = directoryUser?.givenName || "";
  const lastName = directoryUser?.sn || "";
  const displayName =
    directoryUser?.displayName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    username;
  const email = directoryUser?.mail || "";
  const dienststelle = directoryUser?.department || "";
  const kurzel = db.createUserCode(username);

  return {
    username,
    displayName,
    email,
    firstName,
    lastName,
    dienststelle,
    kurzel,
    groups: authorization.groups,
    roles: authorization.roles,
    roleLabels: authorization.roleLabels,
    permissions: authorization.permissions,
    isAdmin: authorization.permissions.includes("manage_users"),
    isDummy: isDummyUser,
  };
}

async function authenticate(username, password) {
  const normalizedUsername = normalizeLoginUsername(username);
  const normalizedPassword = String(password || "");

  if (!normalizedUsername) {
    return { ok: false, reason: "missing" };
  }

  // Check for test users configured in config.json
  const testUser = dummyUsers.get(normalizedUsername.toLowerCase());

  if (testUser) {
    const directoryUser = {
      dn: `CN=${testUser.username},OU=Test,DC=lsv,DC=intra`,
      memberOf: testUser.groups || [],
      mail: testUser.email || "",
      givenName: testUser.displayName.split(" ")[0] || "",
      sn: testUser.displayName.split(" ").slice(1).join(" ") || "",
      displayName: testUser.displayName || "",
      cn: testUser.username,
      sAMAccountName: testUser.username,
      department: testUser.department || "",
      isDummy: true,
    };

    const authorization = rights.resolveAuthorization(
      directoryUser.memberOf,
      config,
    );
    return {
      ok: true,
      directoryUser,
      authorization,
      user: buildSessionUser(normalizedUsername, directoryUser, authorization),
    };
  }

  if (!normalizedPassword) {
    return { ok: false, reason: "missingPassword" };
  }

  // Validate AD credentials by binding with the provided user and password.
  try {
    const credentialCheck = new LDAPSearch(
      config.ldap.realm,
      normalizedUsername,
      normalizedPassword,
    );
    const filter = config.ldap.userFilter.replace(
      "{{username}}",
      normalizedUsername,
    );
    const authResults = await credentialCheck.search(filter, "dn");
    if (!authResults || authResults.length === 0) {
      return { ok: false, reason: "invalidCredentials" };
    }
  } catch (_error) {
    return { ok: false, reason: "invalidCredentials" };
  }

  const directoryUser = await fetchDirectoryUser(normalizedUsername);

  if (!directoryUser) {
    return { ok: false, reason: "notfound" };
  }

  const authorization = rights.resolveAuthorization(
    directoryUser.memberOf,
    config,
  );
  if (!authorization.isMember) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    directoryUser,
    authorization,
    user: buildSessionUser(normalizedUsername, directoryUser, authorization),
  };
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNumberString(value) {
  const normalized = String(value || "")
    .trim()
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value) {
  return (
    value === true ||
    value === "true" ||
    value === "on" ||
    value === 1 ||
    value === "1"
  );
}

function normalizeRequiredWorks(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => normalizeString(item)).filter(Boolean)
        : [];
    } catch (_error) {
      return value
        .split(",")
        .map((item) => normalizeString(item))
        .filter(Boolean);
    }
  }

  return [];
}

function sanitizeDamageCaseInput(body) {
  return {
    status: normalizeString(body.status) || "Neu",
    subject:
      normalizeString(body.subject) ||
      normalizeString(body.responsibleParty) ||
      "Schadensfall",
    description: normalizeString(body.description),
    damageDate: normalizeString(body.damageDate),
    sapDebitor: normalizeString(body.sapDebitor),
    sapNumber: normalizeString(body.sapNumber),
    recordingOffice: normalizeString(body.recordingOffice),
    policeStation: normalizeString(body.policeStation),
    policeDiaryNumber: normalizeString(body.policeDiaryNumber),
    street: normalizeString(body.street),
    sectionFrom: normalizeString(body.sectionFrom),
    sectionTo: normalizeString(body.sectionTo),
    direction: normalizeString(body.direction),
    kmStation: normalizeString(body.kmStation),
    district: normalizeString(body.district),
    plateNumber: normalizeString(body.plateNumber),
    registrationOffice: normalizeString(body.registrationOffice),
    responsibleParty: normalizeString(body.responsibleParty),
    insurance: normalizeString(body.insurance),
    insurancePolicyNumber: normalizeString(body.insurancePolicyNumber),
    insuranceClaimNumber: normalizeString(body.insuranceClaimNumber),
    insuranceEmail: normalizeString(body.insuranceEmail),
    invoiceTo: normalizeString(body.invoiceTo),
    invoiceRecipientType:
      normalizeString(body.invoiceRecipientType) || "verursacher",
    invoiceAddress: normalizeString(body.invoiceAddress),
    invoicePhone: normalizeString(body.invoicePhone),
    invoiceEmail: normalizeString(body.invoiceEmail),
    cashDesk: normalizeString(body.cashDesk),
    otherCosts: normalizeNumberString(body.otherCosts),
    openClaimAmount: normalizeNumberString(body.openClaimAmount),
    catalogTotal: normalizeNumberString(body.catalogTotal),
    catalogItemCount: normalizeNumberString(body.catalogItemCount),
    costsComplete: normalizeBoolean(body.costsComplete),
    assignedTo: normalizeString(body.assignedTo),
    followUpDate: normalizeString(body.followUpDate),
    requiredWorks: normalizeRequiredWorks(body.requiredWorks),
  };
}

function hasLockedCostFieldChanges(existingDamageCase, payload) {
  const currentRequiredWorks = Array.isArray(existingDamageCase.requiredWorks)
    ? existingDamageCase.requiredWorks
        .map((item) => normalizeString(item))
        .filter(Boolean)
    : [];
  const nextRequiredWorks = Array.isArray(payload.requiredWorks)
    ? payload.requiredWorks.map((item) => normalizeString(item)).filter(Boolean)
    : [];

  const requiredWorksChanged =
    currentRequiredWorks.length !== nextRequiredWorks.length ||
    currentRequiredWorks.some(
      (item, index) => item !== nextRequiredWorks[index],
    );

  return (
    Number(existingDamageCase.otherCosts || 0) !==
      Number(payload.otherCosts || 0) ||
    Number(existingDamageCase.openClaimAmount || 0) !==
      Number(payload.openClaimAmount || 0) ||
    requiredWorksChanged
  );
}

function hasValidCostsCompletePrerequisites(damageCase) {
  const hasResponsibleParty = Boolean(
    String(damageCase.responsibleParty || "").trim(),
  );
  const hasValidResponsiblePartyAddress = Boolean(
    String(damageCase.responsiblePartyAddress || "").trim(),
  );
  const hasInsurance = Boolean(String(damageCase.insurance || "").trim());
  const hasCashDesk = Boolean(String(damageCase.cashDesk || "").trim());
  const hasAccidentLocation = Boolean(String(damageCase.street || "").trim());
  const hasPlateNumber = Boolean(String(damageCase.plateNumber || "").trim());
  const hasCalculatedCosts =
    Number(damageCase.catalogTotal || 0) > 0 ||
    Number(damageCase.otherCosts || 0) > 0 ||
    Number(damageCase.openClaimAmount || 0) > 0;

  return (
    hasResponsibleParty &&
    hasValidResponsiblePartyAddress &&
    hasInsurance &&
    hasCashDesk &&
    hasAccidentLocation &&
    hasPlateNumber &&
    hasCalculatedCosts
  );
}

async function fetchDamageCaseOr404(req, res) {
  const damageCase = await db.getDamageCaseById(req.params.id);

  if (!damageCase) {
    res.status(404).json({ error: "Schadensfall nicht gefunden" });
    return null;
  }

  return damageCase;
}

function withCasePermissions(user, damageCase) {
  return {
    ...damageCase,
    canView: rights.canViewCase(user, damageCase),
    canEdit: rights.canEditCase(user, damageCase),
    isOwner: rights.isOwner(user, damageCase),
  };
}

app.get("/api/auth-options", (_req, res) => {
  res.json({
    testUsers: (config.testUsers || []).map((user) => ({
      username: user.username,
      displayName: user.displayName,
      department: user.department || "",
    })),
  });
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "/public/login.html"));
});

app.post("/login", async (req, res) => {
  try {
    const username = normalizeLoginUsername(req.body.username || req.body.user);
    const password = String(req.body.password || "");

    if (!username) {
      res.status(400).json({ error: "Bitte einen Benutzernamen angeben." });
      return;
    }

    const result = await authenticate(username, password);

    if (!result.ok) {
      const errorMessages = {
        missing: "Bitte einen Benutzernamen angeben.",
        missingPassword: "Bitte ein Passwort angeben.",
        invalidCredentials: "Benutzername oder Passwort ist falsch.",
        notfound: "Benutzer im Active Directory nicht gefunden.",
        forbidden: "Benutzer ist nicht freigeschaltet.",
      };

      res.status(401).json({
        error: errorMessages[result.reason] || "Anmeldung fehlgeschlagen.",
      });
      return;
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }

        req.session.user = result.user;
        resolve();
      });
    });

    try {
      const scope = result.user?.isDummy ? "dummy" : "main";
      await db.runWithScope(scope, () => db.upsertUser(result.user));
    } catch (dbError) {
      console.error("DB Error bei Login:", dbError.message);
    }

    res.json({ ok: true, user: result.user });
  } catch (error) {
    console.error("Login fehlgeschlagen", error);
    res.status(500).json({ error: "Anmeldung fehlgeschlagen." });
  }
});

app.get("/", (req, res) => {
  if (req.session?.user) {
    res.redirect("/overview");
    return;
  }

  res.redirect("/login");
});

app.get("/overview", requireLogin, (_req, res) => {
  res.sendFile(path.join(__dirname, "/public/overview.html"));
});

app.get(
  "/create-damage-case",
  requireLogin,
  requireAnyPermission(["create_case", "view_own_cases", "view_all_cases"]),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/create_damage_case.html"));
  },
);

app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).send("Logout fehlgeschlagen.");
      return;
    }

    res.redirect("/login");
  });
});

app.get("/api/me", (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
    return;
  }

  res.status(401).json({ error: "Nicht angemeldet" });
});

app.get("/api/next-case-number", requireLogin, async (_req, res) => {
  try {
    const nextNumber = await db.getNextCaseNumber(
      await db.connect(),
      new Date(),
    );
    res.json({ nextNumber });
  } catch (error) {
    console.error("Fehler beim Abrufen der nächsten Fallnummer", error);
    res
      .status(500)
      .json({ error: "Fehler beim Abrufen der nächsten Fallnummer" });
  }
});

// Lookup Endpoints
app.get("/api/lookup/vehicle", requireLogin, (req, res) => {
  const plate = String(req.query.plate || "").toUpperCase();
  const data = VEHICLE_DATA[plate];
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: "Fahrzeug nicht gefunden" });
  }
});

app.get("/api/lookup/street", requireLogin, async (req, res) => {
  const street = String(req.query.street || "").trim();
  if (!street) {
    res.status(400).json({ error: "Straße fehlt" });
    return;
  }

  try {
    const suggestions = await fetchAddressSuggestionsFromInternet(street);
    const bestMatch = suggestions[0] || null;
    const fallback = STREET_DATA[street] || null;

    if (!bestMatch && !fallback) {
      res.status(404).json({ error: "Straße nicht gefunden" });
      return;
    }

    res.json({
      district: bestMatch?.district || fallback?.district || "",
      sections: fallback?.sections || [],
      suggestions,
    });
  } catch (error) {
    console.error("Straßen-Lookup fehlgeschlagen", error);
    const fallback = STREET_DATA[street];
    if (fallback) {
      res.json({
        district: fallback.district || "",
        sections: fallback.sections || [],
        suggestions: [],
      });
      return;
    }

    res.status(502).json({ error: "Straßen-Lookup derzeit nicht verfügbar" });
  }
});

app.get("/api/lookup/address", requireLogin, (req, res) => {
  const query = [
    req.query.postalCode,
    req.query.city,
    req.query.street,
    req.query.houseNumber,
    req.query.query,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  if (!query) {
    res.json({ matches: [], exactMatch: null });
    return;
  }

  fetchAddressSuggestionsFromInternet(query)
    .then((matches) => {
      const normalizedQuery = normalizeLookupQuery(query)
        .replace(/\s+/g, " ")
        .replace(/,/g, "");

      const exactMatch =
        matches.find(
          (item) => normalizeAddressForCompare(item) === normalizedQuery,
        ) || null;

      res.json({ matches, exactMatch });
    })
    .catch((error) => {
      console.error("Adress-Lookup fehlgeschlagen", error);
      res.status(502).json({ error: "Adress-Lookup derzeit nicht verfügbar" });
    });
});

app.get(
  "/rights",
  requireLogin,
  requirePermission("manage_users"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/rights.html"));
  },
);

app.get(
  "/catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/catalog.html"));
  },
);

app.get(
  "/insurance-catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/insurance-catalog.html"));
  },
);

app.get(
  "/cash-desk-catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/cash-desk-catalog.html"));
  },
);

app.get(
  "/api/users",
  requireLogin,
  requirePermission("manage_users"),
  async (_req, res) => {
    try {
      const users = await db.getUsers();
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          const username = normalizeString(
            user.BENADUID || user.BENSASXUSER || user.BENID,
          );

          try {
            const directoryUser = username
              ? await fetchDirectoryUser(username)
              : null;
            const authorization = rights.resolveAuthorization(
              directoryUser?.memberOf,
              config,
            );
            return {
              ...user,
              roles: authorization.roleLabels,
              permissions: authorization.permissions,
            };
          } catch (error) {
            return {
              ...user,
              roles: [],
              permissions: [],
              permissionError: error.message,
            };
          }
        }),
      );

      res.json(enrichedUsers);
    } catch (error) {
      console.error("Benutzer konnten nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Abrufen der Benutzer" });
    }
  },
);

app.get(
  "/api/rights/group-mappings",
  requireLogin,
  requirePermission("manage_users"),
  async (_req, res) => {
    try {
      const availableGroups = await fetchDirectoryGroups();
      const roleOptions = getRoleOptions();

      res.json({
        mappings: config.rights?.groupMappings || [],
        roleOptions,
        availableGroups,
      });
    } catch (error) {
      console.error("Gruppenmappings konnten nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Laden der Gruppenmappings" });
    }
  },
);

app.put(
  "/api/rights/group-mappings",
  requireLogin,
  requirePermission("manage_users"),
  async (req, res) => {
    try {
      const incomingMappings = Array.isArray(req.body?.mappings)
        ? req.body.mappings
        : [];
      const allowedRoles = new Set(getRoleOptions().map((role) => role.name));

      const sanitizedMappings = incomingMappings
        .map((mapping) => {
          const groupName = normalizeString(mapping.groupName);
          const groupDN = normalizeString(mapping.groupDN);
          const roles = toArray(mapping.roles)
            .map((role) => normalizeString(role))
            .filter((role) => allowedRoles.has(role));

          if (!groupName && !groupDN) {
            return null;
          }

          if (roles.length === 0) {
            return null;
          }

          return {
            ...(groupName ? { groupName } : {}),
            ...(groupDN ? { groupDN } : {}),
            roles,
          };
        })
        .filter(Boolean);

      config.rights = config.rights || {};
      config.rights.groupMappings = sanitizedMappings;
      saveConfig();

      res.json({
        ok: true,
        mappings: config.rights.groupMappings,
      });
    } catch (error) {
      console.error("Gruppenmappings konnten nicht gespeichert werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Speichern der Gruppenmappings" });
    }
  },
);

app.get(
  "/api/damage-cases",
  requireLogin,
  requireAnyPermission(["view_own_cases", "view_all_cases"]),
  async (req, res) => {
    try {
      const requestedScope = req.query.scope || "own";

      // Determine actual applied scope based on permissions
      let appliedScope = "own";
      if (
        requestedScope === "all" &&
        rights.hasPermission(req.session.user, "view_all_cases")
      ) {
        appliedScope = "all";
      } else if (
        requestedScope === "department" &&
        rights.hasPermission(req.session.user, "view_all_cases")
      ) {
        // we use view_all_cases to allow department view, as manager role implies view_all_cases
        appliedScope = "department";
      }

      const includeAll = appliedScope === "all";
      const department =
        appliedScope === "department" ? req.session.user.dienststelle : null;

      const damageCases = await db.listDamageCases({
        ownerUsername: req.session.user.username,
        includeAll,
        department,
        roles: req.session.user.roles,
      });

      const items = damageCases
        .filter(
          (damageCase) =>
            rights.canViewCase(req.session.user, damageCase) ||
            (appliedScope === "department" &&
              damageCase.dienststelle === req.session.user.dienststelle),
        )
        .map((damageCase) => withCasePermissions(req.session.user, damageCase));

      res.json({
        items,
        appliedScope: includeAll ? "all" : "own",
        canViewAll: rights.hasPermission(req.session.user, "view_all_cases"),
        canCreate: rights.hasPermission(req.session.user, "create_case"),
      });
    } catch (error) {
      console.error("Schadensfaelle konnten nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Abrufen der Schadensfaelle" });
    }
  },
);

app.get(
  "/api/damage-cases/:id",
  requireLogin,
  requireAnyPermission(["view_own_cases", "view_all_cases"]),
  async (req, res) => {
    try {
      const damageCase = await fetchDamageCaseOr404(req, res);
      if (!damageCase) {
        return;
      }

      if (!rights.canViewCase(req.session.user, damageCase)) {
        res
          .status(403)
          .json({ error: "Keine Berechtigung fuer diesen Schadensfall" });
        return;
      }

      res.json(withCasePermissions(req.session.user, damageCase));
    } catch (error) {
      console.error("Schadensfall konnte nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Laden des Schadensfalls" });
    }
  },
);

app.post(
  "/api/damage-cases",
  requireLogin,
  requirePermission("create_case"),
  async (req, res) => {
    try {
      const payload = sanitizeDamageCaseInput(req.body);
      payload.createdBy = req.session.user.username;
      payload.assignedTo =
        payload.assignedTo ||
        req.session.user.displayName ||
        req.session.user.username;
      payload.dienststelle = req.session.user.dienststelle || "";

      // Workflow logic: if costs are complete, move to Team
      if (payload.costsComplete) {
        if (!hasValidCostsCompletePrerequisites(payload)) {
          res.status(400).json({
            error:
              "Kosten komplett erfasst kann erst gesetzt werden, wenn Verursacher, Versicherung, Kasse, Unfallort, Kennzeichen und Kosten vorhanden sind",
          });
          return;
        }
        payload.status = "Team";
      } else {
        payload.status = "Neu";
      }

      if (payload.cashDesk) {
        const isValidCashDesk = await db.hasActiveCashDesk(payload.cashDesk);
        if (!isValidCashDesk) {
          res.status(400).json({
            error: "Bitte eine gueltige Kasse aus dem Katalog waehlen",
          });
          return;
        }
      }

      const damageCase = await db.createDamageCase(payload);
      res.status(201).json(withCasePermissions(req.session.user, damageCase));
    } catch (error) {
      console.error("Schadensfall konnte nicht angelegt werden", error);
      res.status(500).json({ error: "Fehler beim Anlegen des Schadensfalls" });
    }
  },
);

app.put(
  "/api/damage-cases/:id",
  requireLogin,
  requireAnyPermission(["edit_own_cases", "edit_team_cases", "approve_case"]),
  async (req, res) => {
    try {
      const existingDamageCase = await fetchDamageCaseOr404(req, res);
      if (!existingDamageCase) {
        return;
      }

      if (!rights.canEditCase(req.session.user, existingDamageCase)) {
        res
          .status(403)
          .json({ error: "Keine Bearbeitungsrechte fuer diesen Schadensfall" });
        return;
      }

      const payload = sanitizeDamageCaseInput(req.body);
      payload.assignedTo = payload.assignedTo || existingDamageCase.assignedTo;
      const wantsForwardToLeitung = normalizeBoolean(req.body.forwardToLeitung);
      const wantsApprove = normalizeBoolean(req.body.approve);
      const costsLocked = existingDamageCase.costsComplete === true;

      if (
        costsLocked &&
        hasLockedCostFieldChanges(existingDamageCase, payload)
      ) {
        res.status(400).json({
          error:
            "Kosten koennen nach 'Kosten komplett erfasst' nicht mehr bearbeitet werden",
        });
        return;
      }

      // Workflow logic
      const wantsToMarkCostsComplete =
        payload.costsComplete && !existingDamageCase.costsComplete;

      if (
        wantsToMarkCostsComplete &&
        !hasValidCostsCompletePrerequisites(payload)
      ) {
        res.status(400).json({
          error:
            "Kosten komplett erfasst kann erst gesetzt werden, wenn Verursacher, Versicherung, Kasse, Unfallort, Kennzeichen und Kosten vorhanden sind",
        });
        return;
      }

      if (payload.costsComplete && existingDamageCase.status === "Neu") {
        payload.status = "Team";
      } else if (
        wantsForwardToLeitung &&
        rights.hasPermission(req.session.user, "forward_to_leitung")
      ) {
        if (!(existingDamageCase.costsComplete || payload.costsComplete)) {
          res.status(400).json({
            error:
              "Weiterleitung an Leitung erst moeglich, wenn 'Kosten komplett erfasst' gesetzt ist",
          });
          return;
        }

        payload.costsComplete = true;
        payload.status = "Leitung";
      } else if (
        wantsApprove &&
        rights.hasPermission(req.session.user, "approve_case")
      ) {
        payload.status = "Abgeschlossen";
      } else {
        payload.status = payload.status || existingDamageCase.status;
      }

      if (payload.cashDesk) {
        const isValidCashDesk = await db.hasActiveCashDesk(payload.cashDesk);
        if (!isValidCashDesk) {
          res.status(400).json({
            error: "Bitte eine gueltige Kasse aus dem Katalog waehlen",
          });
          return;
        }
      }

      const updatedDamageCase = await db.updateDamageCase(
        req.params.id,
        payload,
      );
      res.json(withCasePermissions(req.session.user, updatedDamageCase));
    } catch (error) {
      console.error("Schadensfall konnte nicht aktualisiert werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren des Schadensfalls" });
    }
  },
);

// Catalog Endpoints
app.get("/api/catalog", requireLogin, async (_req, res) => {
  try {
    const items = await db.listCatalogItems(true);
    res.json(items);
  } catch (error) {
    console.error("Katalog konnte nicht geladen werden", error);
    res.status(500).json({ error: "Fehler beim Laden des Katalogs" });
  }
});

app.get(
  "/api/admin/catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  async (_req, res) => {
    try {
      const items = await db.listCatalogItems(false);
      res.json(items);
    } catch (error) {
      console.error("Katalog konnte nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Laden des Katalogs" });
    }
  },
);

app.get("/api/insurance-catalog", requireLogin, async (_req, res) => {
  try {
    const items = await db.listInsuranceCatalogEntries(true);
    res.json(items);
  } catch (error) {
    console.error("Versicherungs-Katalog konnte nicht geladen werden", error);
    res
      .status(500)
      .json({ error: "Fehler beim Laden des Versicherungs-Katalogs" });
  }
});

app.get("/api/cash-desks", requireLogin, async (_req, res) => {
  try {
    const items = await db.listCashDeskEntries(true);
    res.json(items);
  } catch (error) {
    console.error("Kassen-Katalog konnte nicht geladen werden", error);
    res.status(500).json({ error: "Fehler beim Laden des Kassen-Katalogs" });
  }
});

app.get(
  "/api/admin/insurance-catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  async (_req, res) => {
    try {
      const items = await db.listInsuranceCatalogEntries(false);
      res.json(items);
    } catch (error) {
      console.error("Versicherungs-Katalog konnte nicht geladen werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Laden des Versicherungs-Katalogs" });
    }
  },
);

app.get(
  "/api/admin/cash-desks",
  requireLogin,
  requirePermission("manage_catalog"),
  async (_req, res) => {
    try {
      const items = await db.listCashDeskEntries(false);
      res.json(items);
    } catch (error) {
      console.error("Kassen-Katalog konnte nicht geladen werden", error);
      res.status(500).json({ error: "Fehler beim Laden des Kassen-Katalogs" });
    }
  },
);

app.post(
  "/api/admin/insurance-catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        name: normalizeString(req.body.name),
        contactPerson: normalizeString(req.body.contactPerson),
        phone: normalizeString(req.body.phone),
        email: normalizeString(req.body.email),
        street: normalizeString(req.body.street),
        zipCode: normalizeString(req.body.zipCode),
        city: normalizeString(req.body.city),
        country: normalizeString(req.body.country) || "Deutschland",
        description: normalizeString(req.body.description),
        createdBy: req.session.user.username,
      };

      if (!item.name) {
        res.status(400).json({ error: "Versicherungsname erforderlich" });
        return;
      }

      const newItem = await db.createInsuranceCatalogEntry(item);
      res.status(201).json(newItem);
    } catch (error) {
      console.error(
        "Versicherungs-Eintrag konnte nicht erstellt werden",
        error,
      );
      res
        .status(500)
        .json({ error: "Fehler beim Erstellen des Versicherungs-Eintrags" });
    }
  },
);

app.put(
  "/api/admin/insurance-catalog/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        name: normalizeString(req.body.name),
        contactPerson: normalizeString(req.body.contactPerson),
        phone: normalizeString(req.body.phone),
        email: normalizeString(req.body.email),
        street: normalizeString(req.body.street),
        zipCode: normalizeString(req.body.zipCode),
        city: normalizeString(req.body.city),
        country: normalizeString(req.body.country) || "Deutschland",
        description: normalizeString(req.body.description),
        active: req.body.active !== false,
      };

      if (!item.name) {
        res.status(400).json({ error: "Versicherungsname erforderlich" });
        return;
      }

      const updatedItem = await db.updateInsuranceCatalogEntry(
        req.params.id,
        item,
      );
      res.json(updatedItem);
    } catch (error) {
      console.error(
        "Versicherungs-Eintrag konnte nicht aktualisiert werden",
        error,
      );
      res.status(500).json({
        error: "Fehler beim Aktualisieren des Versicherungs-Eintrags",
      });
    }
  },
);

app.delete(
  "/api/admin/insurance-catalog/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      await db.deleteInsuranceCatalogEntry(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error(
        "Versicherungs-Eintrag konnte nicht gelöscht werden",
        error,
      );
      res
        .status(500)
        .json({ error: "Fehler beim Löschen des Versicherungs-Eintrags" });
    }
  },
);

app.post(
  "/api/admin/cash-desks",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        name: normalizeString(req.body.name),
        createdBy: req.session.user.username,
      };

      if (!item.name) {
        res.status(400).json({ error: "Kassenbezeichnung erforderlich" });
        return;
      }

      const newItem = await db.createCashDeskEntry(item);
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Kassen-Eintrag konnte nicht erstellt werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Erstellen des Kassen-Eintrags" });
    }
  },
);

app.put(
  "/api/admin/cash-desks/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        name: normalizeString(req.body.name),
        active: req.body.active !== false,
      };

      if (!item.name) {
        res.status(400).json({ error: "Kassenbezeichnung erforderlich" });
        return;
      }

      const updatedItem = await db.updateCashDeskEntry(req.params.id, item);
      res.json(updatedItem);
    } catch (error) {
      console.error("Kassen-Eintrag konnte nicht aktualisiert werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren des Kassen-Eintrags" });
    }
  },
);

app.delete(
  "/api/admin/cash-desks/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      await db.deleteCashDeskEntry(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Kassen-Eintrag konnte nicht gelöscht werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Löschen des Kassen-Eintrags" });
    }
  },
);

app.post(
  "/api/admin/catalog",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        bezeichnung: normalizeString(req.body.bezeichnung),
        beschreibung: normalizeString(req.body.beschreibung),
        kategorie: normalizeString(req.body.kategorie) || "Sonstiges",
        einheit: normalizeString(req.body.einheit) || "Stück",
        satz: parseFloat(req.body.satz || 0),
        erstellt_von: req.session.user.username,
      };

      if (!item.bezeichnung || item.satz <= 0) {
        res.status(400).json({ error: "Bezeichnung und Satz erforderlich" });
        return;
      }

      const newItem = await db.createCatalogItem(item);
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Katalogitem konnte nicht erstellt werden", error);
      res.status(500).json({ error: "Fehler beim Erstellen des Katalogitems" });
    }
  },
);

app.put(
  "/api/admin/catalog/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      const item = {
        bezeichnung: normalizeString(req.body.bezeichnung),
        beschreibung: normalizeString(req.body.beschreibung),
        kategorie: normalizeString(req.body.kategorie) || "Sonstiges",
        einheit: normalizeString(req.body.einheit) || "Stück",
        satz: parseFloat(req.body.satz || 0),
        aktiv: req.body.aktiv !== false,
      };

      if (!item.bezeichnung || item.satz <= 0) {
        res.status(400).json({ error: "Bezeichnung und Satz erforderlich" });
        return;
      }

      const updatedItem = await db.updateCatalogItem(req.params.id, item);
      res.json(updatedItem);
    } catch (error) {
      console.error("Katalogitem konnte nicht aktualisiert werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren des Katalogitems" });
    }
  },
);

app.delete(
  "/api/admin/catalog/:id",
  requireLogin,
  requirePermission("manage_catalog"),
  async (req, res) => {
    try {
      await db.deleteCatalogItem(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Katalogitem konnte nicht gelöscht werden", error);
      res.status(500).json({ error: "Fehler beim Löschen des Katalogitems" });
    }
  },
);

app.get(
  "/api/damage-cases/:id/catalog-items",
  requireLogin,
  requireAnyPermission(["view_own_cases", "view_all_cases"]),
  async (req, res) => {
    try {
      const damageCase = await fetchDamageCaseOr404(req, res);
      if (!damageCase) {
        return;
      }

      if (!rights.canViewCase(req.session.user, damageCase)) {
        res
          .status(403)
          .json({ error: "Keine Berechtigung für diesen Schadensfall" });
        return;
      }

      const items = await db.getCatalogItemsForCase(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Katalogpositionen konnten nicht geladen werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Laden der Katalogpositionen" });
    }
  },
);

app.post(
  "/api/damage-cases/:id/catalog-items",
  requireLogin,
  requireAnyPermission(["edit_own_cases", "edit_team_cases"]),
  async (req, res) => {
    try {
      const damageCase = await fetchDamageCaseOr404(req, res);
      if (!damageCase) {
        return;
      }

      if (!rights.canEditCase(req.session.user, damageCase)) {
        res
          .status(403)
          .json({ error: "Keine Bearbeitungsrechte für diesen Schadensfall" });
        return;
      }

      if (damageCase.costsComplete) {
        res.status(400).json({
          error: "Kostenpositionen koennen nicht mehr bearbeitet werden",
        });
        return;
      }

      const catalogId = normalizeString(req.body.catalogId);
      const menge = parseFloat(req.body.menge || 1);

      if (!catalogId || menge <= 0) {
        res.status(400).json({ error: "Katalog-ID und Menge erforderlich" });
        return;
      }

      const position = await db.addCatalogItemToCase(
        req.params.id,
        catalogId,
        menge,
      );
      res.status(201).json(position);
    } catch (error) {
      console.error("Katalogposition konnte nicht hinzugefügt werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Hinzufügen der Katalogposition" });
    }
  },
);

app.delete(
  "/api/damage-cases/:id/catalog-items/:posId",
  requireLogin,
  requireAnyPermission(["edit_own_cases", "edit_team_cases"]),
  async (req, res) => {
    try {
      const damageCase = await fetchDamageCaseOr404(req, res);
      if (!damageCase) {
        return;
      }

      if (!rights.canEditCase(req.session.user, damageCase)) {
        res
          .status(403)
          .json({ error: "Keine Bearbeitungsrechte für diesen Schadensfall" });
        return;
      }

      if (damageCase.costsComplete) {
        res.status(400).json({
          error: "Kostenpositionen koennen nicht mehr bearbeitet werden",
        });
        return;
      }

      await db.removeCatalogItemFromCase(req.params.posId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Katalogposition konnte nicht entfernt werden", error);
      res
        .status(500)
        .json({ error: "Fehler beim Entfernen der Katalogposition" });
    }
  },
);

// Database Configuration API endpoints
app.get(
  "/api/db-config",
  requireLogin,
  requirePermission("manage_users"),
  (_req, res) => {
    try {
      const mainDb = db.getDbConfig("main");
      const dummyDb = db.getDbConfig("dummy");

      // Do not expose passwords
      res.json({
        mainDb: {
          host: mainDb.host || "",
          port: mainDb.port || 5432,
          database: mainDb.database || "",
          user: mainDb.user || "",
        },
        dummyDb: {
          host: dummyDb.host || "",
          port: dummyDb.port || 5432,
          database: dummyDb.database || "",
          user: dummyDb.user || "",
        },
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der DB-Konfiguration", error);
      res.status(500).json({ error: "Fehler beim Abrufen der Konfiguration" });
    }
  },
);

app.put(
  "/api/db-config",
  requireLogin,
  requirePermission("manage_users"),
  (req, res) => {
    try {
      const scope = String(req.body?.scope || "main");
      const newConfig = req.body?.config || {};

      if (!["main", "dummy"].includes(scope)) {
        res.status(400).json({ error: "Ungültiger Scope (main oder dummy)" });
        return;
      }

      if (
        !newConfig.host ||
        !newConfig.database ||
        !newConfig.user ||
        newConfig.password === undefined
      ) {
        res.status(400).json({ error: "Alle Felder sind erforderlich" });
        return;
      }

      const configKey = scope === "dummy" ? "dummyDb" : "db";
      config[configKey] = {
        host: String(newConfig.host).trim(),
        port: parseInt(newConfig.port, 10) || 5432,
        database: String(newConfig.database).trim(),
        user: String(newConfig.user).trim(),
        password: String(newConfig.password),
      };

      saveConfig();

      // Reset pools to pick up new config on next request
      db.resetPoolsForScope(scope);

      res.json({
        ok: true,
        message: `${scope === "dummy" ? "Dummy-" : "Produktiv-"}Datenbank konfiguriert`,
      });
    } catch (error) {
      console.error("Fehler beim Speichern der DB-Konfiguration", error);
      res
        .status(500)
        .json({ error: "Fehler beim Speichern der Konfiguration" });
    }
  },
);

app.post(
  "/api/db-config/test",
  requireLogin,
  requirePermission("manage_users"),
  async (req, res) => {
    try {
      const testConfig = req.body?.config || {};
      const scope = String(req.body?.scope || "main");

      if (
        !testConfig.host ||
        !testConfig.database ||
        !testConfig.user ||
        testConfig.password === undefined
      ) {
        res.status(400).json({ error: "Alle Felder sind erforderlich" });
        return;
      }

      const { Pool } = await import("pg");
      const testPool = new Pool({
        user: String(testConfig.user).trim(),
        password: String(testConfig.password),
        host: String(testConfig.host).trim(),
        port: parseInt(testConfig.port, 10) || 5432,
        database: String(testConfig.database).trim(),
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 500,
      });

      try {
        await testPool.query("SELECT 1");
        await testPool.end();
        res.json({ ok: true, message: "Verbindung erfolgreich" });
      } catch (poolError) {
        await testPool.end().catch(() => {});
        throw poolError;
      }
    } catch (error) {
      console.error("DB-Verbindungstest fehlgeschlagen", error);
      let errorMessage = "Verbindung fehlgeschlagen";
      if (error.code === "ENOTFOUND") {
        errorMessage = "Host nicht gefunden";
      } else if (error.code === "ECONNREFUSED") {
        errorMessage = "Verbindung verweigert";
      } else if (error.message?.includes("password")) {
        errorMessage = "Benutzer oder Passwort falsch";
      }
      res.status(500).json({ error: errorMessage });
    }
  },
);

app.get(
  "/db-config",
  requireLogin,
  requirePermission("manage_users"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/db-config.html"));
  },
);

async function connectDatabaseWithRetry() {
  const retryDelayMs = 15000;

  try {
    await db.connect();
    console.log("Datenbankverbindung hergestellt.");
  } catch (error) {
    console.error(
      `Datenbank nicht erreichbar (${error.code || "DB_ERROR"}). Neuer Versuch in ${retryDelayMs / 1000}s.`,
    );
    setTimeout(connectDatabaseWithRetry, retryDelayMs);
  }
}

function start() {
  const certPath = "/etc/lbm/ssl/privkey.pem";
  const fullchainPath = "/etc/lbm/ssl/fullchain.pem";

  const hasCerts = fs.existsSync(certPath);

  if (hasCerts) {
    const sslOptions = {
      key: fs.readFileSync(certPath),
      cert: fs.readFileSync(fullchainPath),
    };

    https.createServer(sslOptions, app).listen(config.server.port, () => {
      console.log(
        `SaS3 Login running on https://localhost:${config.server.port} (HTTPS ohne Client-Zertifikat)`,
      );
      connectDatabaseWithRetry();
    });
  } else {
    http.createServer(app).listen(config.server.port, () => {
      console.log(
        `SaS3 Login running on http://localhost:${config.server.port}`,
      );
      connectDatabaseWithRetry();
    });
  }
}

start();
