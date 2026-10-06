const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toSessionUser(user) {
  return {
    lietotajs_id: user.lietotajs_id,
    vards: user.vards,
    uzvards: user.uzvards,
    epasts: user.epasts,
    loma: user.loma || 'user'
  };
}

// POST /api/users/register - Register a new user
router.post('/register', (req, res, next) => {
  const db = req.app.get('db');
  const firstName = String(req.body.first_name || '').trim();
  const lastName = String(req.body.last_name || '').trim();
  const { password, rep_password } = req.body;
  const email = normalizeEmail(req.body.email);

  // Validation
  if (!firstName || !lastName || !email || !password || !rep_password) {
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  }

  if (password !== rep_password) {
    return res.status(400).json({ success: false, error: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  // Check if email already exists
  db.get('SELECT * FROM lietotajs WHERE epasts = ?', [email], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error.' });
    }

    if (row) {
      return res.status(400).json({ success: false, error: 'Email already registered.' });
    }

    // Hash password and insert user
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Error processing password.' });
      }

      const sql = `INSERT INTO lietotajs (vards, uzvards, epasts, parole_hash) VALUES (?, ?, ?, ?)`;
      db.run(sql, [firstName, lastName, email, hashedPassword], function (err) {
        if (err) {
          return res.status(500).json({ success: false, error: 'Registration failed.' });
        }

        res.status(201).json({
          success: true,
          message: 'User registered successfully. Please log in.',
          lietotajs_id: this.lastID
        });
      });
    });
  });
});

// POST /api/users/login - Login user
router.post('/login', (req, res, next) => {
  const db = req.app.get('db');
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // Find user by email
  db.get('SELECT lietotajs_id, vards, uzvards, epasts, parole_hash, loma FROM lietotajs WHERE epasts = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error.' });
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Compare password with hash
    bcrypt.compare(password, user.parole_hash, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Error checking password.' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const sessionUser = toSessionUser(user);

      // Create a fresh session after successful authentication.
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Login failed.' });
        }

        req.session.user = sessionUser;

        res.json({
          success: true,
          message: 'Login successful.',
          user: sessionUser
        });
      });
    });
  });
});

// GET /api/users/me - Get current logged in user
router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.status(401).json({ success: false, error: 'Not logged in.' });
  }
});

// POST /api/users/logout - Logout user
router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true, message: 'Logged out successfully.' });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

module.exports = router;
