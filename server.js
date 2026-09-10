const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// CORS middleware (allows frontend to call backend)
app.use(cors());

// Body-parser for JSON requests
app.use(express.json());

// ──────────────────────────────────────────────
//  SQLite DATABASE SETUP
// ──────────────────────────────────────────────
const db = new sqlite3.Database(':memory:'); // Use ':memory:' for testing,
                                            // or a file like './mydb.sqlite' for persistence.

function initDatabase() {
  // Create table if it doesn't exist
  const TABLE_NAME = 'users';
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL UNIQUE,
      age          INTEGER DEFAULT 0,
      city         TEXT,
      active       INTEGER DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTableSql, () => {
    console.log(`✅ Table "${TABLE_NAME}" created.`);

    // Optional: Insert sample data on first run
    const sampleData = [
      ['Alice Johnson', 'alice@example.com', 28, 'New York'],
      ['Bob Smith', 'bob@example.com',   34, 'London'],
      ['Charlie Brown', 'charlie@example.com', 22, 'Berlin'],
    ];

    sampleData.forEach(row => {
      db.run(`INSERT INTO ${TABLE_NAME} (name, email, age, city) VALUES (?, ?, ?, ?)`, row);
    });
  });
}

initDatabase();

// ──────────────────────────────────────────────
//  REST API ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET    /api/users?filter=&search=
 *        Returns all users (optionally filtered/searched).
 */
app.get('/api/users', (req, res) => {
  const filter = req.query.filter || '';   // e.g. "active" or "inactive"
  const search = req.query.search || '';   // search by name/email

  let sql = `SELECT * FROM users`;
  const params = [];
  let whereAdded = false;

  if (filter === 'active') {
    sql += ' WHERE active = 1';
    whereAdded = true;
  } else if (filter === 'inactive') {
    sql += ' WHERE active = 0';
    whereAdded = true;
  }

  if (search) {
    sql += whereAdded ? ' AND (name LIKE ? OR email LIKE ?)' : ' WHERE (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY id ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/**
 * GET    /api/users/:id
 *        Returns a single user by ID.
 */
app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

/**
 * POST   /api/users
 *        Creates a new user.
 */
app.post('/api/users', (req, res) => {
  const { name, email, age, city } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  db.run(`INSERT INTO users (name, email, age, city) VALUES (?, ?, ?, ?)`,
    [name, email, age || 0, city || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const lastId = this.lastID;
      res.status(201).json({ id: lastId, message: 'User created.' });
    }
  );
});

/**
 * PUT    /api/users/:id
 *        Updates an existing user.
 */
app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name, email, age, city, active } = req.body;

  // Build dynamic SET clause
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (name !== undefined)   { updates.push(`name = ?`);       params.push(name);        paramIndex++; }
  if (email !== undefined)  { updates.push(`email = ?`);      params.push(email);        paramIndex++; }
  if (age !== undefined)    { updates.push(`age = ?`);        params.push(age || 0);     paramIndex++; }
  if (city !== undefined)   { updates.push(`city = ?`);       params.push(city || '');     paramIndex++; }
  if (active !== undefined) { updates.push(`active = ?`);     params.push(active ?? 1);    paramIndex++; }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  params.push(id);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User updated.', id });
  });
});

/**
 * DELETE /api/users/:id
 *        Deletes a user by ID.
 */
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const affected = this.changes;
    if (affected === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: `User ${id} deleted.` });
  });
});

// ──────────────────────────────────────────────
//  START SERVER
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`   API endpoints:`);
  console.log(`     GET    /api/users          — list all users`);
  console.log(`     GET    /api/users/:id      — get one user`);
  console.log(`     POST   /api/users          — create user`);
  console.log(`     PUT    /api/users/:id      — update user`);
  console.log(`     DELETE /api/users/:id      — delete user`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close(() => process.exit(0));
});
