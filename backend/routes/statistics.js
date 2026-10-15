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
  return 1;
}

const MONTH_NAMES_LV = [
  'Janvāris', 'Februāris', 'Marts', 'Aprīlis', 'Maijs', 'Jūnijs',
  'Jūlijs', 'Augusts', 'Septembris', 'Oktobris', 'Novembris', 'Decembris'
];

// Helper to evaluate and sync achievements
function checkAndAwardAchievements(db, userId, callback) {
  // 1. Get stats
  const statsQuery = `
    SELECT
      (SELECT COALESCE(SUM(lappusu_skaits), 0) FROM lasisanas_sesija WHERE lietotajs_id = ?) as total_session_pages,
      (SELECT COALESCE(SUM(lapaspuses_izlasitas), 0) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ?) as total_personal_pages,
      (SELECT COUNT(*) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND statuss = 'izlasits') as total_books,
      (SELECT COUNT(*) FROM atsauksmes_atskaites WHERE lietotajs_id = ?) as total_reviews,
      (SELECT COALESCE(SUM(lappusu_skaits) * 1.0 / NULLIF(SUM(lasisanas_laiks), 0), 0) FROM lasisanas_sesija WHERE lietotajs_id = ? AND lasisanas_laiks > 0) as pace
  `;

  db.get(statsQuery, [userId, userId, userId, userId, userId], (err, stats) => {
    if (err) return callback && callback(err);

    const totalPages = Math.max(stats.total_session_pages || 0, stats.total_personal_pages || 0);
    const totalBooks = stats.total_books || 0;
    const totalReviews = stats.total_reviews || 0;
    const pace = stats.pace || 0;

    // Fetch all achievements
    db.all('SELECT * FROM sasniegumi', (err, achievements) => {
      if (err) return callback && callback(err);

      db.all('SELECT sasniegums_id FROM lietotaja_sasniegumi WHERE lietotajs_id = ?', [userId], (err, userAch) => {
        if (err) return callback && callback(err);

        const earnedSet = new Set((userAch || []).map(a => a.sasniegums_id));
        const newAwards = [];

        achievements.forEach(ach => {
          if (earnedSet.has(ach.sasniegums_id)) return;

          let earned = false;
          switch (ach.nosacijums_tips) {
            case 'books_1':
              if (totalBooks >= 1) earned = true;
              break;
            case 'books_10':
              if (totalBooks >= 10) earned = true;
              break;
            case 'books_25':
              if (totalBooks >= 25) earned = true;
              break;
            case 'pages_2500':
              if (totalPages >= 2500) earned = true;
              break;
            case 'pages_5000':
              if (totalPages >= 5000) earned = true;
              break;
            case 'pace_1_5':
              if (pace >= 1.5) earned = true;
              break;
            case 'review_1':
              if (totalReviews >= 1) earned = true;
              break;
          }

          if (earned) {
            newAwards.push(ach.sasniegums_id);
          }
        });

        if (newAwards.length === 0) {
          return callback && callback(null, []);
        }

        const placeholders = newAwards.map(() => '(?, ?)').join(', ');
        const insertParams = [];
        newAwards.forEach(id => {
          insertParams.push(userId, id);
        });

        db.run(`INSERT OR IGNORE INTO lietotaja_sasniegumi (lietotajs_id, sasniegums_id) VALUES ${placeholders}`, insertParams, (err) => {
          if (callback) callback(err, newAwards);
        });
      });
    });
  });
}

// GET /api/statistics/summary
router.get('/summary', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  // Sync achievements first
  checkAndAwardAchievements(db, userId, (err) => {
    if (err) console.error('Error syncing achievements:', err);

    const query = `
      SELECT
        (SELECT COALESCE(SUM(lappusu_skaits), 0) FROM lasisanas_sesija WHERE lietotajs_id = ?) as session_pages,
        (SELECT COALESCE(SUM(lapaspuses_izlasitas), 0) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ?) as personal_pages,
        (SELECT COUNT(*) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND statuss = 'izlasits') as total_books,
        (SELECT COUNT(*) FROM lietotaja_sasniegumi WHERE lietotajs_id = ?) as completed_achievements,
        (SELECT COALESCE(SUM(lasisanas_laiks), 0) FROM lasisanas_sesija WHERE lietotajs_id = ?) as total_minutes,
        (SELECT COALESCE(SUM(lappusu_skaits), 0) FROM lasisanas_sesija WHERE lietotajs_id = ? AND lasisanas_laiks > 0) as timed_pages,
        (SELECT COALESCE(SUM(lasisanas_laiks), 0) FROM lasisanas_sesija WHERE lietotajs_id = ? AND lasisanas_laiks > 0) as timed_minutes
    `;

    db.get(query, [userId, userId, userId, userId, userId, userId, userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      const totalPages = Math.max(row.session_pages || 0, row.personal_pages || 0);
      const totalBooks = row.total_books || 0;
      const completedAchievements = row.completed_achievements || 0;

      // Pacing calculation
      let averagePace = 0; // pages per minute
      let minutesPerPage = 0;
      if (row.timed_minutes > 0 && row.timed_pages > 0) {
        averagePace = parseFloat((row.timed_pages / row.timed_minutes).toFixed(2));
        minutesPerPage = parseFloat((row.timed_minutes / row.timed_pages).toFixed(2));
      }

      // Favorite author query: author with most finished/reading books or pages
      const authorQuery = `
        SELECT g.autors, COUNT(p.personal_id) as book_count, SUM(p.lapaspuses_izlasitas) as total_pages
        FROM personiga_gramatu_kratuve p
        JOIN globalas_gramatas g ON p.gramata_id = g.gramata_id
        WHERE p.lietotajs_id = ?
        GROUP BY g.autors
        ORDER BY book_count DESC, total_pages DESC
        LIMIT 1
      `;

      db.get(authorQuery, [userId], (err, authorRow) => {
        const favoriteAuthor = authorRow ? authorRow.autors : 'Freida McFadden';

        res.json({
          success: true,
          totalPages,
          totalBooks,
          favoriteAuthor,
          completedAchievements,
          averagePace,
          minutesPerPage,
          totalMinutes: row.total_minutes || 0
        });
      });
    });
  });
});

// GET /api/statistics/monthly?year=2026&month=9
router.get('/monthly', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const now = new Date();
  let year = parseInt(req.query.year, 10);
  let month = parseInt(req.query.month, 10);

  if (isNaN(year) || year < 2000) year = now.getFullYear();
  if (isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1; // 1-12

  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const yearStr = `${year}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const sql = `
    SELECT
      CAST(strftime('%d', ieraksta_datums) AS INTEGER) as day,
      SUM(lappusu_skaits) as pages,
      SUM(lasisanas_laiks) as minutes
    FROM lasisanas_sesija
    WHERE lietotajs_id = ?
      AND strftime('%Y', ieraksta_datums) = ?
      AND strftime('%m', ieraksta_datums) = ?
    GROUP BY day
  `;

  db.all(sql, [userId, yearStr, monthStr], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const dayMap = {};
    let totalPagesInMonth = 0;
    (rows || []).forEach(r => {
      dayMap[r.day] = {
        pages: r.pages || 0,
        minutes: r.minutes || 0
      };
      totalPagesInMonth += (r.pages || 0);
    });

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const p = dayMap[d] ? dayMap[d].pages : 0;
      const m = dayMap[d] ? dayMap[d].minutes : 0;
      let level = 0;
      if (p > 50) level = 3;
      else if (p >= 15) level = 2;
      else if (p > 0) level = 1;

      days.push({
        day: d,
        pages: p,
        minutes: m,
        level // 0: 0, 1: <15, 2: 15-50, 3: >50
      });
    }

    // List of months available in user history
    db.all(`
      SELECT DISTINCT strftime('%Y', ieraksta_datums) as yr, strftime('%m', ieraksta_datums) as mo
      FROM lasisanas_sesija
      WHERE lietotajs_id = ?
      ORDER BY yr DESC, mo DESC
    `, [userId], (err, availableRows) => {
      const availableMonths = (availableRows || []).map(r => {
        const mNum = parseInt(r.mo, 10);
        return {
          year: parseInt(r.yr, 10),
          month: mNum,
          label: `${MONTH_NAMES_LV[mNum - 1]} ${r.yr}`
        };
      });

      // Ensure current viewed month is in available months
      if (!availableMonths.some(m => m.year === year && m.month === month)) {
        availableMonths.unshift({
          year,
          month,
          label: `${MONTH_NAMES_LV[month - 1]} ${year}`
        });
      }

      res.json({
        success: true,
        year,
        month,
        monthName: MONTH_NAMES_LV[month - 1],
        daysInMonth,
        totalPagesInMonth,
        days,
        availableMonths
      });
    });
  });
});

// GET /api/statistics/trends
router.get('/trends', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  const sql = `
    SELECT
      strftime('%Y-%m', ieraksta_datums) as period,
      strftime('%Y', ieraksta_datums) as yr,
      strftime('%m', ieraksta_datums) as mo,
      SUM(lappusu_skaits) as pages,
      SUM(lasisanas_laiks) as minutes,
      SUM(CASE WHEN lasisanas_laiks > 0 THEN lappusu_skaits ELSE 0 END) as timed_pages,
      SUM(CASE WHEN lasisanas_laiks > 0 THEN lasisanas_laiks ELSE 0 END) as timed_minutes
    FROM lasisanas_sesija
    WHERE lietotajs_id = ?
    GROUP BY period
    ORDER BY period ASC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Also get books completed per month
    const booksSql = `
      SELECT
        strftime('%Y-%m', atjaunots_at) as period,
        COUNT(*) as completed_count
      FROM personiga_gramatu_kratuve
      WHERE lietotajs_id = ? AND statuss = 'izlasits'
      GROUP BY period
    `;

    db.all(booksSql, [userId], (err, bookRows) => {
      const booksMap = {};
      (bookRows || []).forEach(b => {
        booksMap[b.period] = b.completed_count;
      });

      const trends = (rows || []).map(r => {
        const mNum = parseInt(r.mo, 10);
        let pace = 0;
        if (r.timed_minutes > 0 && r.timed_pages > 0) {
          pace = parseFloat((r.timed_pages / r.timed_minutes).toFixed(2));
        }

        return {
          period: r.period,
          year: parseInt(r.yr, 10),
          month: mNum,
          monthName: MONTH_NAMES_LV[mNum - 1] || r.period,
          label: `${MONTH_NAMES_LV[mNum - 1] || ''} ${r.yr}`,
          pages: r.pages || 0,
          minutes: r.minutes || 0,
          pace,
          booksCompleted: booksMap[r.period] || 0
        };
      });

      res.json({
        success: true,
        trends
      });
    });
  });
});

// GET /api/statistics/achievements
router.get('/achievements', (req, res) => {
  const db = req.app.get('db');
  const userId = getUserId(req);

  checkAndAwardAchievements(db, userId, (err) => {
    if (err) console.error('Error updating achievements:', err);

    const statsQuery = `
      SELECT
        (SELECT COALESCE(SUM(lappusu_skaits), 0) FROM lasisanas_sesija WHERE lietotajs_id = ?) as session_pages,
        (SELECT COALESCE(SUM(lapaspuses_izlasitas), 0) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ?) as personal_pages,
        (SELECT COUNT(*) FROM personiga_gramatu_kratuve WHERE lietotajs_id = ? AND statuss = 'izlasits') as total_books,
        (SELECT COUNT(*) FROM atsauksmes_atskaites WHERE lietotajs_id = ?) as total_reviews,
        (SELECT COALESCE(SUM(lappusu_skaits) * 1.0 / NULLIF(SUM(lasisanas_laiks), 0), 0) FROM lasisanas_sesija WHERE lietotajs_id = ? AND lasisanas_laiks > 0) as pace
    `;

    db.get(statsQuery, [userId, userId, userId, userId, userId], (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });

      const totalPages = Math.max(stats.session_pages || 0, stats.personal_pages || 0);
      const totalBooks = stats.total_books || 0;
      const totalReviews = stats.total_reviews || 0;
      const pace = stats.pace || 0;

      const sql = `
        SELECT
          s.sasniegums_id,
          s.nosaukums,
          s.apraksts,
          s.nosacijums_tips,
          ls.ieguts_at
        FROM sasniegumi s
        LEFT JOIN lietotaja_sasniegumi ls
          ON s.sasniegums_id = ls.sasniegums_id AND ls.lietotajs_id = ?
        ORDER BY s.sasniegums_id ASC
      `;

      db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let completedCount = 0;
        const achievements = (rows || []).map(ach => {
          const isCompleted = !!ach.ieguts_at;
          if (isCompleted) completedCount++;

          let percent = 0;
          let currentVal = 0;
          let targetVal = 1;

          switch (ach.nosacijums_tips) {
            case 'books_1':
              currentVal = totalBooks;
              targetVal = 1;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'books_10':
              currentVal = totalBooks;
              targetVal = 10;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'books_25':
              currentVal = totalBooks;
              targetVal = 25;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'pages_2500':
              currentVal = totalPages;
              targetVal = 2500;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'pages_5000':
              currentVal = totalPages;
              targetVal = 5000;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'pace_1_5':
              currentVal = pace;
              targetVal = 1.5;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            case 'review_1':
              currentVal = totalReviews;
              targetVal = 1;
              percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
              break;
            default:
              percent = isCompleted ? 100 : 0;
          }

          if (isCompleted) percent = 100;

          return {
            sasniegums_id: ach.sasniegums_id,
            nosaukums: ach.nosaukums,
            apraksts: ach.apraksts,
            nosacijums_tips: ach.nosacijums_tips,
            is_completed: isCompleted,
            ieguts_at: ach.ieguts_at,
            progress_percent: percent,
            current_value: currentVal,
            target_value: targetVal
          };
        });

        res.json({
          success: true,
          totalCompleted: completedCount,
          achievements
        });
      });
    });
  });
});

module.exports = router;
module.exports.checkAndAwardAchievements = checkAndAwardAchievements;
