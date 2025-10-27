const express = require('express');
const sql = require('mssql/msnodesqlv8');
const path = require('path');
const fs = require('fs');

const app = express();

let config;
const configFilePath = path.join(__dirname,'/config/config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath, 'utf8');
            config = JSON.parse(configData);
            console.log('config loaded successfully');
            return config;
        } else {
            console.error('config.json file not found!');
            process.exit(1);
        }
    } catch (err) {
        console.error('Error reading config file:', err.message);
        process.exit(1);
    }
}

loadConfig();

fs.watchFile(configFilePath, (curr, prev) => {
    console.log('config.json file changed, reloading...');
    loadConfig();
    console.log('Please restart the server that changes for Database in ./config/config.json take effect');
});

const PORT = process.env.PORT || config.server.port;

app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
    connectionString: `
    Driver={${config.database.driver}};
    Server=${config.database.server};
    Database=${config.database.database};
    Trusted_Connection=${config.database.trustedConnection ? 'yes' : 'no'};
    `
};

console.log('Using Windows Authentication from current user:', process.env.USERNAME || 'current user');
console.log('Database Config:', config.database);

let pool;
let poolConnect;
let currentQuery = '';
const queryFilePath = path.join(__dirname, config.files.queryFile);

function loadSqlQuery() {
    try {
        if (fs.existsSync(queryFilePath)) {
            const newQuery = fs.readFileSync(queryFilePath, 'utf8').trim();
            if (newQuery !== currentQuery) {
                currentQuery = newQuery;
                console.log('SQL Query loaded:', currentQuery);
            }
            return currentQuery;
        } else {
            console.warn(`${config.files.queryFile} file not found, using default query`);
            return config.files.defaultQuery;
        }
    } catch (err) {
        console.error('Error reading searchQuery file:', err.message);
        return config.files.defaultQuery;
    }
}

fs.watchFile(queryFilePath, (curr, prev) => {
    console.log(`${config.files.queryFile} file changed, reloading...`);
    loadSqlQuery();
});

async function initializeDatabase() {
    try {
        pool = new sql.ConnectionPool(dbConfig);
        poolConnect = pool.connect();
        await poolConnect;
        console.log('Database connected successfully');
        
        loadSqlQuery();
    } catch (err) {
        console.error('DB-Connect Error:', err.message);
    }
}

initializeDatabase();

app.get('/api/users', async (req, res) => {
    try {
        if (!pool || !pool.connected) {
            await initializeDatabase();
        }
        
        const query = loadSqlQuery();
        
        console.log('Executing query:', query);
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});


app.post('/api/users', async (req, res) => {
    try {
        if (!pool || !pool.connected) {
            await initializeDatabase();
        }
        
        const { user_name, useraccess } = req.body;
        
        // Validierung
        if (!user_name || useraccess === undefined) {
            return res.status(400).json({ error: 'user_name and useraccess are required' });
        }
        
        // INSERT Query
        const insertQuery = `
            INSERT INTO dbo.vfxusr (user_name, useraccess) 
            VALUES (@user_name, @useraccess)
        `;
        
        const request = pool.request();
        request.input('user_name', sql.VarChar, user_name);
        request.input('useraccess', sql.Int, parseInt(useraccess));
        
        console.log('Inserting user:', { user_name, useraccess });
        await request.query(insertQuery);
        
        res.json({ 
            success: true, 
            message: 'User added successfully',
            user: { user_name, useraccess }
        });
        
    } catch (err) {
        console.error('Insert Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'/public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});