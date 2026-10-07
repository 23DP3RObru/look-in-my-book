const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 1000;

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(cors());
app.use(express.json());

// Configure session middleware
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));
const db = new sqlite3.Database('./data/app.db');

// Enable foreign key support in SQLite
db.run('PRAGMA foreign_keys = ON;');

// Make db available to routes
app.set('db', db);

function initDatabase() {
  db.serialize(() => {
    // 1. LIETOTAJS
    db.run(`
      CREATE TABLE IF NOT EXISTS lietotajs (
        lietotajs_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        vards TEXT NOT NULL,
        uzvards TEXT NOT NULL,
        epasts        TEXT NOT NULL UNIQUE,
        parole_hash   TEXT NOT NULL,
        loma          TEXT CHECK(loma IN ('user', 'admin')) DEFAULT 'user',
        izveidots_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. GLOBALAS_GRAMATAS
    db.run(`
      CREATE TABLE IF NOT EXISTS globalas_gramatas (
        gramata_id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nosaukums            TEXT NOT NULL,
        autors               TEXT NOT NULL,
        lapas_kopa           INTEGER DEFAULT 0,
        zanrs                TEXT,
        pievienots_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        atsauksmes_atskaites REAL DEFAULT 0.0
      )
    `);

    // 3. LASISANAS_SESIJA
    db.run(`
      CREATE TABLE IF NOT EXISTS lasisanas_sesija (
        sesija_id      INTEGER PRIMARY KEY AUTOINCREMENT,
        lietotajs_id   INTEGER NOT NULL,
        gramata_id     INTEGER NOT NULL,
        lappusu_skaits INTEGER DEFAULT 0,
        lasisanas_laiks INTEGER DEFAULT 0,
        ieraksta_datums DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lietotajs_id) REFERENCES lietotajs(lietotajs_id) ON DELETE CASCADE,
        FOREIGN KEY (gramata_id) REFERENCES globalas_gramatas(gramata_id) ON DELETE CASCADE
      )
    `);

    // 4. ATSAUKSMES_ATSKAITES
    db.run(`
      CREATE TABLE IF NOT EXISTS atsauksmes_atskaites (
        atskaite_id     INTEGER PRIMARY KEY AUTOINCREMENT,
        lietotajs_id    INTEGER NOT NULL,
        gramata_id      INTEGER NOT NULL,
        vertejums       INTEGER CHECK(vertejums BETWEEN 1 AND 5),
        recenzija       TEXT,
        iesniegts_datums DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lietotajs_id) REFERENCES lietotajs(lietotajs_id) ON DELETE CASCADE,
        FOREIGN KEY (gramata_id) REFERENCES globalas_gramatas(gramata_id) ON DELETE CASCADE
      )
    `);

    // 5. PERSONIGA_GRAMATU_KRATUVE
    db.run(`
      CREATE TABLE IF NOT EXISTS personiga_gramatu_kratuve (
        personal_id         INTEGER PRIMARY KEY AUTOINCREMENT,
        lietotajs_id        INTEGER NOT NULL,
        gramata_id          INTEGER NOT NULL,
        statuss             TEXT CHECK(statuss IN ('planots', 'lasa', 'izlasits')) DEFAULT 'planots',
        lapaspuses_izlasitas INTEGER DEFAULT 0,
        piezimes            TEXT,
        atjaunots_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        atsauksmes          REAL,
        FOREIGN KEY (lietotajs_id) REFERENCES lietotajs(lietotajs_id) ON DELETE CASCADE,
        FOREIGN KEY (gramata_id) REFERENCES globalas_gramatas(gramata_id) ON DELETE CASCADE
      )
    `);

    // 6. SASNIEGUMI
    db.run(`
      CREATE TABLE IF NOT EXISTS sasniegumi (
        sasniegums_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        nosaukums      TEXT NOT NULL,
        apraksts       TEXT,
        nosacijums_tips TEXT
      )
    `);

    // 7. LIETOTAJA_SASNIEGUMI
    db.run(`
      CREATE TABLE IF NOT EXISTS lietotaja_sasniegumi (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        lietotajs_id  INTEGER NOT NULL,
        sasniegums_id INTEGER NOT NULL,
        ieguts_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lietotajs_id) REFERENCES lietotajs(lietotajs_id) ON DELETE CASCADE,
        FOREIGN KEY (sasniegums_id) REFERENCES sasniegumi(sasniegums_id) ON DELETE CASCADE
      )
    `);

    console.log('✅ All 7 tables successfully created.');

    // Seed Sample Books
    const sampleData = [
      ['The Great Gatsby', 'F. Scott Fitzgerald', 180, 'Classic', 4.5],
      ['1984', 'George Orwell', 326, 'Dystopian', 4.8],
      ['The Hobbit', 'J.R.R. Tolkien', 310, 'Fantasy', 4.9],
    ];

    const insertSql = `INSERT INTO globalas_gramatas (nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites) VALUES (?, ?, ?, ?, ?)`;

    sampleData.forEach(row => {
      db.run(insertSql, row, (err) => {
        if (err) console.error(`❌ Error inserting row: ${err.message}`);
        else console.log(`✅ Sample book inserted: ${row[0]}`);
      });
    });
  });
}

initDatabase();

/* ──────────────────────────────────────────────
   STATIC ROUTE FALLBACK
   ────────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

/* ──────────────────────────────────────────────
   USER AUTHENTICATION ROUTES
   ────────────────────────────────────────────── */
app.use('/api/users', usersRouter);

/* ──────────────────────────────────────────────
   REST API ENDPOINTS (GLOBALAS_GRAMATAS)
   ────────────────────────────────────────────── */

// GET /api/books?genre=&search=
app.get('/api/books', (req, res) => {
  const genre  = req.query.genre || '';
  const search = req.query.search || '';

  let sql = `SELECT * FROM globalas_gramatas`;
  const params = [];
  const whereClauses = [];

  if (genre) {
    whereClauses.push('zanrs = ?');
    params.push(genre);
  }

  if (search) {
    whereClauses.push('(nosaukums LIKE ? OR autors LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY gramata_id ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/books/:id
app.get('/api/books/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  db.get(`SELECT * FROM globalas_gramatas WHERE gramata_id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Book not found' });
    res.json(row);
  });
});

// POST /api/books
app.post('/api/books', (req, res) => {
  const { nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites } = req.body;

  if (!nosaukums || !autors) {
    return res.status(400).json({ error: 'Title (nosaukums) and Author (autors) are required.' });
  }

  db.run(
    `INSERT INTO globalas_gramatas (nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites) VALUES (?, ?, ?, ?, ?)`,
    [nosaukums, autors, lapas_kopa || 0, zanrs || '', atsauksmes_atskaites || 0.0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ gramata_id: this.lastID, message: 'Book created.' });
    }
  );
});

// PUT /api/books/:id
app.put('/api/books/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites } = req.body;

  const updates = [];
  const params = [];

  if (nosaukums !== undefined)           { updates.push('nosaukums = ?');           params.push(nosaukums); }
  if (autors !== undefined)              { updates.push('autors = ?');              params.push(autors); }
  if (lapas_kopa !== undefined)          { updates.push('lapas_kopa = ?');          params.push(lapas_kopa || 0); }
  if (zanrs !== undefined)               { updates.push('zanrs = ?');               params.push(zanrs || ''); }
  if (atsauksmes_atskaites !== undefined){ updates.push('atsauksmes_atskaites = ?'); params.push(atsauksmes_atskaites || 0); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  params.push(id);

  db.run(`UPDATE globalas_gramatas SET ${updates.join(', ')} WHERE gramata_id = ?`, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Book updated.', gramata_id: id });
  });
});

// DELETE /api/books/:id
app.delete('/api/books/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  db.run(`DELETE FROM globalas_gramatas WHERE gramata_id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Book not found.' });
    res.json({ message: `Book ${id} deleted.` });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  db.close(() => process.exit(0));
});
//dsfdghfytu7rid46e5xtdjngfsz