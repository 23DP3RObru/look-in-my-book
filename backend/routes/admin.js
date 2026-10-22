const express = require('express');
const router = express.Router();

/**
 * Middleware: Verify that user is authenticated and has 'admin' role
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Nepieciešama autorizācija. Lūdzu, pieslēdzieties sistēmai.'
    });
  }

  if (req.session.user.loma !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Piekļuve liegta. Šai darbībai ir nepieciešamas administratora tiesības.'
    });
  }

  next();
}

// Apply requireAdmin to all admin API routes
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Overview dashboard metrics for the administrator
 */
router.get('/stats', (req, res) => {
  const db = req.app.get('db');

  const statsQuery = `
    SELECT
      (SELECT COUNT(*) FROM lietotajs) AS total_users,
      (SELECT COUNT(*) FROM lietotajs WHERE statuss = 'blokets') AS blocked_users,
      (SELECT COUNT(*) FROM globalas_gramatas) AS total_books,
      ((SELECT COUNT(*) FROM atsauksmes_atskaites) + (SELECT COUNT(*) FROM platformas_atsauksmes)) AS total_reviews,
      (SELECT COUNT(*) FROM lasisanas_sesija) AS total_sessions
  `;

  db.get(statsQuery, (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, stats: row });
  });
});

/**
 * GET /api/admin/users
 * Returns list of all registered users
 */
router.get('/users', (req, res) => {
  const db = req.app.get('db');
  const sql = `
    SELECT
      u.lietotajs_id,
      u.vards,
      u.uzvards,
      u.epasts,
      u.loma,
      COALESCE(u.statuss, 'aktivs') AS statuss,
      u.izveidots_at,
      COUNT(DISTINCT p.personal_id) AS gramatu_skaits,
      COUNT(DISTINCT s.sesija_id) AS sesiju_skaits
    FROM lietotajs u
    LEFT JOIN personiga_gramatu_kratuve p ON p.lietotajs_id = u.lietotajs_id
    LEFT JOIN lasisanas_sesija s ON s.lietotajs_id = u.lietotajs_id
    GROUP BY u.lietotajs_id
    ORDER BY u.lietotajs_id ASC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, users: rows });
  });
});

/**
 * PUT /api/admin/users/:id/block
 * Toggle or set a client user's block status ('aktivs' | 'blokets')
 */
router.put('/users/:id/block', (req, res) => {
  const db = req.app.get('db');
  const targetId = parseInt(req.params.id, 10);
  const currentAdminId = req.session.user.lietotajs_id;

  if (isNaN(targetId)) {
    return res.status(400).json({ success: false, error: 'Nederīgs lietotāja ID.' });
  }

  if (targetId === currentAdminId) {
    return res.status(400).json({
      success: false,
      error: 'Administrators nevar bloķēt pats savu kontu.'
    });
  }

  db.get('SELECT lietotajs_id, vards, uzvards, epasts, loma, COALESCE(statuss, "aktivs") as statuss FROM lietotajs WHERE lietotajs_id = ?', [targetId], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!user) return res.status(404).json({ success: false, error: 'Lietotājs netika atrasts.' });

    // Determine new status
    let newStatus = 'blokets';
    if (req.body && req.body.statuss) {
      newStatus = req.body.statuss === 'blokets' ? 'blokets' : 'aktivs';
    } else {
      newStatus = user.statuss === 'blokets' ? 'aktivs' : 'blokets';
    }

    db.run('UPDATE lietotajs SET statuss = ? WHERE lietotajs_id = ?', [newStatus, targetId], function (updateErr) {
      if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

      res.json({
        success: true,
        message: newStatus === 'blokets' ? 'Lietotāja profils veiksmīgi bloķēts.' : 'Lietotāja profils veiksmīgi atbloķēts.',
        lietotajs_id: targetId,
        statuss: newStatus
      });
    });
  });
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user profile and all associated data
 */
router.delete('/users/:id', (req, res) => {
  const db = req.app.get('db');
  const targetId = parseInt(req.params.id, 10);
  const currentAdminId = req.session.user.lietotajs_id;

  if (isNaN(targetId)) {
    return res.status(400).json({ success: false, error: 'Nederīgs lietotāja ID.' });
  }

  if (targetId === currentAdminId) {
    return res.status(400).json({
      success: false,
      error: 'Administrators nevar dzēst pats savu profilu.'
    });
  }

  db.get('SELECT lietotajs_id, vards, uzvards, epasts, loma FROM lietotajs WHERE lietotajs_id = ?', [targetId], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!user) return res.status(404).json({ success: false, error: 'Lietotājs netika atrasts.' });

    db.serialize(() => {
      db.run('DELETE FROM lietotaja_sasniegumi WHERE lietotajs_id = ?', [targetId]);
      db.run('DELETE FROM lasisanas_sesija WHERE lietotajs_id = ?', [targetId]);
      db.run('DELETE FROM atsauksmes_atskaites WHERE lietotajs_id = ?', [targetId]);
      db.run('DELETE FROM personiga_gramatu_kratuve WHERE lietotajs_id = ?', [targetId]);
      db.run('DELETE FROM platformas_atsauksmes WHERE lietotajs_id = ?', [targetId]);
      db.run('DELETE FROM lietotajs WHERE lietotajs_id = ?', [targetId], function (delErr) {
        if (delErr) return res.status(500).json({ success: false, error: delErr.message });
        res.json({
          success: true,
          message: `Lietotāja ${user.vards} ${user.uzvards} (${user.epasts}) profils ir neatgriezeniski dzēsts.`
        });
      });
    });
  });
});

/**
 * GET /api/admin/reviews
 * Return all reviews (both book reviews and landing platform reviews)
 */
router.get('/reviews', (req, res) => {
  const db = req.app.get('db');

  const bookReviewsSql = `
    SELECT
      a.atskaite_id,
      'gramata' AS tips,
      a.gramata_id,
      g.nosaukums AS gramata_nosaukums,
      a.lietotajs_id,
      COALESCE(u.vards || ' ' || u.uzvards, 'Anonīms') AS autora_vards,
      a.vertejums,
      a.recenzija AS teksts,
      a.iesniegts_datums AS datums
    FROM atsauksmes_atskaites a
    LEFT JOIN globalas_gramatas g ON g.gramata_id = a.gramata_id
    LEFT JOIN lietotajs u ON u.lietotajs_id = a.lietotajs_id
    ORDER BY a.atskaite_id DESC
  `;

  const platformReviewsSql = `
    SELECT
      atsauksme_id,
      'sistema' AS tips,
      gramata_id,
      COALESCE(gramata_nosaukums, 'Platforma Look in My Book') AS gramata_nosaukums,
      lietotajs_id,
      autora_vards,
      vertejums,
      teksts,
      izveidots_at AS datums
    FROM platformas_atsauksmes
    ORDER BY atsauksme_id DESC
  `;

  db.all(bookReviewsSql, (err, bookReviews) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    db.all(platformReviewsSql, (pErr, platformReviews) => {
      if (pErr) return res.status(500).json({ success: false, error: pErr.message });

      res.json({
        success: true,
        book_reviews: bookReviews || [],
        platform_reviews: platformReviews || []
      });
    });
  });
});

/**
 * DELETE /api/admin/reviews/book/:id
 * Delete an inappropriate or violating book review and update book's average rating
 */
router.delete('/reviews/book/:id', (req, res) => {
  const db = req.app.get('db');
  const reviewId = parseInt(req.params.id, 10);

  if (isNaN(reviewId)) {
    return res.status(400).json({ success: false, error: 'Nederīgs atsauksmes ID.' });
  }

  db.get('SELECT atskaite_id, gramata_id FROM atsauksmes_atskaites WHERE atskaite_id = ?', [reviewId], (err, review) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!review) return res.status(404).json({ success: false, error: 'Atsauksme netika atrasta.' });

    const bookId = review.gramata_id;

    db.run('DELETE FROM atsauksmes_atskaites WHERE atskaite_id = ?', [reviewId], function (delErr) {
      if (delErr) return res.status(500).json({ success: false, error: delErr.message });

      // Recalculate average rating for the book
      db.get('SELECT AVG(vertejums) as avg_rating FROM atsauksmes_atskaites WHERE gramata_id = ?', [bookId], (avgErr, row) => {
        const newAvg = (row && row.avg_rating) ? Math.round(row.avg_rating * 10) / 10 : 0.0;
        db.run('UPDATE globalas_gramatas SET atsauksmes_atskaites = ? WHERE gramata_id = ?', [newAvg, bookId], () => {
          res.json({
            success: true,
            message: 'Grāmatas atsauksme veiksmīgi dzēsta.',
            atskaite_id: reviewId
          });
        });
      });
    });
  });
});

/**
 * DELETE /api/admin/reviews/platform/:id
 * Delete an inappropriate platform review from the hero feed
 */
router.delete('/reviews/platform/:id', (req, res) => {
  const db = req.app.get('db');
  const reviewId = parseInt(req.params.id, 10);

  if (isNaN(reviewId)) {
    return res.status(400).json({ success: false, error: 'Nederīgs atsauksmes ID.' });
  }

  db.run('DELETE FROM platformas_atsauksmes WHERE atsauksme_id = ?', [reviewId], function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ success: false, error: 'Atsauksme netika atrasta.' });

    res.json({
      success: true,
      message: 'Platformas atsauksme veiksmīgi dzēsta.',
      atsauksme_id: reviewId
    });
  });
});

module.exports = router;
