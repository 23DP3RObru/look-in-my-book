const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 1000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(':memory:');

function initDatabase() {
  const TABLE_NAME = 'books';
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      gramata_id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums            TEXT    NOT NULL,
      autors               TEXT    NOT NULL,
      lapas_kopa           INTEGER DEFAULT 0,
      zanrs                TEXT,
      atsauksmes_atskaites FLOAT,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTableSql, () => {
    console.log(`✅ Table "${TABLE_NAME}" created.`);

    const sampleData = [
      ['The Great Gatsby', 'F. Scott Fitzgerald', 180, 'Classic', 4.5],
      ['1984', 'George Orwell', 326, 'Dystopian', 4.8],
      ['The Hobbit', 'J.R.R. Tolkien', 310, 'Fantasy', 4.9],
    ];

    const insertSql = `INSERT INTO ${TABLE_NAME} (nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites) VALUES (?, ?, ?, ?, ?)`;

    sampleData.forEach(row => {
      db.run(insertSql, row, (err) => {
        if (err) {
          console.error(`❌ Error inserting row: ${err.message}`);
        } else {
          console.log(`✅ Inserted: ${row[0]}`);
        }
      });
    });
  });
}

initDatabase();

/* ──────────────────────────────────────────────
   STATIC ROUTE FALLBACK
   ────────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ──────────────────────────────────────────────
   REST API ENDPOINTS
   ────────────────────────────────────────────── */

// GET /api/books?genre=&search=
app.get('/api/books', (req, res) => {
  const genre  = req.query.genre || '';
  const search = req.query.search || '';

  let sql = `SELECT * FROM books`;
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

  db.get(`SELECT * FROM books WHERE gramata_id = ?`, [id], (err, row) => {
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
    `INSERT INTO books (nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites) VALUES (?, ?, ?, ?, ?)`,
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

  db.run(`UPDATE books SET ${updates.join(', ')} WHERE gramata_id = ?`, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Book updated.', gramata_id: id });
  });
});

// DELETE /api/books/:id
app.delete('/api/books/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  db.run(`DELETE FROM books WHERE gramata_id = ?`, [id], function (err) {
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