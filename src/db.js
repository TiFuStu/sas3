const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const dbHelper = require("./utils/dbHelper");

const configPath = path.join(__dirname, "..", "config/config.json");
let poolPromise;
let schemaPromise;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error("config.json k\u00f6nnte nicht geladen werden.");
  }
}

function getPoolConfig() {
  const config = loadConfig();
  const dbConfig = config.db || {};

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

async function ensureCoreSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = await getPoolPromise();
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
                END $$;
                
                -- Ensure unique constraint on case number
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UX_DATSCHADENSFAELLE_SFANUMMER') THEN
                        ALTER TABLE "DATSCHADENSFAELLE" ADD CONSTRAINT "UX_DATSCHADENSFAELLE_SFANUMMER" UNIQUE ("SFANUMMER");
                    END IF;
                END $$;
            `;
      await pool.query(schemaSql);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  return schemaPromise;
}

function getPoolPromise() {
  if (!poolPromise) {
    poolPromise = new Pool(getPoolConfig());
  }
  return poolPromise;
}

async function getPool() {
  const pool = getPoolPromise();
  await ensureCoreSchema();
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
    updatedAt: record.SFAAENDERUNGAM
  };
}

function parseRequiredWorks(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
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

  const result = await pool.query('SELECT COUNT(*) AS "recordCount" FROM "DATSCHADENSFAELLE" WHERE "SFAID" LIKE $1', [likePattern]);
  const sequence = (parseInt(result.rows[0]?.recordCount || 0, 10)) + 1;
  return dbHelper.generateKey("SFA", userCode, now, sequence);
}

async function getNextCaseNumber(pool, now) {
  const yearToken = String(now.getFullYear()).slice(-2);
  const likePattern = `01/${yearToken}%`;

  const result = await pool.query('SELECT MAX("SFANUMMER") AS "maxNumber" FROM "DATSCHADENSFAELLE" WHERE "SFANUMMER" LIKE $1', [likePattern]);
  const maxNumber = result.rows[0]?.maxNumber;
  const currentSequence = maxNumber ? parseInt(String(maxNumber).slice(-4), 10) : 0;
  const nextSequence = Number.isFinite(currentSequence) ? currentSequence + 1 : 1;

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

  await pool.query(`
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
    `, [
    user.username, user.username, user.username, firstName, lastName, shortCode, user.email || "", displayName, user.dienststelle || ""
  ]);
}

async function getUsers() {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM "SYSBENUTZER" ORDER BY COALESCE("BENNACHNAME", "BENID"), COALESCE("BENVORNAME", "BENID")');
  return result.rows;
}

async function createDamageCase(damageCase) {
  const pool = await getPool();
  const now = new Date();
  const technicalId = await getNextTechnicalId(pool, damageCase.createdBy, now);
  const caseNumber = await getNextCaseNumber(pool, now);

  await pool.query(`
        INSERT INTO "DATSCHADENSFAELLE" (
            "SFAID", "SFANUMMER", "SFAGILTAB", "SFASTATUS", "SFABETREFF", "SFABEZEICHNUNG", "SFABESCHREIBUNG", "SFADATUM", 
            "SFASTRASSE", "SFAABSCHNITTVON", "SFAABSCHNITTBIS", "SFARICHTUNG", "SFAKMSTATION", "SFALANDKREIS", 
            "SFAKENNZEICHEN", "SFAZULASSUNGSSTELLE", "SFAVERURSACHER", "SFAVERURSACHERADRESSE", "SFAVERSICHERUNG", 
            "SFAVERSICHERUNGSSCHEINNR", "SFAVERSICHERUNGSSCHADENNR", "SFAEMAILVERSICHERUNG", "SFARECHNUNGAN", "SFAKASSE", 
            "SFASONSTIGEKOSTEN", "SFAOFFENEFORDERUNG", "SFAKOSTENKOMPLETT", "SFABEARBEITER", "SFAWIEDERVORLAGEAM", 
            "SFAERFORDERLICHEARBEITEN", "SFADIENSTSTELLE", "SFAERSTELLTVON", "SFAERSTELLTAM", "SFAAENDERUNGAM"
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    `, [
    technicalId, caseNumber, dbHelper.formatDateIso(now), damageCase.status || "Neu", damageCase.subject || "", damageCase.subject || "",
    damageCase.description || "", damageCase.damageDate || "", damageCase.street || "", damageCase.sectionFrom || "", damageCase.sectionTo || "",
    damageCase.direction || "", damageCase.kmStation || "", damageCase.district || "", damageCase.plateNumber || "",
    damageCase.registrationOffice || "", damageCase.responsibleParty || "", damageCase.responsiblePartyAddress || "", damageCase.insurance || "",
    damageCase.insurancePolicyNumber || "", damageCase.insuranceClaimNumber || "", damageCase.insuranceEmail || "",
    damageCase.invoiceTo || "", damageCase.cashDesk || "", parseFloat(damageCase.otherCosts || 0), parseFloat(damageCase.openClaimAmount || 0),
    !!damageCase.costsComplete, damageCase.assignedTo || "", damageCase.followUpDate || "", JSON.stringify(damageCase.requiredWorks || []),
    damageCase.dienststelle || "", damageCase.createdBy
  ]);

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
      roleClauses.push(`(LOWER("SFAERSTELLTVON") = LOWER($${params.length + 1}) AND "SFASTATUS" = 'Neu')`);
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
      query += ' AND (' + roleClauses.join(' OR ') + ')';
    } else {
      // No permissions, return nothing
      query += ' AND 1=0';
    }
  }

  query += ' ORDER BY COALESCE("SFAAENDERUNGAM", "SFAERSTELLTAM") DESC, "SFANUMMER" DESC';

  const result = await pool.query(query, params);
  return result.rows.map(mapDamageCase);
}

async function getDamageCaseById(damageCaseId) {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM "DATSCHADENSFAELLE" WHERE "SFAID" = $1 LIMIT 1', [damageCaseId]);
  const record = result.rows[0];
  return record ? mapDamageCase(record) : null;
}

async function updateDamageCase(damageCaseId, damageCase) {
  const pool = await getPool();

  await pool.query(`
        UPDATE "DATSCHADENSFAELLE"
        SET
            "SFASTATUS" = $1, "SFABETREFF" = $2, "SFABEZEICHNUNG" = $2, "SFABESCHREIBUNG" = $3, "SFADATUM" = $4, 
            "SFASTRASSE" = $5, "SFAABSCHNITTVON" = $6, "SFAABSCHNITTBIS" = $7, "SFARICHTUNG" = $8, "SFAKMSTATION" = $9, 
            "SFALANDKREIS" = $10, "SFAKENNZEICHEN" = $11, "SFAZULASSUNGSSTELLE" = $12, "SFAVERURSACHER" = $13, 
            "SFAVERURSACHERADRESSE" = $14, "SFAVERSICHERUNG" = $15, "SFAVERSICHERUNGSSCHEINNR" = $16, 
            "SFAVERSICHERUNGSSCHADENNR" = $17, "SFAEMAILVERSICHERUNG" = $18, "SFARECHNUNGAN" = $19, "SFAKASSE" = $20, 
            "SFASONSTIGEKOSTEN" = $21, "SFAOFFENEFORDERUNG" = $22, "SFAKOSTENKOMPLETT" = $23, "SFABEARBEITER" = $24, 
            "SFAWIEDERVORLAGEAM" = $25, "SFAERFORDERLICHEARBEITEN" = $26, "SFAAENDERUNGAM" = CURRENT_TIMESTAMP
        WHERE "SFAID" = $27
    `, [
    damageCase.status || "Neu", damageCase.subject || "", damageCase.description || "", damageCase.damageDate || "",
    damageCase.street || "", damageCase.sectionFrom || "", damageCase.sectionTo || "", damageCase.direction || "",
    damageCase.kmStation || "", damageCase.district || "", damageCase.plateNumber || "", damageCase.registrationOffice || "",
    damageCase.responsibleParty || "", damageCase.responsiblePartyAddress || "", damageCase.insurance || "", damageCase.insurancePolicyNumber || "",
    damageCase.insuranceClaimNumber || "", damageCase.insuranceEmail || "", damageCase.invoiceTo || "", damageCase.cashDesk || "",
    parseFloat(damageCase.otherCosts || 0), parseFloat(damageCase.openClaimAmount || 0), !!damageCase.costsComplete,
    damageCase.assignedTo || "", damageCase.followUpDate || "", JSON.stringify(damageCase.requiredWorks || []), damageCaseId
  ]);

  return getDamageCaseById(damageCaseId);
}

module.exports = {
  connect,
  createDamageCase,
  createUserCode,
  getDamageCaseById,
  getNextCaseNumber,
  getUsers,
  listDamageCases,
  updateDamageCase,
  upsertUser
};
