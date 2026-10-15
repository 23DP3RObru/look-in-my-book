const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const usersRouter = require('./routes/users');
const statisticsRouter = require('./routes/statistics');
const readingRouter = require('./routes/reading');
const reviewsRouter = require('./routes/reviews');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 1000;

app.use(express.static(path.join(__dirname, '../frontend'), { index: 'hero.html' }));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
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

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_personiga_plaukts_user_book
      ON personiga_gramatu_kratuve (lietotajs_id, gramata_id)`);

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
        UNIQUE (lietotajs_id, sasniegums_id),
        FOREIGN KEY (lietotajs_id) REFERENCES lietotajs(lietotajs_id) ON DELETE CASCADE,
        FOREIGN KEY (sasniegums_id) REFERENCES sasniegumi(sasniegums_id) ON DELETE CASCADE
      )
    `);

    // 8. PLATFORMAS_ATSAUKSMES
    db.run(`
      CREATE TABLE IF NOT EXISTS platformas_atsauksmes (
        atsauksme_id      INTEGER PRIMARY KEY AUTOINCREMENT,
        lietotajs_id      INTEGER,
        autora_vards      TEXT NOT NULL,
        tips              TEXT DEFAULT 'sistema',
        gramata_id        INTEGER,
        gramata_nosaukums TEXT,
        vertejums         INTEGER CHECK(vertejums BETWEEN 1 AND 5),
        teksts            TEXT NOT NULL,
        izveidots_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All tables successfully created.');

    // Seed database with books, achievements, reviews, and statistics
    seedDatabase(db);
  });
}

initDatabase();

/* ──────────────────────────────────────────────
   STATIC ROUTE FALLBACK
   ────────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'hero.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'hero.html'));
});

/* ──────────────────────────────────────────────
   USER AUTHENTICATION ROUTES
   ────────────────────────────────────────────── */
app.use('/api/users', usersRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/reading', readingRouter);
app.use('/api/reviews', reviewsRouter);

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

// GET /api/books/saved - books in the signed-in user's personal shelf
app.get('/api/books/saved', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Lai skatītu savu plauktu, pieslēdzies.' });
  db.all(
    'SELECT gramata_id FROM personiga_gramatu_kratuve WHERE lietotajs_id = ?',
    [req.session.user.lietotajs_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
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

// POST /api/books/:id/save - save a book to the signed-in user's personal shelf
app.post('/api/books/:id/save', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Lai saglabātu grāmatu, vispirms pieslēdzies.' });
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Nederīgs grāmatas ID.' });
  db.run(
    `INSERT OR IGNORE INTO personiga_gramatu_kratuve (lietotajs_id, gramata_id) VALUES (?, ?)`,
    [req.session.user.lietotajs_id, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return db.get('SELECT gramata_id FROM globalas_gramatas WHERE gramata_id = ?', [id], (lookupErr, book) => {
          if (lookupErr) return res.status(500).json({ error: lookupErr.message });
          if (!book) return res.status(404).json({ error: 'Grāmata nav atrasta.' });
          res.json({ message: 'Grāmata jau ir tavā plauktā.' });
        });
      }
      res.status(201).json({ message: 'Grāmata saglabāta tavā plauktā.' });
    }
  );
});

// DELETE /api/books/:id/save - remove a book from the signed-in user's personal shelf
app.delete('/api/books/:id/save', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Lai labotu savu plauktu, vispirms pieslēdzies.' });
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Nederīgs grāmatas ID.' });
  db.run(
    'DELETE FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND gramata_id = ?',
    [req.session.user.lietotajs_id, id],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Grāmata izņemta no tava plaukta.' });
    }
  );
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
// test commit
