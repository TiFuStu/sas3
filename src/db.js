const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { AsyncLocalStorage } = require("node:async_hooks");
const dbHelper = require("./utils/dbHelper");

const configPath = path.join(__dirname, "..", "config/config.json");
const poolPromises = new Map();
const schemaPromises = new Map();
const dbScopeStorage = new AsyncLocalStorage();

function getActiveScope() {
  return dbScopeStorage.getStore()?.scope || "main";
}

function runWithScope(scope, fn) {
  const normalizedScope = scope === "dummy" ? "dummy" : "main";
  return dbScopeStorage.run({ scope: normalizedScope }, fn);
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error("config.json k\u00f6nnte nicht geladen werden.");
  }
}

function getPoolConfig(scope = getActiveScope()) {
  const config = loadConfig();
  const dbConfig =
    scope === "dummy"
      ? config.dummyDb || null
      : config.db || null;

  if (!dbConfig || !dbConfig.database) {
    throw new Error(
      scope === "dummy"
        ? "dummyDb ist nicht konfiguriert. Bitte config.json anpassen."
        : "db ist nicht konfiguriert. Bitte config.json anpassen.",
    );
  }

  return {
    user: dbConfig.user,
    password: dbConfig.password,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

async function ensureCoreSchema(scope = getActiveScope()) {
  if (!schemaPromises.has(scope)) {
    const schemaPromise = (async () => {
      const pool = await getPoolPromise(scope);
      const schemaSql = `
                CREATE TABLE IF NOT EXISTS "SYSBENUTZER" (
                    "BENID" VARCHAR(100) NOT NULL PRIMARY KEY,
                    "BENADUID" VARCHAR(100) NOT NULL,
                    "BENSASXUSER" VARCHAR(100) NOT NULL,
                    "BENVORNAME" VARCHAR(100) NULL,
                    "BENNACHNAME" VARCHAR(100) NULL,
                    "BENKUERZEL" VARCHAR(20) NULL,
                    "BENMAIL" VARCHAR(255) NULL,
                    "BENANZEIGENAME" VARCHAR(255) NULL,
                    "BENDIENSTSTELLE" VARCHAR(100) NULL,
                    "BENAKTUALISIERTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                -- Adding columns gracefully
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSBENUTZER' AND column_name='BENVORNAME') THEN
                        ALTER TABLE "SYSBENUTZER" ADD COLUMN "BENVORNAME" VARCHAR(100) NULL; 
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSBENUTZER' AND column_name='BENNACHNAME') THEN
                        ALTER TABLE "SYSBENUTZER" ADD COLUMN "BENNACHNAME" VARCHAR(100) NULL; 
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSBENUTZER' AND column_name='BENKUERZEL') THEN
                        ALTER TABLE "SYSBENUTZER" ADD COLUMN "BENKUERZEL" VARCHAR(20) NULL; 
                    END IF;
                    -- ... others omitted for brevity in manual add as the CREATE TABLE IF NOT EXISTS already handles the core properties or you can use standard ALTER scripts
                END $$;

                CREATE TABLE IF NOT EXISTS "DATSCHADENSFAELLE" (
                    "SFAID" VARCHAR(80) NOT NULL PRIMARY KEY,
                    "SFANUMMER" VARCHAR(20) NOT NULL,
                    "SFAGILTAB" VARCHAR(8) NOT NULL,
                    "SFAGILTBIS" VARCHAR(8) NOT NULL DEFAULT '99999999',
                    "SFADELDAT" VARCHAR(14) NULL,
                    "SFASTATUS" VARCHAR(50) NOT NULL DEFAULT 'Neu',
                    "SFABETREFF" VARCHAR(255) NULL,
                    "SFABEZEICHNUNG" VARCHAR(255) NULL,
                    "SFADATUM" VARCHAR(10) NULL,
                    "SFABESCHREIBUNG" TEXT NULL,
                    "SFASTRASSE" VARCHAR(120) NULL,
                    "SFAABSCHNITTVON" VARCHAR(50) NULL,
                    "SFAABSCHNITTBIS" VARCHAR(50) NULL,
                    "SFARICHTUNG" VARCHAR(120) NULL,
                    "SFAKMSTATION" VARCHAR(30) NULL,
                    "SFALANDKREIS" VARCHAR(120) NULL,
                    "SFAKENNZEICHEN" VARCHAR(30) NULL,
                    "SFAZULASSUNGSSTELLE" VARCHAR(120) NULL,
                    "SFAVERURSACHER" VARCHAR(255) NULL,
                    "SFAVERURSACHERADRESSE" TEXT NULL,
                    "SFAVERSICHERUNG" VARCHAR(255) NULL,
                    "SFAVERSICHERUNGSSCHEINNR" VARCHAR(100) NULL,
                    "SFAVERSICHERUNGSSCHADENNR" VARCHAR(100) NULL,
                    "SFAEMAILVERSICHERUNG" VARCHAR(255) NULL,
                    "SFARECHNUNGAN" VARCHAR(100) NULL,
                    "SFARECHNUNGTYP" VARCHAR(30) NULL,
                    "SFARECHNUNGADRESSE" TEXT NULL,
                    "SFARECHNUNGTEL" VARCHAR(50) NULL,
                    "SFARECHNUNGMAIL" VARCHAR(255) NULL,
                    "SFAKASSE" VARCHAR(100) NULL,
                    "SFASONSTIGEKOSTEN" NUMERIC(12, 2) NOT NULL DEFAULT 0,
                    "SFAOFFENEFORDERUNG" NUMERIC(12, 2) NOT NULL DEFAULT 0,
                    "SFAKOSTENKOMPLETT" BOOLEAN NOT NULL DEFAULT FALSE,
                    "SFABEARBEITER" VARCHAR(120) NULL,
                    "SFAWIEDERVORLAGEAM" VARCHAR(10) NULL,
                    "SFAERFORDERLICHEARBEITEN" TEXT NULL,
                    "SFADIENSTSTELLE" VARCHAR(100) NULL,
                    "SFAERSTELLTVON" VARCHAR(100) NOT NULL,
                    "SFAERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "SFAAENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                -- Add SFAVERURSACHERADRESSE if it doesn't exist (for existing tables)
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='DATSCHADENSFAELLE' AND column_name='SFAVERURSACHERADRESSE') THEN
                        ALTER TABLE "DATSCHADENSFAELLE" ADD COLUMN "SFAVERURSACHERADRESSE" TEXT NULL; 
                    END IF;
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='DATSCHADENSFAELLE' AND column_name='SFARECHNUNGTYP') THEN
                    ALTER TABLE "DATSCHADENSFAELLE" ADD COLUMN "SFARECHNUNGTYP" VARCHAR(30) NULL;
                  END IF;
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='DATSCHADENSFAELLE' AND column_name='SFARECHNUNGADRESSE') THEN
                    ALTER TABLE "DATSCHADENSFAELLE" ADD COLUMN "SFARECHNUNGADRESSE" TEXT NULL;
                  END IF;
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='DATSCHADENSFAELLE' AND column_name='SFARECHNUNGTEL') THEN
                    ALTER TABLE "DATSCHADENSFAELLE" ADD COLUMN "SFARECHNUNGTEL" VARCHAR(50) NULL;
                  END IF;
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='DATSCHADENSFAELLE' AND column_name='SFARECHNUNGMAIL') THEN
                    ALTER TABLE "DATSCHADENSFAELLE" ADD COLUMN "SFARECHNUNGMAIL" VARCHAR(255) NULL;
                  END IF;
                END $$;
                
                -- Ensure unique constraint on case number
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UX_DATSCHADENSFAELLE_SFANUMMER') THEN
                        ALTER TABLE "DATSCHADENSFAELLE" ADD CONSTRAINT "UX_DATSCHADENSFAELLE_SFANUMMER" UNIQUE ("SFANUMMER");
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS "SYSKATALOG" (
                    "KATID" VARCHAR(80) NOT NULL PRIMARY KEY,
                    "KATBEZEICHNUNG" VARCHAR(255) NOT NULL,
                    "KATBESCHREIBUNG" TEXT NULL,
                    "KATKATEGORIE" VARCHAR(100) NOT NULL,
                    "KATEINHEIT" VARCHAR(50) NOT NULL DEFAULT 'Stück',
                    "KATSATZ" NUMERIC(12, 2) NOT NULL,
                    "KATAKTIV" BOOLEAN NOT NULL DEFAULT TRUE,
                    "KATERSTELLTVON" VARCHAR(100) NOT NULL,
                    "KATERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "KATAEENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS "SFOKATALOGPOSITIONEN" (
                    "KATPOSID" VARCHAR(80) NOT NULL PRIMARY KEY,
                    "SFAID" VARCHAR(80) NOT NULL REFERENCES "DATSCHADENSFAELLE"("SFAID") ON DELETE CASCADE,
                    "KATID" VARCHAR(80) NOT NULL REFERENCES "SYSKATALOG"("KATID") ON DELETE CASCADE,
                    "KATPOSMENGE" NUMERIC(10, 2) NOT NULL,
                    "KATPOSGESAMTPREIS" NUMERIC(12, 2) NOT NULL,
                    "KATEINTRAG" INT NOT NULL DEFAULT 0,
                    "KATPOSHINZUGEFUEGTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "KATPOSGELOESCHTAM" TIMESTAMP NULL
                );

                CREATE INDEX IF NOT EXISTS "IDX_SFOKATALOGPOSITIONEN_SFAID" ON "SFOKATALOGPOSITIONEN"("SFAID");
                CREATE INDEX IF NOT EXISTS "IDX_SFOKATALOGPOSITIONEN_KATID" ON "SFOKATALOGPOSITIONEN"("KATID");

        CREATE TABLE IF NOT EXISTS "SYSVERSICHERUNGEN" (
          "VERSID" VARCHAR(80) NOT NULL PRIMARY KEY,
          "VERSNAME" VARCHAR(255) NOT NULL,
          "VERSANSPRECHPARTNER" VARCHAR(255) NULL,
          "VERSTELEFON" VARCHAR(50) NULL,
          "VERSMAIL" VARCHAR(255) NULL,
          "VERSSTRASSE" VARCHAR(255) NULL,
          "VERSPLZ" VARCHAR(20) NULL,
          "VERSORT" VARCHAR(120) NULL,
          "VERSLAND" VARCHAR(120) NOT NULL DEFAULT 'Deutschland',
          "VERSBESCHREIBUNG" TEXT NULL,
          "VERSAKTIV" BOOLEAN NOT NULL DEFAULT TRUE,
          "VERSERSTELLTVON" VARCHAR(100) NOT NULL,
          "VERSERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "VERSAENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSANSPRECHPARTNER') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSANSPRECHPARTNER" VARCHAR(255) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSTELEFON') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSTELEFON" VARCHAR(50) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSMAIL') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSMAIL" VARCHAR(255) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSSTRASSE') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSSTRASSE" VARCHAR(255) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSPLZ') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSPLZ" VARCHAR(20) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSORT') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSORT" VARCHAR(120) NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSLAND') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSLAND" VARCHAR(120) NOT NULL DEFAULT 'Deutschland';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSBESCHREIBUNG') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSBESCHREIBUNG" TEXT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSAKTIV') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSAKTIV" BOOLEAN NOT NULL DEFAULT TRUE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSERSTELLTVON') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSERSTELLTVON" VARCHAR(100) NOT NULL DEFAULT 'system';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSERSTELLTAM') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSVERSICHERUNGEN' AND column_name='VERSAENDERUNGAM') THEN
            ALTER TABLE "SYSVERSICHERUNGEN" ADD COLUMN "VERSAENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS "IDX_SYSVERSICHERUNGEN_VERSAKTIV" ON "SYSVERSICHERUNGEN"("VERSAKTIV");
        CREATE INDEX IF NOT EXISTS "IDX_SYSVERSICHERUNGEN_VERSNAME" ON "SYSVERSICHERUNGEN"("VERSNAME");

        CREATE TABLE IF NOT EXISTS "SYSKASSEN" (
          "KASSEID" VARCHAR(80) NOT NULL PRIMARY KEY,
          "KASSEBEZEICHNUNG" VARCHAR(255) NOT NULL,
          "KASSEAKTIV" BOOLEAN NOT NULL DEFAULT TRUE,
          "KASSEERSTELLTVON" VARCHAR(100) NOT NULL,
          "KASSEERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "KASSEAENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSKASSEN' AND column_name='KASSEAKTIV') THEN
            ALTER TABLE "SYSKASSEN" ADD COLUMN "KASSEAKTIV" BOOLEAN NOT NULL DEFAULT TRUE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSKASSEN' AND column_name='KASSEERSTELLTVON') THEN
            ALTER TABLE "SYSKASSEN" ADD COLUMN "KASSEERSTELLTVON" VARCHAR(100) NOT NULL DEFAULT 'system';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSKASSEN' AND column_name='KASSEERSTELLTAM') THEN
            ALTER TABLE "SYSKASSEN" ADD COLUMN "KASSEERSTELLTAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SYSKASSEN' AND column_name='KASSEAENDERUNGAM') THEN
            ALTER TABLE "SYSKASSEN" ADD COLUMN "KASSEAENDERUNGAM" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS "IDX_SYSKASSEN_AKTIV" ON "SYSKASSEN"("KASSEAKTIV");
        CREATE INDEX IF NOT EXISTS "IDX_SYSKASSEN_BEZEICHNUNG" ON "SYSKASSEN"("KASSEBEZEICHNUNG");
            `;
      await pool.query(schemaSql);
    })().catch((error) => {
      schemaPromises.delete(scope);
      throw error;
    });

    schemaPromises.set(scope, schemaPromise);
  }

  return schemaPromises.get(scope);
}

function getPoolPromise(scope = getActiveScope()) {
  if (!poolPromises.has(scope)) {
    poolPromises.set(scope, new Pool(getPoolConfig(scope)));
  }
  return poolPromises.get(scope);
}

async function getPool(scope = getActiveScope()) {
  const pool = getPoolPromise(scope);
  await ensureCoreSchema(scope);
  return pool;
}

function mapDamageCase(record) {
  return {
    id: record.SFAID,
    caseNumber: record.SFANUMMER,
    status: record.SFASTATUS || "Neu",
    subject: record.SFABETREFF || record.SFABEZEICHNUNG || "",
    description: record.SFABESCHREIBUNG || "",
    damageDate: record.SFADATUM || "",
    street: record.SFASTRASSE || "",
    sectionFrom: record.SFAABSCHNITTVON || "",
    sectionTo: record.SFAABSCHNITTBIS || "",
    direction: record.SFARICHTUNG || "",
    kmStation: record.SFAKMSTATION || "",
    district: record.SFALANDKREIS || "",
    plateNumber: record.SFAKENNZEICHEN || "",
    registrationOffice: record.SFAZULASSUNGSSTELLE || "",
    responsibleParty: record.SFAVERURSACHER || "",
    responsiblePartyAddress: record.SFAVERURSACHERADRESSE || "",
    insurance: record.SFAVERSICHERUNG || "",
    insurancePolicyNumber: record.SFAVERSICHERUNGSSCHEINNR || "",
    insuranceClaimNumber: record.SFAVERSICHERUNGSSCHADENNR || "",
    insuranceEmail: record.SFAEMAILVERSICHERUNG || "",
    invoiceTo: record.SFARECHNUNGAN || "",
    invoiceRecipientType: record.SFARECHNUNGTYP || "verursacher",
    invoiceAddress: record.SFARECHNUNGADRESSE || "",
    invoicePhone: record.SFARECHNUNGTEL || "",
    invoiceEmail: record.SFARECHNUNGMAIL || "",
    cashDesk: record.SFAKASSE || "",
    otherCosts: Number(record.SFASONSTIGEKOSTEN || 0),
    openClaimAmount: Number(record.SFAOFFENEFORDERUNG || 0),
    costsComplete: Boolean(record.SFAKOSTENKOMPLETT),
    assignedTo: record.SFABEARBEITER || "",
    followUpDate: record.SFAWIEDERVORLAGEAM || "",
    requiredWorks: parseRequiredWorks(record.SFAERFORDERLICHEARBEITEN),
    dienststelle: record.SFADIENSTSTELLE || "",
    createdBy: record.SFAERSTELLTVON || "",
    createdAt: record.SFAERSTELLTAM,
    updatedAt: record.SFAAENDERUNGAM,
  };
}

function parseRequiredWorks(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function createUserCode(username) {
  const cleaned = String(username || "SYS")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return (cleaned || "SYS").slice(0, 3).padEnd(3, "X");
}

async function getNextTechnicalId(pool, username, now) {
  const userCode = createUserCode(username);
  const datePart = dbHelper.formatDateIso(now);
  const timePart = dbHelper.formatDateTimeIso(now).substring(8, 14);
  const likePattern = `SFA_${userCode}_${datePart}_${timePart}_%`;

  const result = await pool.query(
    'SELECT COUNT(*) AS "recordCount" FROM "DATSCHADENSFAELLE" WHERE "SFAID" LIKE $1',
    [likePattern],
  );
  const sequence = parseInt(result.rows[0]?.recordCount || 0, 10) + 1;
  return dbHelper.generateKey("SFA", userCode, now, sequence);
}

async function getNextCaseNumber(pool, now) {
  const yearToken = String(now.getFullYear()).slice(-2);
  const likePattern = `01/${yearToken}%`;

  const result = await pool.query(
    'SELECT MAX("SFANUMMER") AS "maxNumber" FROM "DATSCHADENSFAELLE" WHERE "SFANUMMER" LIKE $1',
    [likePattern],
  );
  const maxNumber = result.rows[0]?.maxNumber;
  const currentSequence = maxNumber
    ? parseInt(String(maxNumber).slice(-4), 10)
    : 0;
  const nextSequence = Number.isFinite(currentSequence)
    ? currentSequence + 1
    : 1;

  return `01/${yearToken}${String(nextSequence).padStart(4, "0")}`;
}

async function connect() {
  return await getPool();
}

async function upsertUser(user) {
  const pool = await getPool();
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const displayName =
    user.displayName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    user.username;
  const shortCode = user.shortCode || createUserCode(user.username);

  await pool.query(
    `
        INSERT INTO "SYSBENUTZER" (
            "BENID", "BENADUID", "BENSASXUSER", "BENVORNAME", "BENNACHNAME", "BENKUERZEL", "BENMAIL", "BENANZEIGENAME", "BENDIENSTSTELLE", "BENAKTUALISIERTAM"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT ("BENID") DO UPDATE SET
            "BENSASXUSER" = EXCLUDED."BENSASXUSER",
            "BENVORNAME" = EXCLUDED."BENVORNAME",
            "BENNACHNAME" = EXCLUDED."BENNACHNAME",
            "BENKUERZEL" = EXCLUDED."BENKUERZEL",
            "BENMAIL" = EXCLUDED."BENMAIL",
            "BENANZEIGENAME" = EXCLUDED."BENANZEIGENAME",
            "BENDIENSTSTELLE" = EXCLUDED."BENDIENSTSTELLE",
            "BENAKTUALISIERTAM" = CURRENT_TIMESTAMP;
    `,
    [
      user.username,
      user.username,
      user.username,
      firstName,
      lastName,
      shortCode,
      user.email || "",
      displayName,
      user.dienststelle || "",
    ],
  );
}

async function getUsers() {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM "SYSBENUTZER" ORDER BY COALESCE("BENNACHNAME", "BENID"), COALESCE("BENVORNAME", "BENID")',
  );
  return result.rows;
}

async function createDamageCase(damageCase) {
  const pool = await getPool();
  const now = new Date();
  const technicalId = await getNextTechnicalId(pool, damageCase.createdBy, now);
  const caseNumber = await getNextCaseNumber(pool, now);

  await pool.query(
    `
        INSERT INTO "DATSCHADENSFAELLE" (
            "SFAID", "SFANUMMER", "SFAGILTAB", "SFASTATUS", "SFABETREFF", "SFABEZEICHNUNG", "SFABESCHREIBUNG", "SFADATUM", 
            "SFASTRASSE", "SFAABSCHNITTVON", "SFAABSCHNITTBIS", "SFARICHTUNG", "SFAKMSTATION", "SFALANDKREIS", 
            "SFAKENNZEICHEN", "SFAZULASSUNGSSTELLE", "SFAVERURSACHER", "SFAVERURSACHERADRESSE", "SFAVERSICHERUNG", 
            "SFAVERSICHERUNGSSCHEINNR", "SFAVERSICHERUNGSSCHADENNR", "SFAEMAILVERSICHERUNG", "SFARECHNUNGAN", "SFARECHNUNGTYP", 
            "SFARECHNUNGADRESSE", "SFARECHNUNGTEL", "SFARECHNUNGMAIL", "SFAKASSE", "SFASONSTIGEKOSTEN", 
            "SFAOFFENEFORDERUNG", "SFAKOSTENKOMPLETT", "SFABEARBEITER", "SFAWIEDERVORLAGEAM", 
            "SFAERFORDERLICHEARBEITEN", "SFADIENSTSTELLE", "SFAERSTELLTVON", "SFAERSTELLTAM", "SFAAENDERUNGAM"
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    `,
    [
      technicalId,
      caseNumber,
      dbHelper.formatDateIso(now),
      damageCase.status || "Neu",
      damageCase.subject || "",
      damageCase.subject || "",
      damageCase.description || "",
      damageCase.damageDate || "",
      damageCase.street || "",
      damageCase.sectionFrom || "",
      damageCase.sectionTo || "",
      damageCase.direction || "",
      damageCase.kmStation || "",
      damageCase.district || "",
      damageCase.plateNumber || "",
      damageCase.registrationOffice || "",
      damageCase.responsibleParty || "",
      damageCase.responsiblePartyAddress || "",
      damageCase.insurance || "",
      damageCase.insurancePolicyNumber || "",
      damageCase.insuranceClaimNumber || "",
      damageCase.insuranceEmail || "",
      damageCase.invoiceTo || "",
      damageCase.invoiceRecipientType || "verursacher",
      damageCase.invoiceAddress || "",
      damageCase.invoicePhone || "",
      damageCase.invoiceEmail || "",
      damageCase.cashDesk || "",
      parseFloat(damageCase.otherCosts || 0),
      parseFloat(damageCase.openClaimAmount || 0),
      !!damageCase.costsComplete,
      damageCase.assignedTo || "",
      damageCase.followUpDate || "",
      JSON.stringify(damageCase.requiredWorks || []),
      damageCase.dienststelle || "",
      damageCase.createdBy,
    ],
  );

  return getDamageCaseById(technicalId);
}

async function listDamageCases(options = {}) {
  const pool = await getPool();
  let query = 'SELECT * FROM "DATSCHADENSFAELLE" WHERE "SFADELDAT" IS NULL';
  const params = [];

  // Filter based on roles and options
  if (options.includeAll) {
    // No additional filter for admins
  } else {
    const roleClauses = [];

    // Erfasser: Eigenen Fälle (in Bearbeitung)
    if (options.roles?.includes("erfasser")) {
      roleClauses.push(
        `(LOWER("SFAERSTELLTVON") = LOWER($${params.length + 1}) AND "SFASTATUS" = 'Neu')`,
      );
      params.push(options.ownerUsername);
    }

    // Bearbeiter: Fälle im Team-Status (Kosten komplett) oder Abgeschlossen
    if (options.roles?.includes("bearbeiter")) {
      roleClauses.push(`"SFASTATUS" IN ('Team', 'Abgeschlossen')`);
    }

    // Leitung: Fälle im Leitung-Status oder Abgeschlossen
    if (options.roles?.includes("leitung")) {
      roleClauses.push(`"SFASTATUS" IN ('Leitung', 'Abgeschlossen')`);
    }

    if (roleClauses.length > 0) {
      query += " AND (" + roleClauses.join(" OR ") + ")";
    } else {
      // No permissions, return nothing
      query += " AND 1=0";
    }
  }

  query +=
    ' ORDER BY COALESCE("SFAAENDERUNGAM", "SFAERSTELLTAM") DESC, "SFANUMMER" DESC';

  const result = await pool.query(query, params);
  return result.rows.map(mapDamageCase);
}

async function getDamageCaseById(damageCaseId) {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM "DATSCHADENSFAELLE" WHERE "SFAID" = $1 LIMIT 1',
    [damageCaseId],
  );
  const record = result.rows[0];
  return record ? mapDamageCase(record) : null;
}

async function updateDamageCase(damageCaseId, damageCase) {
  const pool = await getPool();

  await pool.query(
    `
        UPDATE "DATSCHADENSFAELLE"
        SET
            "SFASTATUS" = $1, "SFABETREFF" = $2, "SFABEZEICHNUNG" = $2, "SFABESCHREIBUNG" = $3, "SFADATUM" = $4, 
            "SFASTRASSE" = $5, "SFAABSCHNITTVON" = $6, "SFAABSCHNITTBIS" = $7, "SFARICHTUNG" = $8, "SFAKMSTATION" = $9, 
            "SFALANDKREIS" = $10, "SFAKENNZEICHEN" = $11, "SFAZULASSUNGSSTELLE" = $12, "SFAVERURSACHER" = $13, 
            "SFAVERURSACHERADRESSE" = $14, "SFAVERSICHERUNG" = $15, "SFAVERSICHERUNGSSCHEINNR" = $16, 
            "SFAVERSICHERUNGSSCHADENNR" = $17, "SFAEMAILVERSICHERUNG" = $18, "SFARECHNUNGAN" = $19, "SFARECHNUNGTYP" = $20, 
            "SFARECHNUNGADRESSE" = $21, "SFARECHNUNGTEL" = $22, "SFARECHNUNGMAIL" = $23, "SFAKASSE" = $24, 
            "SFASONSTIGEKOSTEN" = $25, "SFAOFFENEFORDERUNG" = $26, "SFAKOSTENKOMPLETT" = $27, "SFABEARBEITER" = $28, 
            "SFAWIEDERVORLAGEAM" = $29, "SFAERFORDERLICHEARBEITEN" = $30, "SFAAENDERUNGAM" = CURRENT_TIMESTAMP
          WHERE "SFAID" = $31
    `,
    [
      damageCase.status || "Neu",
      damageCase.subject || "",
      damageCase.description || "",
      damageCase.damageDate || "",
      damageCase.street || "",
      damageCase.sectionFrom || "",
      damageCase.sectionTo || "",
      damageCase.direction || "",
      damageCase.kmStation || "",
      damageCase.district || "",
      damageCase.plateNumber || "",
      damageCase.registrationOffice || "",
      damageCase.responsibleParty || "",
      damageCase.responsiblePartyAddress || "",
      damageCase.insurance || "",
      damageCase.insurancePolicyNumber || "",
      damageCase.insuranceClaimNumber || "",
      damageCase.insuranceEmail || "",
      damageCase.invoiceTo || "",
      damageCase.invoiceRecipientType || "verursacher",
      damageCase.invoiceAddress || "",
      damageCase.invoicePhone || "",
      damageCase.invoiceEmail || "",
      damageCase.cashDesk || "",
      parseFloat(damageCase.otherCosts || 0),
      parseFloat(damageCase.openClaimAmount || 0),
      !!damageCase.costsComplete,
      damageCase.assignedTo || "",
      damageCase.followUpDate || "",
      JSON.stringify(damageCase.requiredWorks || []),
      damageCaseId,
    ],
  );

  return getDamageCaseById(damageCaseId);
}

async function createCatalogItem(item) {
  const pool = await getPool();
  const catalogId = `KAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await pool.query(
    `
      INSERT INTO "SYSKATALOG" (
        "KATID", "KATBEZEICHNUNG", "KATBESCHREIBUNG", "KATKATEGORIE", "KATEINHEIT", "KATSATZ", "KATERSTELLTVON", "KATERSTELLTAM", "KATAEENDERUNGAM"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      catalogId,
      item.bezeichnung || "",
      item.beschreibung || "",
      item.kategorie || "Sonstiges",
      item.einheit || "Stück",
      parseFloat(item.satz || 0),
      item.erstellt_von || "system",
    ]
  );

  return getCatalogItemById(catalogId);
}

async function getCatalogItemById(catalogId) {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM "SYSKATALOG" WHERE "KATID" = $1 LIMIT 1',
    [catalogId]
  );
  const record = result.rows[0];
  return record ? mapCatalogItem(record) : null;
}

function mapCatalogItem(record) {
  return {
    id: record.KATID,
    bezeichnung: record.KATBEZEICHNUNG || "",
    beschreibung: record.KATBESCHREIBUNG || "",
    kategorie: record.KATKATEGORIE || "Sonstiges",
    einheit: record.KATEINHEIT || "Stück",
    satz: Number(record.KATSATZ || 0),
    aktiv: Boolean(record.KATAKTIV),
    erstelltVon: record.KATERSTELLTVON || "",
    erstelltAm: record.KATERSTELLTAM,
    aenderungAm: record.KATAEENDERUNGAM,
  };
}

async function listCatalogItems(onlyActive = true) {
  const pool = await getPool();
  let query = 'SELECT * FROM "SYSKATALOG"';
  const params = [];

  if (onlyActive) {
    query += ' WHERE "KATAKTIV" = true';
  }

  query += ' ORDER BY "KATKATEGORIE", "KATBEZEICHNUNG"';

  const result = await pool.query(query, params);
  return result.rows.map(mapCatalogItem);
}

async function updateCatalogItem(catalogId, item) {
  const pool = await getPool();

  await pool.query(
    `
      UPDATE "SYSKATALOG"
      SET 
        "KATBEZEICHNUNG" = $1,
        "KATBESCHREIBUNG" = $2,
        "KATKATEGORIE" = $3,
        "KATEINHEIT" = $4,
        "KATSATZ" = $5,
        "KATAKTIV" = $6,
        "KATAEENDERUNGAM" = CURRENT_TIMESTAMP
      WHERE "KATID" = $7
    `,
    [
      item.bezeichnung || "",
      item.beschreibung || "",
      item.kategorie || "Sonstiges",
      item.einheit || "Stück",
      parseFloat(item.satz || 0),
      item.aktiv !== false,
      catalogId,
    ]
  );

  return getCatalogItemById(catalogId);
}

async function deleteCatalogItem(catalogId) {
  const pool = await getPool();
  
  await pool.query(
    'UPDATE "SYSKATALOG" SET "KATAKTIV" = false WHERE "KATID" = $1',
    [catalogId]
  );
}

async function addCatalogItemToCase(caseId, catalogId, menge) {
  const pool = await getPool();
  const posId = `KATPOS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get catalog item to calculate total price
  const catalogItem = await getCatalogItemById(catalogId);
  if (!catalogItem) {
    throw new Error("Katalogposition nicht gefunden");
  }

  const gesamtpreis = catalogItem.satz * parseFloat(menge);

  await pool.query(
    `
      INSERT INTO "SFOKATALOGPOSITIONEN" (
        "KATPOSID", "SFAID", "KATID", "KATPOSMENGE", "KATPOSGESAMTPREIS", "KATPOSHINZUGEFUEGTAM"
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `,
    [posId, caseId, catalogId, parseFloat(menge), gesamtpreis]
  );

  return getCatalogPositionById(posId);
}

async function getCatalogPositionById(posId) {
  const pool = await getPool();
  const result = await pool.query(
    `
      SELECT kp.*, k."KATBEZEICHNUNG", k."KATEINHEIT", k."KATSATZ"
      FROM "SFOKATALOGPOSITIONEN" kp
      JOIN "SYSKATALOG" k ON kp."KATID" = k."KATID"
      WHERE kp."KATPOSID" = $1 AND kp."KATPOSGELOESCHTAM" IS NULL
      LIMIT 1
    `,
    [posId]
  );
  
  const record = result.rows[0];
  return record ? {
    id: record.KATPOSID,
    caseId: record.SFAID,
    catalogId: record.KATID,
    bezeichnung: record.KATBEZEICHNUNG || "",
    einheit: record.KATEINHEIT || "Stück",
    menge: Number(record.KATPOSMENGE || 0),
    satz: Number(record.KATSATZ || 0),
    gesamtpreis: Number(record.KATPOSGESAMTPREIS || 0),
    hinzugefuegtAm: record.KATPOSHINZUGEFUEGTAM,
  } : null;
}

async function getCatalogItemsForCase(caseId) {
  const pool = await getPool();
  const result = await pool.query(
    `
      SELECT kp.*, k."KATBEZEICHNUNG", k."KATBESCHREIBUNG", k."KATEINHEIT", k."KATSATZ"
      FROM "SFOKATALOGPOSITIONEN" kp
      JOIN "SYSKATALOG" k ON kp."KATID" = k."KATID"
      WHERE kp."SFAID" = $1 AND kp."KATPOSGELOESCHTAM" IS NULL
      ORDER BY kp."KATPOSHINZUGEFUEGTAM"
    `,
    [caseId]
  );

  return result.rows.map(record => ({
    id: record.KATPOSID,
    caseId: record.SFAID,
    catalogId: record.KATID,
    bezeichnung: record.KATBEZEICHNUNG || "",
    beschreibung: record.KATBESCHREIBUNG || "",
    einheit: record.KATEINHEIT || "Stück",
    menge: Number(record.KATPOSMENGE || 0),
    satz: Number(record.KATSATZ || 0),
    gesamtpreis: Number(record.KATPOSGESAMTPREIS || 0),
  }));
}

async function removeCatalogItemFromCase(posId) {
  const pool = await getPool();
  
  await pool.query(
    'UPDATE "SFOKATALOGPOSITIONEN" SET "KATPOSGELOESCHTAM" = CURRENT_TIMESTAMP WHERE "KATPOSID" = $1',
    [posId]
  );
}

function mapInsuranceCatalogEntry(record) {
  return {
    id: record.VERSID,
    name: record.VERSNAME || "",
    contactPerson: record.VERSANSPRECHPARTNER || "",
    phone: record.VERSTELEFON || "",
    email: record.VERSMAIL || "",
    street: record.VERSSTRASSE || "",
    zipCode: record.VERSPLZ || "",
    city: record.VERSORT || "",
    country: record.VERSLAND || "Deutschland",
    description: record.VERSBESCHREIBUNG || "",
    active: Boolean(record.VERSAKTIV),
    createdBy: record.VERSERSTELLTVON || "",
    createdAt: record.VERSERSTELLTAM,
    updatedAt: record.VERSAENDERUNGAM,
  };
}

async function createInsuranceCatalogEntry(entry) {
  const pool = await getPool();
  const insuranceId = `VERS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await pool.query(
    `
      INSERT INTO "SYSVERSICHERUNGEN" (
        "VERSID", "VERSNAME", "VERSANSPRECHPARTNER", "VERSTELEFON", "VERSMAIL", "VERSSTRASSE", "VERSPLZ", "VERSORT", "VERSLAND", "VERSBESCHREIBUNG", "VERSAKTIV", "VERSERSTELLTVON", "VERSERSTELLTAM", "VERSAENDERUNGAM"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      insuranceId,
      entry.name || "",
      entry.contactPerson || "",
      entry.phone || "",
      entry.email || "",
      entry.street || "",
      entry.zipCode || "",
      entry.city || "",
      entry.country || "Deutschland",
      entry.description || "",
      entry.createdBy || "system",
    ],
  );

  return getInsuranceCatalogEntryById(insuranceId);
}

async function getInsuranceCatalogEntryById(insuranceId) {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM "SYSVERSICHERUNGEN" WHERE "VERSID" = $1 LIMIT 1',
    [insuranceId],
  );
  const record = result.rows[0];
  return record ? mapInsuranceCatalogEntry(record) : null;
}

async function listInsuranceCatalogEntries(onlyActive = true) {
  const pool = await getPool();
  let query = 'SELECT * FROM "SYSVERSICHERUNGEN"';

  if (onlyActive) {
    query += ' WHERE "VERSAKTIV" = true';
  }

  query += ' ORDER BY "VERSNAME"';

  const result = await pool.query(query);
  return result.rows.map(mapInsuranceCatalogEntry);
}

async function updateInsuranceCatalogEntry(insuranceId, entry) {
  const pool = await getPool();

  await pool.query(
    `
      UPDATE "SYSVERSICHERUNGEN"
      SET
        "VERSNAME" = $1,
        "VERSANSPRECHPARTNER" = $2,
        "VERSTELEFON" = $3,
        "VERSMAIL" = $4,
        "VERSSTRASSE" = $5,
        "VERSPLZ" = $6,
        "VERSORT" = $7,
        "VERSLAND" = $8,
        "VERSBESCHREIBUNG" = $9,
        "VERSAKTIV" = $10,
        "VERSAENDERUNGAM" = CURRENT_TIMESTAMP
      WHERE "VERSID" = $11
    `,
    [
      entry.name || "",
      entry.contactPerson || "",
      entry.phone || "",
      entry.email || "",
      entry.street || "",
      entry.zipCode || "",
      entry.city || "",
      entry.country || "Deutschland",
      entry.description || "",
      entry.active !== false,
      insuranceId,
    ],
  );

  return getInsuranceCatalogEntryById(insuranceId);
}

async function deleteInsuranceCatalogEntry(insuranceId) {
  const pool = await getPool();

  await pool.query(
    'UPDATE "SYSVERSICHERUNGEN" SET "VERSAKTIV" = false, "VERSAENDERUNGAM" = CURRENT_TIMESTAMP WHERE "VERSID" = $1',
    [insuranceId],
  );
}

function mapCashDeskEntry(record) {
  return {
    id: record.KASSEID,
    name: record.KASSEBEZEICHNUNG || "",
    active: Boolean(record.KASSEAKTIV),
    createdBy: record.KASSEERSTELLTVON || "",
    createdAt: record.KASSEERSTELLTAM,
    updatedAt: record.KASSEAENDERUNGAM,
  };
}

async function createCashDeskEntry(entry) {
  const pool = await getPool();
  const cashDeskId = `KASSE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await pool.query(
    `
      INSERT INTO "SYSKASSEN" (
        "KASSEID", "KASSEBEZEICHNUNG", "KASSEAKTIV", "KASSEERSTELLTVON", "KASSEERSTELLTAM", "KASSEAENDERUNGAM"
      )
      VALUES ($1, $2, true, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [cashDeskId, entry.name || "", entry.createdBy || "system"],
  );

  return getCashDeskEntryById(cashDeskId);
}

async function getCashDeskEntryById(cashDeskId) {
  const pool = await getPool();
  const result = await pool.query(
    'SELECT * FROM "SYSKASSEN" WHERE "KASSEID" = $1 LIMIT 1',
    [cashDeskId],
  );
  const record = result.rows[0];
  return record ? mapCashDeskEntry(record) : null;
}

async function listCashDeskEntries(onlyActive = true) {
  const pool = await getPool();
  let query = 'SELECT * FROM "SYSKASSEN"';

  if (onlyActive) {
    query += ' WHERE "KASSEAKTIV" = true';
  }

  query += ' ORDER BY "KASSEBEZEICHNUNG"';
  const result = await pool.query(query);
  return result.rows.map(mapCashDeskEntry);
}

async function updateCashDeskEntry(cashDeskId, entry) {
  const pool = await getPool();

  await pool.query(
    `
      UPDATE "SYSKASSEN"
      SET
        "KASSEBEZEICHNUNG" = $1,
        "KASSEAKTIV" = $2,
        "KASSEAENDERUNGAM" = CURRENT_TIMESTAMP
      WHERE "KASSEID" = $3
    `,
    [entry.name || "", entry.active !== false, cashDeskId],
  );

  return getCashDeskEntryById(cashDeskId);
}

async function deleteCashDeskEntry(cashDeskId) {
  const pool = await getPool();
  await pool.query(
    'UPDATE "SYSKASSEN" SET "KASSEAKTIV" = false, "KASSEAENDERUNGAM" = CURRENT_TIMESTAMP WHERE "KASSEID" = $1',
    [cashDeskId],
  );
}

async function hasActiveCashDesk(name) {
  const pool = await getPool();
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    return false;
  }

  const result = await pool.query(
    `
      SELECT 1
      FROM "SYSKASSEN"
      WHERE "KASSEAKTIV" = true
        AND LOWER(TRIM("KASSEBEZEICHNUNG")) = LOWER(TRIM($1))
      LIMIT 1
    `,
    [normalizedName],
  );

  return result.rowCount > 0;
}

function resetPoolsForScope(scope) {
  const normalizedScope = scope === "dummy" ? "dummy" : "main";
  const pool = poolPromises.get(normalizedScope);
  if (pool) {
    pool.end().catch((error) => {
      console.error(`Error closing pool for scope ${normalizedScope}:`, error);
    });
  }
  poolPromises.delete(normalizedScope);
  schemaPromises.delete(normalizedScope);
}

function getDbConfig(scope = getActiveScope()) {
  const config = loadConfig();
  const dbConfig =
    scope === "dummy"
      ? config.dummyDb || {}
      : config.db || {};
  return dbConfig;
}

module.exports = {
  runWithScope,
  connect,
  createDamageCase,
  createUserCode,
  getDamageCaseById,
  getNextCaseNumber,
  getUsers,
  listDamageCases,
  updateDamageCase,
  upsertUser,
  createCatalogItem,
  getCatalogItemById,
  listCatalogItems,
  updateCatalogItem,
  deleteCatalogItem,
  addCatalogItemToCase,
  getCatalogPositionById,
  getCatalogItemsForCase,
  removeCatalogItemFromCase,
  createInsuranceCatalogEntry,
  getInsuranceCatalogEntryById,
  listInsuranceCatalogEntries,
  updateInsuranceCatalogEntry,
  deleteInsuranceCatalogEntry,
  createCashDeskEntry,
  getCashDeskEntryById,
  listCashDeskEntries,
  updateCashDeskEntry,
  deleteCashDeskEntry,
  hasActiveCashDesk,
  resetPoolsForScope,
  getDbConfig,
};
