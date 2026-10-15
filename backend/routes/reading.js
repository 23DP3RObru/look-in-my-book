const express = require('express');
const router = express.Router();
const { checkAndAwardAchievements } = require('./statistics');

function getUserId(req) {
  if (req.session && req.session.user && req.session.user.lietotajs_id) {
    return req.session.user.lietotajs_id;
  }
  if (req.headers['x-user-id']) {
    const parsed = parseInt(req.headers['x-user-id'], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

// GET /api/reading/current - Get currently reading books for user
router.get('/current', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const sql = `
    SELECT
      p.personal_id,
      p.lietotajs_id,
      p.gramata_id,
      p.statuss,
      p.lapaspuses_izlasitas,
      p.atjaunots_at,
      p.atsauksmes as personal_rating,
      g.nosaukums,
      g.autors,
      g.lapas_kopa,
      g.zanrs,
      g.atsauksmes_atskaites,
      COALESCE(g.bilde_url, 'src/img/default-cover.svg') as bilde_url
    FROM personiga_gramatu_kratuve p
    JOIN globalas_gramatas g ON p.gramata_id = g.gramata_id
    WHERE p.lietotajs_id = ? AND p.statuss = 'lasa'
    ORDER BY p.atjaunots_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const books = (rows || []).map(b => {
      const totalPages = b.lapas_kopa || 1;
      const readPages = b.lapaspuses_izlasitas || 0;
      const percent = Math.min(100, Math.round((readPages / totalPages) * 100));

      return {
        ...b,
        progress_percent: percent,
        is_completed: readPages >= totalPages
      };
    });

    res.json({
      success: true,
      books
    });
  });
});

// POST /api/reading/log - Log a reading session and add pages
router.post('/log', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const gramataId = parseInt(req.body.gramata_id, 10);
  const pagesRead = parseInt(req.body.pages_read, 10);
  const readingTime = parseInt(req.body.reading_time_minutes, 10) || 0;

  if (isNaN(gramataId)) {
    return res.status(400).json({ success: false, error: 'Nepieciešams derīgs grāmatas ID.' });
  }

  if (isNaN(pagesRead) || pagesRead <= 0) {
    return res.status(400).json({ success: false, error: 'Lūdzu ievadiet derīgu izlasīto lapaspušu skaitu (vairāk par 0).' });
  }

  // Check personal reading book
  db.get(`
    SELECT p.*, g.lapas_kopa, g.nosaukums, g.autors, g.bilde_url
    FROM personiga_gramatu_kratuve p
    JOIN globalas_gramatas g ON p.gramata_id = g.gramata_id
    WHERE p.lietotajs_id = ? AND p.gramata_id = ?
  `, [userId, gramataId], (err, book) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    if (!book) {
      return res.status(404).json({ success: false, error: 'Grāmata nav atrasta tavā sarakstā.' });
    }

    const currentPages = book.lapaspuses_izlasitas || 0;
    const maxPages = book.lapas_kopa || 999999;
    const newPages = Math.min(maxPages, currentPages + pagesRead);
    const isCompleted = newPages >= maxPages;

    // 1. Record reading session
    const insertSessionSql = `
      INSERT INTO lasisanas_sesija (lietotajs_id, gramata_id, lappusu_skaits, lasisanas_laiks)
      VALUES (?, ?, ?, ?)
    `;

    db.run(insertSessionSql, [userId, gramataId, pagesRead, readingTime], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });

      // 2. Update personal book progress
      const updateBookSql = `
        UPDATE personiga_gramatu_kratuve
        SET lapaspuses_izlasitas = ?, atjaunots_at = CURRENT_TIMESTAMP
        WHERE lietotajs_id = ? AND gramata_id = ?
      `;

      db.run(updateBookSql, [newPages, userId, gramataId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // 3. Trigger achievements update
        checkAndAwardAchievements(db, userId, (err, newAwards) => {
          const progressPercent = Math.min(100, Math.round((newPages / maxPages) * 100));

          res.json({
            success: true,
            message: `Veiksmīgi pievienotas ${pagesRead} lpp.!`,
            updatedBook: {
              gramata_id: gramataId,
              lapaspuses_izlasitas: newPages,
              lapas_kopa: maxPages,
              progress_percent: progressPercent,
              is_completed: isCompleted
            },
            completed: isCompleted,
            newAchievements: newAwards || []
          });
        });
      });
    });
  });
});

// POST /api/reading/review - Submit a 5-star review for a book
router.post('/review', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const gramataId = parseInt(req.body.gramata_id, 10);
  const vertejums = parseInt(req.body.vertejums, 10);
  const recenzija = String(req.body.recenzija || '').trim();

  if (isNaN(gramataId)) {
    return res.status(400).json({ success: false, error: 'Nepieciešams derīgs grāmatas ID.' });
  }

  if (isNaN(vertejums) || vertejums < 1 || vertejums > 5) {
    return res.status(400).json({ success: false, error: 'Vērtējumam jābūt no 1 līdz 5 zvaigznēm.' });
  }

  // 1. Insert review into atsauksmes_atskaites
  const insertReviewSql = `
    INSERT INTO atsauksmes_atskaites (lietotajs_id, gramata_id, vertejums, recenzija)
    VALUES (?, ?, ?, ?)
  `;

  db.run(insertReviewSql, [userId, gramataId, vertejums, recenzija], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });

    // 2. Mark book as finished ('izlasits') and record rating
    const updatePersonalSql = `
      UPDATE personiga_gramatu_kratuve
      SET statuss = 'izlasits', atsauksmes = ?, atjaunots_at = CURRENT_TIMESTAMP
      WHERE lietotajs_id = ? AND gramata_id = ?
    `;

    db.run(updatePersonalSql, [vertejums, userId, gramataId], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });

      // 3. Recalculate average rating in globalas_gramatas
      const updateGlobalSql = `
        UPDATE globalas_gramatas
        SET atsauksmes_atskaites = (
          SELECT ROUND(AVG(vertejums), 1)
          FROM atsauksmes_atskaites
          WHERE gramata_id = ?
        )
        WHERE gramata_id = ?
      `;

      db.run(updateGlobalSql, [gramataId, gramataId], function(err) {
        if (err) console.error('Error updating book global rating:', err);

        // 4. Check achievements
        checkAndAwardAchievements(db, userId, (err, newAwards) => {
          res.json({
            success: true,
            message: 'Paldies par atsauksmi! Grāmata atzīmēta kā pabeigta.',
            newAchievements: newAwards || []
          });
        });
      });
    });
  });
});

// GET /api/reading/available - Get global books to add to reading
router.get('/available', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const sql = `
    SELECT g.*
    FROM globalas_gramatas g
    WHERE g.gramata_id NOT IN (
      SELECT gramata_id FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND statuss = 'lasa'
    )
    ORDER BY g.nosaukums ASC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, books: rows || [] });
  });
});

// POST /api/reading/start - Start reading a book
router.post('/start', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);
  const gramataId = parseInt(req.body.gramata_id, 10);

  if (isNaN(gramataId)) {
    return res.status(400).json({ success: false, error: 'Nepieciešams derīgs grāmatas ID.' });
  }

  // Check if exists in personal library
  db.get('SELECT * FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND gramata_id = ?', [userId, gramataId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    if (row) {
      db.run(
        `UPDATE personiga_gramatu_kratuve SET statuss = 'lasa', atjaunots_at = CURRENT_TIMESTAMP WHERE lietotajs_id = ? AND gramata_id = ?`,
        [userId, gramataId],
        (err) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, message: 'Grāmata pievienota pašlaik lasāmajām.' });
        }
      );
    } else {
      db.run(
        `INSERT INTO personiga_gramatu_kratuve (lietotajs_id, gramata_id, statuss, lapaspuses_izlasitas) VALUES (?, ?, 'lasa', 0)`,
        [userId, gramataId],
        (err) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, message: 'Grāmata pievienota pašlaik lasāmajām.' });
        }
      );
    }
  });
});

module.exports = router;
