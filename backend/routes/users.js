const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// POST /api/users/register - Register a new user
router.post('/register', (req, res, next) => {
  const db = req.app.get('db');
  const { first_name, last_name, email, password, rep_password } = req.body;

  // Validation
  if (!first_name || !last_name || !email || !password || !rep_password) {
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
      db.run(sql, [first_name, last_name, email, hashedPassword], function (err) {
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
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // Find user by email
  db.get('SELECT lietotajs_id, vards, uzvards, epasts, parole_hash FROM lietotajs WHERE epasts = ?', [email], (err, user) => {
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

      // Store user info in session
      req.session.user = {
        lietotajs_id: user.lietotajs_id,
        vards: user.vards,
        uzvards: user.uzvards,
        epasts: user.epasts
      };

      res.json({
        success: true,
        message: 'Login successful.',
        user: req.session.user
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
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

module.exports = router;
