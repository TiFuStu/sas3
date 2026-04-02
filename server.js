const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");
const https = require("https");
const db = require("./src/db");
const rights = require("./src/rights");
const LDAPSearch = require("./src/LDAPSearch");

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

const configPath = path.join(__dirname, "/config/config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

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

app.use("/src", express.static(path.join(__dirname, "src")));

app.use(async (req, res, next) => {
  try {
    if (req.path.startsWith("/src") || req.path.match(/\.(css|png|js|ico)$/)) {
      return next();
    }

    const clientCert = req.socket.getPeerX509Certificate
      ? req.socket.getPeerX509Certificate()
      : null;
    let username = null;
    if (clientCert && clientCert.subjectAltName) {
      const match = /othername:UPN:([^\@]+)/.exec(clientCert.subjectAltName);
      if (match) username = match[1];
    }
    if (!username) {
      const cert = req.socket.getPeerCertificate
        ? req.socket.getPeerCertificate()
        : null;
      if (cert && cert.subject) {
        if (cert.subject.emailAddress)
          username = cert.subject.emailAddress.split("@")[0];
        else if (cert.subject.CN && cert.subject.CN.includes("@"))
          username = cert.subject.CN.split("@")[0];
        if (!username && cert.subjectaltname) {
          const match = cert.subjectaltname.match(/email:([^,\s@]+)/);
          if (match) username = match[1];
        }
      }
    }

    // For local development with testUsers (will only be hit if rejectUnauthorized=false)
    if (!username && req.query.testuser) {
      username = req.query.testuser;
    }

    if (!username) return next();

    if (req.session.user && req.session.user.username === username) {
      return next();
    }

    const result = await authenticate(username);
    if (result.ok) {
      req.session.user = result.user;
      try {
        await db.upsertUser(result.user);
      } catch (dbError) {
        console.error("SSO DB Error:", dbError.message);
      }
    }
  } catch (err) {
    console.error("SSO error", err);
  }
  next();
});

function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Nicht angemeldet über SSO" });
    return;
  }

  res
    .status(403)
    .send(
      "<h2>Zugriff verweigert</h2><p>Es konnte keine gültige Anmeldung über das Client-Zertifikat durchgeführt werden.</p>",
    );
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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function buildSessionUser(username, directoryUser, authorization) {
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
  };
}

async function authenticate(username) {
  if (!username) {
    return { ok: false, reason: "missing" };
  }

  // Check for test users configured in config.json
  const testUser = (config.testUsers || []).find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );

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
    };

    const authorization = rights.resolveAuthorization(
      directoryUser.memberOf,
      config,
    );
    return {
      ok: true,
      directoryUser,
      authorization,
      user: buildSessionUser(username, directoryUser, authorization),
    };
  }

  const directoryUser = await fetchDirectoryUser(username);

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
    user: buildSessionUser(username, directoryUser, authorization),
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
    cashDesk: normalizeString(body.cashDesk),
    otherCosts: normalizeNumberString(body.otherCosts),
    openClaimAmount: normalizeNumberString(body.openClaimAmount),
    costsComplete:
      body.costsComplete === true ||
      body.costsComplete === "true" ||
      body.costsComplete === "on" ||
      body.costsComplete === 1 ||
      body.costsComplete === "1",
    assignedTo: normalizeString(body.assignedTo),
    followUpDate: normalizeString(body.followUpDate),
    requiredWorks: normalizeRequiredWorks(body.requiredWorks),
  };
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

app.get("/", requireLogin, (_req, res) => {
  res.redirect("/overview");
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

    res
      .status(200)
      .send(
        "<h2>Abgemeldet</h2><p>Aufgrund von Single Sign-On (SSO) sind Sie weiterhin über Ihr Windows-Zertifikat mit dem System verbunden. Schließen Sie Ihren Browser, um die Sitzung vollständig zu beenden.</p>",
      );
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

app.get("/api/lookup/street", requireLogin, (req, res) => {
  const street = req.query.street;
  const data = STREET_DATA[street];
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: "Straße nicht gefunden" });
  }
});

app.get(
  "/users",
  requireLogin,
  requirePermission("manage_users"),
  (_req, res) => {
    res.sendFile(path.join(__dirname, "/public/users.html"));
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
        req.session.user.kurzel ||
        req.session.user.username;
      payload.dienststelle = req.session.user.dienststelle || "";

      // Workflow logic: if costs are complete, move to Team
      if (payload.costsComplete) {
        payload.status = "Team";
      } else {
        payload.status = "Neu";
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

      // Workflow logic
      if (payload.costsComplete && existingDamageCase.status === "Neu") {
        payload.status = "Team";
      } else if (
        req.body.forwardToLeitung &&
        rights.hasPermission(req.session.user, "forward_to_leitung")
      ) {
        payload.status = "Leitung";
      } else if (
        req.body.approve &&
        rights.hasPermission(req.session.user, "approve_case")
      ) {
        payload.status = "Abgeschlossen";
      } else {
        payload.status = payload.status || existingDamageCase.status;
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
  const sslOptions = {
    key: fs.readFileSync("/etc/lbm/ssl/privkey.pem"),
    cert: fs.readFileSync("/etc/lbm/ssl/fullchain.pem"),
    ca: fs.readFileSync("/etc/lbm/ssl/confirm-user-ca.pem"),
    requestCert: true,
    rejectUnauthorized: true,
  };

  https.createServer(sslOptions, app).listen(config.server.port, () => {
    console.log(
      `SaS3 Login running on https://localhost:${config.server.port}`,
    );
    connectDatabaseWithRetry();
  });
}

start();
