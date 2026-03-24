const express = require("express");
const fs = require("fs");
const path = require("path");
const ldap = require("ldapjs");
const session = require("express-session");
const db = require("./src/db");
const rights = require("./src/rights");

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

function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }

  res.redirect("/");
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

function createClient() {
  return ldap.createClient({
    url: config.ldap.url,
    timeout: 8000,
    connectTimeout: 8000,
    tlsOptions: config.ldap.tlsOptions,
  });
}

function ldapBind(client, dn, password) {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function ldapUnbind(client) {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

function ldapSearch(client, baseDN, options) {
  return new Promise((resolve, reject) => {
    const entries = [];

    client.search(baseDN, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      result.on("searchEntry", (entry) => entries.push(entry.object));
      result.on("error", reject);
      result.on("end", () => resolve(entries));
    });
  });
}

async function fetchDirectoryUser(username) {
  const serviceClient = createClient();

  try {
    await ldapBind(serviceClient, config.ldap.bindDN, config.ldap.bindPassword);
    const escapedUser = ldap.escapeFilter(username);
    const filter = config.ldap.userFilter.replace("{{username}}", escapedUser);
    const results = await ldapSearch(serviceClient, config.ldap.baseDN, {
      scope: "sub",
      filter,
      attributes: [
        "dn",
        "memberOf",
        "mail",
        "givenName",
        "sn",
        "displayName",
        "cn",
        "sAMAccountName",
      ],
    });

    return results[0] || null;
  } finally {
    await ldapUnbind(serviceClient);
  }
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

  return {
    username,
    displayName,
    email,
    firstName,
    lastName,
    groups: authorization.groups,
    roles: authorization.roles,
    roleLabels: authorization.roleLabels,
    permissions: authorization.permissions,
    isAdmin: authorization.permissions.includes("manage_users"),
  };
}

async function authenticate(username, password) {
  if (!username || !password) {
    return { ok: false, reason: "missing" };
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

  const userClient = createClient();
  try {
    await ldapBind(userClient, directoryUser.dn, password);
  } catch (_error) {
    await ldapUnbind(userClient);
    return { ok: false, reason: "invalid" };
  }

  await ldapUnbind(userClient);

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

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
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

app.post("/login", async (req, res) => {
  try {
    const username = normalizeString(req.body.username);
    const password = req.body.password;
    const result = await authenticate(username, password);

    if (!result.ok) {
      res
        .status(403)
        .send(
          '<h2>Zugriff verweigert</h2><p>Bitte pruefen Sie Ihre Zugangsdaten und Gruppenrechte.</p><a href="/">Zurueck zur Anmeldung</a>',
        );
      return;
    }

    req.session.user = result.user;
    await db.upsertUser(result.user);
    res.redirect("/overview");
  } catch (error) {
    console.error("Login fehlgeschlagen", error);
    res
      .status(500)
      .send(
        '<h2>Fehler</h2><p>Die Anmeldung ist derzeit nicht moeglich.</p><a href="/">Zurueck zur Anmeldung</a>',
      );
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).send("Logout fehlgeschlagen.");
      return;
    }

    res.redirect("/");
  });
});

app.get("/api/me", (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
    return;
  }

  res.status(401).json({ error: "Nicht angemeldet" });
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
      const requestedScope = req.query.scope === "all" ? "all" : "own";
      const includeAll =
        requestedScope === "all" &&
        rights.hasPermission(req.session.user, "view_all_cases");
      const damageCases = await db.listDamageCases({
        ownerUsername: req.session.user.username,
        includeAll,
      });

      const items = damageCases
        .filter((damageCase) =>
          rights.canViewCase(req.session.user, damageCase),
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
  requireAnyPermission(["edit_own_cases", "edit_all_cases"]),
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
  app.listen(config.server.port, () => {
    console.log(`SaS3 Login running on http://localhost:${config.server.port}`);
    connectDatabaseWithRetry();
  });
}

start();
