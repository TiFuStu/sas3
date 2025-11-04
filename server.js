const express = require("express");
const sql = require("mssql");
const path = require("path");
const fs = require("fs");

const app = express();

let config;
const configFilePath = path.join(__dirname, "/config/config.json");

function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath, "utf8");
      config = JSON.parse(configData);
      console.log("config loaded successfully");
      return config;
    } else {
      console.error("config.json file not found!");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error reading config file:", err.message);
    process.exit(1);
  }
}

loadConfig();

fs.watchFile(configFilePath, (curr, prev) => {
  console.log("config.json file changed, reloading...");
  loadConfig();
  console.log(
    "Please restart the server that changes for Database in ./config/config.json take effect",
  );
});

const PORT = process.env.PORT || config.server.port;

app.use(express.static(path.join(__dirname, "public")));

const dbConfig = {
  server: config.database.server,
  port: config.database.port,
  database: config.database.database,
  user: config.database.serviceUser,
  password: config.database.servicePassword,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: config.database.instanceName,
  },
};
console.log("Using Service User:", config.database.serviceUser);
console.log("Database Config:", {
  server: config.database.server,
  database: config.database.database,
  user: config.database.serviceUser,
});

let pool;
let currentQuery = "";
const queryFilePath = path.join(__dirname, config.files.queryFile);

function loadSqlQuery() {
  try {
    if (fs.existsSync(queryFilePath)) {
      const newQuery = fs.readFileSync(queryFilePath, "utf8").trim();
      if (newQuery !== currentQuery) {
        currentQuery = newQuery;
        console.log("SQL Query loaded:", currentQuery);
      }
      return currentQuery;
    } else {
      console.warn(
        `${config.files.queryFile} file not found, using default query`,
      );
      return config.files.defaultQuery;
    }
  } catch (err) {
    console.error("Error reading searchQuery file:", err.message);
    return config.files.defaultQuery;
  }
}

fs.watchFile(queryFilePath, (curr, prev) => {
  console.log(`${config.files.queryFile} file changed, reloading...`);
  loadSqlQuery();
});

async function initializeDatabase() {
  try {
    if (pool) {
      try {
        await pool.close();
      } catch (e) {
        console.log("Error closing existing pool:", e.message);
      }
    }

    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log("Database connected successfully");

    const query = loadSqlQuery();

    console.log("Executing query:", query);
    const result = await pool.request().query(query);
    console.log("Query successful, rows:", result.recordset.length);
    console.log("initial run successful");
  } catch (err) {
    console.error("DB-Connect Error:", err);
    console.error("Error details:", err.message);
  }
}

app.get("/api/users", async (req, res) => {
  try {
    console.log("API /api/users called");

    const query = loadSqlQuery();

    if (!query) {
      throw new Error("No query loaded");
    }

    console.log("Executing query:", query);
    const result = await pool.request().query(query);
    console.log("Query successful, rows:", result.recordset.length);

    res.json(result.recordset);
  } catch (err) {
    console.error("=== API ERROR ===");
    console.error("Error:", err);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({
      error: "Database error",
      message: err.message,
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);

  initializeDatabase().catch((err) => {
    console.error("Failed to initialize database:", err);
  });
});
