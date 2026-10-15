/**
 * Seed data for Look in My Book
 * Ensures tables, columns, sample books, achievements, and realistic user statistics.
 */

function seedDatabase(db) {
  db.serialize(() => {
    // 1. Add bilde_url column to globalas_gramatas if not exists
    db.run(`ALTER TABLE globalas_gramatas ADD COLUMN bilde_url TEXT`, (err) => {
      // Ignore if column already exists
    });

    // 2. Seed achievements
    const achievements = [
      [1, 'Iesācējs', 'Izlasīji 1 grāmatu.', 'books_1'],
      [2, 'Pieredzējis lasītājs', 'Izlasīji 10 grāmatu.', 'books_10'],
      [3, 'Profesionāls lasītājs', 'Izlasīji 25 grāmatas.', 'books_25'],
      [4, 'Lappušu pētnieks', 'Izlasīji 2500 lapaspuses.', 'pages_2500'],
      [5, 'Lappušu meistars', 'Izlasīji 5000 lapaspuses.', 'pages_5000'],
      [6, 'Ātrais lasītājs', 'Lasīšanas temps virs 1.5 lpp/min.', 'pace_1_5'],
      [7, 'Kritiķis', 'Uzrakstīji pirmo grāmatas atsauksmi.', 'review_1']
    ];

    achievements.forEach(ach => {
      db.run(
        `INSERT OR IGNORE INTO sasniegumi (sasniegums_id, nosaukums, apraksts, nosacijums_tips) VALUES (?, ?, ?, ?)`,
        ach
      );
    });

    // 3. Seed books in globalas_gramatas
    const books = [
      ['Never Lie', 'Freida McFadden', 336, 'Trilleris', 4.9, 'src/img/never-lie.svg'],
      ['The Housemaid', 'Freida McFadden', 330, 'Trilleris', 4.8, 'src/img/default-cover.svg'],
      ['The Inmate', 'Freida McFadden', 340, 'Trilleris', 4.7, 'src/img/default-cover.svg'],
      ['The Teacher', 'Freida McFadden', 282, 'Trilleris', 4.6, 'src/img/default-cover.svg'],
      ['The Coworker', 'Freida McFadden', 332, 'Trilleris', 4.7, 'src/img/default-cover.svg'],
      ['The Great Gatsby', 'F. Scott Fitzgerald', 180, 'Classic', 4.5, 'src/img/default-cover.svg'],
      ['The Hobbit', 'J.R.R. Tolkien', 304, 'Fantasy', 4.9, 'src/img/default-cover.svg'],
      ['1984', 'George Orwell', 326, 'Dystopian', 4.8, 'src/img/default-cover.svg']
    ];

    books.forEach(b => {
      db.get('SELECT gramata_id FROM globalas_gramatas WHERE nosaukums = ?', [b[0]], (err, row) => {
        if (!row) {
          db.run(
            `INSERT INTO globalas_gramatas (nosaukums, autors, lapas_kopa, zanrs, atsauksmes_atskaites, bilde_url) VALUES (?, ?, ?, ?, ?, ?)`,
            b
          );
        } else if (b[5]) {
          db.run(`UPDATE globalas_gramatas SET bilde_url = ?, lapas_kopa = ? WHERE nosaukums = ?`, [b[5], b[2], b[0]]);
        }
      });
    });

    // 4. Update user 1 info to match screenshot (Initial 'E', e.g. Elīna)
    db.run(
      `UPDATE lietotajs SET vards = 'Elīna', uzvards = 'Bērziņa' WHERE lietotajs_id = 1 AND (vards = 'rrr' OR vards = '')`
    );

    // 5. Ensure user 1 has initial reading data if personal library needs setup
    db.all('SELECT p.personal_id, g.nosaukums FROM personiga_gramatu_kratuve p JOIN globalas_gramatas g ON p.gramata_id = g.gramata_id WHERE p.lietotajs_id = 1', (err, userBooks) => {
      const hasNeverLie = (userBooks || []).some(b => b.nosaukums === 'Never Lie');
      if (!hasNeverLie || (userBooks || []).length < 7) {
        console.log('🌱 Setting up exact demo user statistics matching design mockup...');

        // Clear existing demo personal books and sessions for user 1 to ensure clean 1:1 match
        db.run('DELETE FROM personiga_gramatu_kratuve WHERE lietotajs_id = 1');
        db.run('DELETE FROM lasisanas_sesija WHERE lietotajs_id = 1');
        db.run('DELETE FROM lietotaja_sasniegumi WHERE lietotajs_id = 1');

        db.get('SELECT gramata_id FROM globalas_gramatas WHERE nosaukums = ?', ['Never Lie'], (err, nl) => {
          const neverLieId = nl ? nl.gramata_id : 1;

          // 1. Add Never Lie as currently reading with 232 / 336 pages (69%)
          db.run(`
            INSERT INTO personiga_gramatu_kratuve (lietotajs_id, gramata_id, statuss, lapaspuses_izlasitas)
            VALUES (1, ?, 'lasa', 232)
          `, [neverLieId]);

          // 2. Add 6 finished books (4 by Freida McFadden, 2 others)
          // Pages: 330 + 340 + 282 + 332 + 180 + 304 = 1768 pages finished + 232 = 2000 pages total!
          const finishedBooks = [
            'The Housemaid',
            'The Inmate',
            'The Teacher',
            'The Coworker',
            'The Great Gatsby',
            'The Hobbit'
          ];

          finishedBooks.forEach(title => {
            db.get('SELECT gramata_id, lapas_kopa FROM globalas_gramatas WHERE nosaukums = ?', [title], (err, bRow) => {
              if (bRow) {
                db.run(`
                  INSERT INTO personiga_gramatu_kratuve (lietotajs_id, gramata_id, statuss, lapaspuses_izlasitas, atsauksmes)
                  VALUES (1, ?, 'izlasits', ?, 5.0)
                `, [bRow.gramata_id, bRow.lapas_kopa]);
              }
            });
          });

          // Award achievement 1: Iesācējs (1 completed achievement)
          db.run(`INSERT OR IGNORE INTO lietotaja_sasniegumi (lietotajs_id, sasniegums_id) VALUES (1, 1)`);

          // Seed September 2026 reading sessions (Total = 230 pages, matching screenshot!)
          const septemberSessions = [
            [12, 12, '2026-09-01 19:30:00'],   // <15 pages
            [25, 26, '2026-09-04 20:15:00'],   // 15-50 pages
            [18, 20, '2026-09-06 18:45:00'],   // 15-50 pages
            [60, 62, '2026-09-09 21:00:00'],   // >50 pages
            [10, 11, '2026-09-12 17:20:00'],   // <15 pages
            [35, 36, '2026-09-15 20:00:00'],   // 15-50 pages
            [55, 57, '2026-09-18 21:30:00'],   // >50 pages
            [15, 16, '2026-09-22 19:10:00']    // 15-50 pages
            // Total: 12 + 25 + 18 + 60 + 10 + 35 + 55 + 15 = 230 pages!
          ];

          septemberSessions.forEach(s => {
            db.run(`
              INSERT INTO lasisanas_sesija (lietotajs_id, gramata_id, lappusu_skaits, lasisanas_laiks, ieraksta_datums)
              VALUES (1, ?, ?, ?, ?)
            `, [neverLieId, s[0], s[1], s[2]]);
          });

          // Seed previous months for trends (May, June, July, August, October 2026)
          const historicalSessions = [
            [280, 310, '2026-05-15 14:00:00'],
            [320, 340, '2026-06-20 15:00:00'],
            [350, 360, '2026-07-18 16:00:00'],
            [390, 400, '2026-08-22 17:00:00'],
            [232, 230, '2026-10-10 18:00:00']
          ];

          historicalSessions.forEach(h => {
            db.run(`
              INSERT INTO lasisanas_sesija (lietotajs_id, gramata_id, lappusu_skaits, lasisanas_laiks, ieraksta_datums)
              VALUES (1, ?, ?, ?, ?)
            `, [neverLieId, h[0], h[1], h[2]]);
          });
        });
      }
    });
  });
}

module.exports = { seedDatabase };
