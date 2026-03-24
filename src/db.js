const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const dbHelper = require("./utils/dbHelper");

const configPath = path.join(__dirname, "..", "config.json");
let poolPromise;
let schemaPromise;

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
        throw new Error("config.json konnte nicht geladen werden.");
    }
}

function getSqlConfig() {
    const config = loadConfig();
    const dbConfig = config.db || {};

    return {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.server,
        port: dbConfig.port,
        database: dbConfig.database,
        options: {
            encrypt: dbConfig.options?.encrypt ?? false,
            trustServerCertificate: dbConfig.options?.trustServerCertificate ?? true
        }
    };
}

function getPoolPromise() {
    if (!poolPromise) {
        poolPromise = sql.connect(getSqlConfig()).catch((error) => {
            poolPromise = undefined;
            throw error;
        });
    }

    return poolPromise;
}

async function ensureCoreSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            const pool = await getPoolPromise();
            const schemaSql = `
IF OBJECT_ID('dbo.SYSBENUTZER', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SYSBENUTZER (
        BENID NVARCHAR(100) NOT NULL PRIMARY KEY,
        BENADUID NVARCHAR(100) NOT NULL,
        BENSASXUSER NVARCHAR(100) NOT NULL,
        BENVORNAME NVARCHAR(100) NULL,
        BENNACHNAME NVARCHAR(100) NULL,
        BENKUERZEL NVARCHAR(20) NULL,
        BENMAIL NVARCHAR(255) NULL,
        BENANZEIGENAME NVARCHAR(255) NULL,
        BENAKTUALISIERTAM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF COL_LENGTH('dbo.SYSBENUTZER', 'BENVORNAME') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENVORNAME NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.SYSBENUTZER', 'BENNACHNAME') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENNACHNAME NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.SYSBENUTZER', 'BENKUERZEL') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENKUERZEL NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.SYSBENUTZER', 'BENMAIL') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENMAIL NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.SYSBENUTZER', 'BENANZEIGENAME') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENANZEIGENAME NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.SYSBENUTZER', 'BENAKTUALISIERTAM') IS NULL ALTER TABLE dbo.SYSBENUTZER ADD BENAKTUALISIERTAM DATETIME2 NOT NULL CONSTRAINT DF_SYSBENUTZER_BENAKTUALISIERTAM DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('dbo.DATSCHADENSFAELLE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DATSCHADENSFAELLE (
        SFAID NVARCHAR(80) NOT NULL PRIMARY KEY,
        SFANUMMER NVARCHAR(20) NOT NULL,
        SFAGILTAB NVARCHAR(8) NOT NULL,
        SFAGILTBIS NVARCHAR(8) NOT NULL DEFAULT '99999999',
        SFADELDAT NVARCHAR(14) NULL,
        SFASTATUS NVARCHAR(50) NOT NULL DEFAULT 'Neu',
        SFABETREFF NVARCHAR(255) NULL,
        SFABEZEICHNUNG NVARCHAR(255) NULL,
        SFADATUM NVARCHAR(10) NULL,
        SFABESCHREIBUNG NVARCHAR(MAX) NULL,
        SFASTRASSE NVARCHAR(120) NULL,
        SFAABSCHNITTVON NVARCHAR(50) NULL,
        SFAABSCHNITTBIS NVARCHAR(50) NULL,
        SFARICHTUNG NVARCHAR(120) NULL,
        SFAKMSTATION NVARCHAR(30) NULL,
        SFALANDKREIS NVARCHAR(120) NULL,
        SFAKENNZEICHEN NVARCHAR(30) NULL,
        SFAZULASSUNGSSTELLE NVARCHAR(120) NULL,
        SFAVERURSACHER NVARCHAR(255) NULL,
        SFAVERSICHERUNG NVARCHAR(255) NULL,
        SFAVERSICHERUNGSSCHEINNR NVARCHAR(100) NULL,
        SFAVERSICHERUNGSSCHADENNR NVARCHAR(100) NULL,
        SFAEMAILVERSICHERUNG NVARCHAR(255) NULL,
        SFARECHNUNGAN NVARCHAR(100) NULL,
        SFAKASSE NVARCHAR(100) NULL,
        SFASONSTIGEKOSTEN DECIMAL(12, 2) NOT NULL DEFAULT 0,
        SFAOFFENEFORDERUNG DECIMAL(12, 2) NOT NULL DEFAULT 0,
        SFAKOSTENKOMPLETT BIT NOT NULL DEFAULT 0,
        SFABEARBEITER NVARCHAR(120) NULL,
        SFAWIEDERVORLAGEAM NVARCHAR(10) NULL,
        SFAERFORDERLICHEARBEITEN NVARCHAR(MAX) NULL,
        SFAERSTELLTVON NVARCHAR(100) NOT NULL,
        SFAERSTELLTAM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        SFAAENDERUNGAM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFANUMMER') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFANUMMER NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFASTATUS') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFASTATUS NVARCHAR(50) NOT NULL CONSTRAINT DF_DATSCHADENSFAELLE_SFASTATUS DEFAULT 'Neu';
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFABETREFF') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFABETREFF NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFASTRASSE') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFASTRASSE NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAABSCHNITTVON') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAABSCHNITTVON NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAABSCHNITTBIS') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAABSCHNITTBIS NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFARICHTUNG') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFARICHTUNG NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAKMSTATION') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAKMSTATION NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFALANDKREIS') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFALANDKREIS NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAKENNZEICHEN') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAKENNZEICHEN NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAZULASSUNGSSTELLE') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAZULASSUNGSSTELLE NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAVERURSACHER') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAVERURSACHER NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAVERSICHERUNG') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAVERSICHERUNG NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAVERSICHERUNGSSCHEINNR') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAVERSICHERUNGSSCHEINNR NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAVERSICHERUNGSSCHADENNR') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAVERSICHERUNGSSCHADENNR NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAEMAILVERSICHERUNG') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAEMAILVERSICHERUNG NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFARECHNUNGAN') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFARECHNUNGAN NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAKASSE') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAKASSE NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFASONSTIGEKOSTEN') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFASONSTIGEKOSTEN DECIMAL(12, 2) NOT NULL CONSTRAINT DF_DATSCHADENSFAELLE_SFASONSTIGEKOSTEN DEFAULT 0;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAOFFENEFORDERUNG') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAOFFENEFORDERUNG DECIMAL(12, 2) NOT NULL CONSTRAINT DF_DATSCHADENSFAELLE_SFAOFFENEFORDERUNG DEFAULT 0;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAKOSTENKOMPLETT') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAKOSTENKOMPLETT BIT NOT NULL CONSTRAINT DF_DATSCHADENSFAELLE_SFAKOSTENKOMPLETT DEFAULT 0;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFABEARBEITER') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFABEARBEITER NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAWIEDERVORLAGEAM') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAWIEDERVORLAGEAM NVARCHAR(10) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAERFORDERLICHEARBEITEN') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAERFORDERLICHEARBEITEN NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAERSTELLTVON') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAERSTELLTVON NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAERSTELLTAM') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAERSTELLTAM DATETIME2 NULL;
IF COL_LENGTH('dbo.DATSCHADENSFAELLE', 'SFAAENDERUNGAM') IS NULL ALTER TABLE dbo.DATSCHADENSFAELLE ADD SFAAENDERUNGAM DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_DATSCHADENSFAELLE_SFANUMMER' AND object_id = OBJECT_ID('dbo.DATSCHADENSFAELLE'))
BEGIN
    CREATE UNIQUE INDEX UX_DATSCHADENSFAELLE_SFANUMMER ON dbo.DATSCHADENSFAELLE (SFANUMMER) WHERE SFANUMMER IS NOT NULL;
END;
`;
            await pool.request().batch(schemaSql);
        })().catch((error) => {
            schemaPromise = undefined;
            throw error;
        });
    }

    return schemaPromise;
}

async function getPool() {
    const pool = await getPoolPromise();
    await ensureCoreSchema();
    return pool;
}

function toDecimal(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toBit(value) {
    return value ? 1 : 0;
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

    const result = await pool.request()
        .input("likePattern", sql.NVarChar, likePattern)
        .query("SELECT COUNT(*) AS recordCount FROM dbo.DATSCHADENSFAELLE WHERE SFAID LIKE @likePattern");

    const sequence = (result.recordset[0]?.recordCount || 0) + 1;
    return dbHelper.generateKey("SFA", userCode, now, sequence);
}

async function getNextCaseNumber(pool, now) {
    const yearToken = String(now.getFullYear()).slice(-2);
    const likePattern = `01/${yearToken}%`;

    const result = await pool.request()
        .input("likePattern", sql.NVarChar, likePattern)
        .query("SELECT MAX(SFANUMMER) AS maxNumber FROM dbo.DATSCHADENSFAELLE WHERE SFANUMMER LIKE @likePattern");

    const maxNumber = result.recordset[0]?.maxNumber;
    const currentSequence = maxNumber ? Number.parseInt(String(maxNumber).slice(-4), 10) : 0;
    const nextSequence = Number.isFinite(currentSequence) ? currentSequence + 1 : 1;

    return `01/${yearToken}${String(nextSequence).padStart(4, "0")}`;
}

function parseRequiredWorks(value) {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
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
        createdBy: record.SFAERSTELLTVON || "",
        createdAt: record.SFAERSTELLTAM,
        updatedAt: record.SFAAENDERUNGAM
    };
}

async function connect() {
    const pool = await getPool();
    return pool;
}

async function upsertUser(user) {
    const pool = await getPool();
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const displayName = user.displayName || [firstName, lastName].filter(Boolean).join(" ") || user.username;
    const shortCode = user.shortCode || createUserCode(user.username);

    await pool.request()
        .input("benid", sql.NVarChar, user.username)
        .input("aduid", sql.NVarChar, user.username)
        .input("sasUser", sql.NVarChar, user.username)
        .input("firstName", sql.NVarChar, firstName)
        .input("lastName", sql.NVarChar, lastName)
        .input("shortCode", sql.NVarChar, shortCode)
        .input("mail", sql.NVarChar, user.email || "")
        .input("displayName", sql.NVarChar, displayName)
        .query(`
MERGE dbo.SYSBENUTZER AS target
USING (SELECT @aduid AS BENADUID) AS source
ON target.BENADUID = source.BENADUID
WHEN MATCHED THEN
    UPDATE SET
        BENID = @benid,
        BENSASXUSER = @sasUser,
        BENVORNAME = @firstName,
        BENNACHNAME = @lastName,
        BENKUERZEL = @shortCode,
        BENMAIL = @mail,
        BENANZEIGENAME = @displayName,
        BENAKTUALISIERTAM = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (BENID, BENADUID, BENSASXUSER, BENVORNAME, BENNACHNAME, BENKUERZEL, BENMAIL, BENANZEIGENAME, BENAKTUALISIERTAM)
    VALUES (@benid, @aduid, @sasUser, @firstName, @lastName, @shortCode, @mail, @displayName, SYSUTCDATETIME());
`);
}

async function getUsers() {
    const pool = await getPool();
    const result = await pool.request().query(`
SELECT *
FROM dbo.SYSBENUTZER
ORDER BY COALESCE(BENNACHNAME, BENID), COALESCE(BENVORNAME, BENID)
`);
    return result.recordset;
}

async function createDamageCase(damageCase) {
    const pool = await getPool();
    const now = new Date();
    const technicalId = await getNextTechnicalId(pool, damageCase.createdBy, now);
    const caseNumber = await getNextCaseNumber(pool, now);

    await pool.request()
        .input("id", sql.NVarChar, technicalId)
        .input("caseNumber", sql.NVarChar, caseNumber)
        .input("validFrom", sql.NVarChar, dbHelper.formatDateIso(now))
        .input("status", sql.NVarChar, damageCase.status || "Neu")
        .input("subject", sql.NVarChar, damageCase.subject || "")
        .input("description", sql.NVarChar(sql.MAX), damageCase.description || "")
        .input("damageDate", sql.NVarChar, damageCase.damageDate || "")
        .input("street", sql.NVarChar, damageCase.street || "")
        .input("sectionFrom", sql.NVarChar, damageCase.sectionFrom || "")
        .input("sectionTo", sql.NVarChar, damageCase.sectionTo || "")
        .input("direction", sql.NVarChar, damageCase.direction || "")
        .input("kmStation", sql.NVarChar, damageCase.kmStation || "")
        .input("district", sql.NVarChar, damageCase.district || "")
        .input("plateNumber", sql.NVarChar, damageCase.plateNumber || "")
        .input("registrationOffice", sql.NVarChar, damageCase.registrationOffice || "")
        .input("responsibleParty", sql.NVarChar, damageCase.responsibleParty || "")
        .input("insurance", sql.NVarChar, damageCase.insurance || "")
        .input("insurancePolicyNumber", sql.NVarChar, damageCase.insurancePolicyNumber || "")
        .input("insuranceClaimNumber", sql.NVarChar, damageCase.insuranceClaimNumber || "")
        .input("insuranceEmail", sql.NVarChar, damageCase.insuranceEmail || "")
        .input("invoiceTo", sql.NVarChar, damageCase.invoiceTo || "")
        .input("cashDesk", sql.NVarChar, damageCase.cashDesk || "")
        .input("otherCosts", sql.Decimal(12, 2), toDecimal(damageCase.otherCosts))
        .input("openClaimAmount", sql.Decimal(12, 2), toDecimal(damageCase.openClaimAmount))
        .input("costsComplete", sql.Bit, toBit(damageCase.costsComplete))
        .input("assignedTo", sql.NVarChar, damageCase.assignedTo || "")
        .input("followUpDate", sql.NVarChar, damageCase.followUpDate || "")
        .input("requiredWorks", sql.NVarChar(sql.MAX), JSON.stringify(damageCase.requiredWorks || []))
        .input("createdBy", sql.NVarChar, damageCase.createdBy)
        .query(`
INSERT INTO dbo.DATSCHADENSFAELLE (
    SFAID,
    SFANUMMER,
    SFAGILTAB,
    SFASTATUS,
    SFABETREFF,
    SFABEZEICHNUNG,
    SFABESCHREIBUNG,
    SFADATUM,
    SFASTRASSE,
    SFAABSCHNITTVON,
    SFAABSCHNITTBIS,
    SFARICHTUNG,
    SFAKMSTATION,
    SFALANDKREIS,
    SFAKENNZEICHEN,
    SFAZULASSUNGSSTELLE,
    SFAVERURSACHER,
    SFAVERSICHERUNG,
    SFAVERSICHERUNGSSCHEINNR,
    SFAVERSICHERUNGSSCHADENNR,
    SFAEMAILVERSICHERUNG,
    SFARECHNUNGAN,
    SFAKASSE,
    SFASONSTIGEKOSTEN,
    SFAOFFENEFORDERUNG,
    SFAKOSTENKOMPLETT,
    SFABEARBEITER,
    SFAWIEDERVORLAGEAM,
    SFAERFORDERLICHEARBEITEN,
    SFAERSTELLTVON,
    SFAERSTELLTAM,
    SFAAENDERUNGAM
)
VALUES (
    @id,
    @caseNumber,
    @validFrom,
    @status,
    @subject,
    @subject,
    @description,
    @damageDate,
    @street,
    @sectionFrom,
    @sectionTo,
    @direction,
    @kmStation,
    @district,
    @plateNumber,
    @registrationOffice,
    @responsibleParty,
    @insurance,
    @insurancePolicyNumber,
    @insuranceClaimNumber,
    @insuranceEmail,
    @invoiceTo,
    @cashDesk,
    @otherCosts,
    @openClaimAmount,
    @costsComplete,
    @assignedTo,
    @followUpDate,
    @requiredWorks,
    @createdBy,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
)
`);

    return getDamageCaseById(technicalId);
}

async function listDamageCases(options = {}) {
    const pool = await getPool();
    const includeAll = options.includeAll ? 1 : 0;
    const result = await pool.request()
        .input("includeAll", sql.Bit, includeAll)
        .input("ownerUsername", sql.NVarChar, options.ownerUsername || "")
        .query(`
SELECT *
FROM dbo.DATSCHADENSFAELLE
WHERE SFADELDAT IS NULL
  AND (@includeAll = 1 OR LOWER(SFAERSTELLTVON) = LOWER(@ownerUsername))
ORDER BY COALESCE(SFAAENDERUNGAM, SFAERSTELLTAM) DESC, SFANUMMER DESC
`);

    return result.recordset.map(mapDamageCase);
}

async function getDamageCaseById(damageCaseId) {
    const pool = await getPool();
    const result = await pool.request()
        .input("damageCaseId", sql.NVarChar, damageCaseId)
        .query("SELECT TOP 1 * FROM dbo.DATSCHADENSFAELLE WHERE SFAID = @damageCaseId");

    const record = result.recordset[0];
    return record ? mapDamageCase(record) : null;
}

async function updateDamageCase(damageCaseId, damageCase) {
    const pool = await getPool();

    await pool.request()
        .input("damageCaseId", sql.NVarChar, damageCaseId)
        .input("status", sql.NVarChar, damageCase.status || "Neu")
        .input("subject", sql.NVarChar, damageCase.subject || "")
        .input("description", sql.NVarChar(sql.MAX), damageCase.description || "")
        .input("damageDate", sql.NVarChar, damageCase.damageDate || "")
        .input("street", sql.NVarChar, damageCase.street || "")
        .input("sectionFrom", sql.NVarChar, damageCase.sectionFrom || "")
        .input("sectionTo", sql.NVarChar, damageCase.sectionTo || "")
        .input("direction", sql.NVarChar, damageCase.direction || "")
        .input("kmStation", sql.NVarChar, damageCase.kmStation || "")
        .input("district", sql.NVarChar, damageCase.district || "")
        .input("plateNumber", sql.NVarChar, damageCase.plateNumber || "")
        .input("registrationOffice", sql.NVarChar, damageCase.registrationOffice || "")
        .input("responsibleParty", sql.NVarChar, damageCase.responsibleParty || "")
        .input("insurance", sql.NVarChar, damageCase.insurance || "")
        .input("insurancePolicyNumber", sql.NVarChar, damageCase.insurancePolicyNumber || "")
        .input("insuranceClaimNumber", sql.NVarChar, damageCase.insuranceClaimNumber || "")
        .input("insuranceEmail", sql.NVarChar, damageCase.insuranceEmail || "")
        .input("invoiceTo", sql.NVarChar, damageCase.invoiceTo || "")
        .input("cashDesk", sql.NVarChar, damageCase.cashDesk || "")
        .input("otherCosts", sql.Decimal(12, 2), toDecimal(damageCase.otherCosts))
        .input("openClaimAmount", sql.Decimal(12, 2), toDecimal(damageCase.openClaimAmount))
        .input("costsComplete", sql.Bit, toBit(damageCase.costsComplete))
        .input("assignedTo", sql.NVarChar, damageCase.assignedTo || "")
        .input("followUpDate", sql.NVarChar, damageCase.followUpDate || "")
        .input("requiredWorks", sql.NVarChar(sql.MAX), JSON.stringify(damageCase.requiredWorks || []))
        .query(`
UPDATE dbo.DATSCHADENSFAELLE
SET
    SFASTATUS = @status,
    SFABETREFF = @subject,
    SFABEZEICHNUNG = @subject,
    SFABESCHREIBUNG = @description,
    SFADATUM = @damageDate,
    SFASTRASSE = @street,
    SFAABSCHNITTVON = @sectionFrom,
    SFAABSCHNITTBIS = @sectionTo,
    SFARICHTUNG = @direction,
    SFAKMSTATION = @kmStation,
    SFALANDKREIS = @district,
    SFAKENNZEICHEN = @plateNumber,
    SFAZULASSUNGSSTELLE = @registrationOffice,
    SFAVERURSACHER = @responsibleParty,
    SFAVERSICHERUNG = @insurance,
    SFAVERSICHERUNGSSCHEINNR = @insurancePolicyNumber,
    SFAVERSICHERUNGSSCHADENNR = @insuranceClaimNumber,
    SFAEMAILVERSICHERUNG = @insuranceEmail,
    SFARECHNUNGAN = @invoiceTo,
    SFAKASSE = @cashDesk,
    SFASONSTIGEKOSTEN = @otherCosts,
    SFAOFFENEFORDERUNG = @openClaimAmount,
    SFAKOSTENKOMPLETT = @costsComplete,
    SFABEARBEITER = @assignedTo,
    SFAWIEDERVORLAGEAM = @followUpDate,
    SFAERFORDERLICHEARBEITEN = @requiredWorks,
    SFAAENDERUNGAM = SYSUTCDATETIME()
WHERE SFAID = @damageCaseId
`);

    return getDamageCaseById(damageCaseId);
}

module.exports = {
    connect,
    createDamageCase,
    getDamageCaseById,
    getUsers,
    listDamageCases,
    updateDamageCase,
    upsertUser
};
