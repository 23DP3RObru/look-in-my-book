const express = require('express');
const router = express.Router();

function getUserId(req) {
  if (req.session && req.session.user && req.session.user.lietotajs_id) {
    return req.session.user.lietotajs_id;
  }
  if (req.headers['x-user-id']) {
    const parsed = parseInt(req.headers['x-user-id'], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}

// Avatar color generator based on initial
const AVATAR_COLORS = [
  { bg: '#d9f99d', color: '#3f6212' }, // Lime (Toms)
  { bg: '#fecaca', color: '#991b1b' }, // Red/Coral (Reinis)
  { bg: '#bae6fd', color: '#075985' }, // Sky blue (Emīls)
  { bg: '#fed7aa', color: '#9a3412' }, // Orange
  { bg: '#e9d5ff', color: '#6b21a8' }, // Purple
  { bg: '#a7f3d0', color: '#065f46' }  // Emerald
];

function getAvatarStyle(name) {
  if (!name) return AVATAR_COLORS[0];
  const charCode = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

// GET /api/reviews/latest?limit=6
router.get('/latest', (req, res) => {
  const db = req.app.get('db');
  const limit = Math.min(20, parseInt(req.query.limit, 10) || 6);

  const sql = `
    SELECT * FROM platformas_atsauksmes
    ORDER BY atsauksme_id DESC
    LIMIT ?
  `;

  db.all(sql, [limit], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const reviews = (rows || []).map(r => {
      const initial = (r.autora_vards || 'U').trim().charAt(0).toUpperCase();
      const style = getAvatarStyle(r.autora_vards);

      return {
        ...r,
        initial,
        avatar_bg: style.bg,
        avatar_color: style.color
      };
    });

    res.json({
      success: true,
      reviews
    });
  });
});

// POST /api/reviews - Add a new review (for platform or book)
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  let { autora_vards, tips, gramata_id, gramata_nosaukums, vertejums, teksts } = req.body;

  autora_vards = String(autora_vards || '').trim();
  teksts = String(teksts || '').trim();
  vertejums = parseInt(vertejums, 10);
  tips = (tips === 'gramata') ? 'gramata' : 'sistema';

  if (!autora_vards) {
    if (req.session && req.session.user) {
      autora_vards = `${req.session.user.vards || ''} ${req.session.user.uzvards || ''}`.trim() || req.session.user.epasts;
    } else {
      return res.status(400).json({ success: false, error: 'Lūdzu ievadiet savu vārdu!' });
    }
  }

  if (isNaN(vertejums) || vertejums < 1 || vertejums > 5) {
    return res.status(400).json({ success: false, error: 'Vērtējumam jābūt no 1 līdz 5 zvaigznēm.' });
  }

  if (!teksts) {
    return res.status(400).json({ success: false, error: 'Lūdzu ievadiet atsauksmes tekstu!' });
  }

  const insertSql = `
    INSERT INTO platformas_atsauksmes (lietotajs_id, autora_vards, tips, gramata_id, gramata_nosaukums, vertejums, teksts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(insertSql, [
    userId,
    autora_vards,
    tips,
    gramata_id || null,
    gramata_nosaukums || null,
    vertejums,
    teksts
  ], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const newId = this.lastID;

    // If it's a book review, also record in atsauksmes_atskaites if user and book exist
    if (tips === 'gramata' && gramata_id && userId) {
      db.run(
        `INSERT INTO atsauksmes_atskaites (lietotajs_id, gramata_id, vertejums, recenzija) VALUES (?, ?, ?, ?)`,
        [userId, gramata_id, vertejums, teksts],
        (err) => {
          if (!err) {
            db.run(
              `UPDATE globalas_gramatas SET atsauksmes_atskaites = (SELECT ROUND(AVG(vertejums), 1) FROM atsauksmes_atskaites WHERE gramata_id = ?) WHERE gramata_id = ?`,
              [gramata_id, gramata_id]
            );
          }
        }
      );
    }

    const initial = autora_vards.trim().charAt(0).toUpperCase();
    const style = getAvatarStyle(autora_vards);

    res.status(201).json({
      success: true,
      message: 'Atsauksme veiksmīgi pievienota!',
      review: {
        atsauksme_id: newId,
        autora_vards,
        tips,
        gramata_id,
        gramata_nosaukums,
        vertejums,
        teksts,
        initial,
        avatar_bg: style.bg,
        avatar_color: style.color,
        izveidots_at: new Date().toISOString()
      }
    });
  });
});

module.exports = router;
