/**
 * Look in My Book - Automātiskā testēšanas kopa (Test Suite)
 * Pārbauda visas sistēmas pamatfunkcijas:
 * 1. Reģistrāciju un validāciju (veiksmīga, dublikāti, īsa parole, tukši lauki)
 * 2. Pieslēgšanos un sesijas (pareizi/nepareizi dati, izeja no profila)
 * 3. Grāmatu bibliotēku (saraksts, meklēšana, jaunas grāmatas pievienošana, validācija)
 * 4. Personīgo grāmatu plauktu (saglabāšana, dzēšana no plaukta)
 * 5. Lasīšanas progresu un sesiju uzskaiti (lapu pieskaitīšana, laika uzskaite, kļūdu apstrāde)
 * 6. Statistiku, lasīšanas tempu un sasniegumus
 * 7. Atsauksmju un 5 zvaigžņu vērtēšanas moduli (grāmatai un platformai)
 */

const http = require('http');
const assert = require('assert');

process.env.PORT = '5055';
const app = require('../backend/server');

const BASE_URL = 'http://localhost:5055';

// Helper: HTTP pieprasījumu veikšanai ar sīkdatņu (session cookie) atbalstu
function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }

        const setCookie = res.headers['set-cookie'];
        const responseCookie = setCookie ? setCookie[0].split(';')[0] : cookie;

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          cookie: responseCookie,
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ============================================================================
// 1. LIETOTĀJA REĢISTRĀCIJAS TESTI
// ============================================================================
test('1.1. Veiksmīga reģistrācija ar pareiziem datiem', async () => {
  const timestamp = Date.now();
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: 'Janis',
    last_name: 'Berzins',
    email: `test_user_${timestamp}@limb.lv`,
    password: 'Password123',
    rep_password: 'Password123',
  });
  assert.strictEqual(res.status, 201, 'Jābūt statusam 201 Created');
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.lietotajs_id, 'Jābūt atgrieztam jaunā lietotāja ID');
});

test('1.2. Reģistrācija ar jau izmantotu e-pastu (dublikāts)', async () => {
  const dupEmail = `dup_user_${Date.now()}@limb.lv`;
  await makeRequest('POST', '/api/users/register', {
    first_name: 'Pirmais',
    last_name: 'Lietotajs',
    email: dupEmail,
    password: 'Password123',
    rep_password: 'Password123',
  });
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: 'Otrais',
    last_name: 'Dublikats',
    email: dupEmail,
    password: 'Password123',
    rep_password: 'Password123',
  });
  assert.strictEqual(res.status, 400, 'Jābūt statusam 400 Bad Request');
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.error.includes('already registered') || res.body.error.includes('reģistrēts'));
});

test('1.3. Reģistrācija ar neaizpildītiem obligātajiem laukiem', async () => {
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: '',
    last_name: 'Berzins',
    email: 'nepilns@limb.lv',
    password: 'Password123',
    rep_password: 'Password123',
  });
  assert.strictEqual(res.status, 400, 'Jābūt 400 kļūdai pie tukša vārda');
  assert.strictEqual(res.body.success, false);
});

test('1.4. Reģistrācija ar nesakrītošām parolēm', async () => {
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: 'Janis',
    last_name: 'Berzins',
    email: `diff_pass_${Date.now()}@limb.lv`,
    password: 'Password123',
    rep_password: 'DifferentPassword456',
  });
  assert.strictEqual(res.status, 400, 'Jābūt 400 kļūdai par nesakrītošām parolēm');
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.error.includes('do not match') || res.body.error.includes('nesakrīt'));
});

test('1.5. Paroles garuma robežvērtība (<6 simboli)', async () => {
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: 'Janis',
    last_name: 'Berzins',
    email: `short_pass_${Date.now()}@limb.lv`,
    password: '12345',
    rep_password: '12345',
  });
  assert.strictEqual(res.status, 400, 'Jābūt 400 kļūdai par pārāk īsu paroli');
  assert.strictEqual(res.body.success, false);
});

// ============================================================================
// 2. PIESLĒGŠANĀS UN SESIJAS PĀRVALDĪBA
// ============================================================================
let userSessionCookie = null;
const testEmail = `auth_tester_${Date.now()}@limb.lv`;
const testPassword = 'SecurePassword123';

test('2.1. Sagatavošana - testa lietotāja reģistrēšana', async () => {
  const res = await makeRequest('POST', '/api/users/register', {
    first_name: 'Arturs',
    last_name: 'Krumins',
    email: testEmail,
    password: testPassword,
    rep_password: testPassword,
  });
  assert.strictEqual(res.status, 201);
});

test('2.2. Pieslēgšanās ar nepareizu paroli', async () => {
  const res = await makeRequest('POST', '/api/users/login', {
    email: testEmail,
    password: 'WrongPassword999',
  });
  assert.strictEqual(res.status, 401, 'Jābūt 401 Unauthorized');
  assert.strictEqual(res.body.success, false);
});

test('2.3. Pieslēgšanās ar neeksistējošu e-pastu', async () => {
  const res = await makeRequest('POST', '/api/users/login', {
    email: 'non_existing_9999@limb.lv',
    password: 'SomePassword',
  });
  assert.strictEqual(res.status, 401, 'Jābūt 401 Unauthorized');
  assert.strictEqual(res.body.success, false);
});

test('2.4. Veiksmīga pieslēgšanās un sesijas iegūšana', async () => {
  const res = await makeRequest('POST', '/api/users/login', {
    email: testEmail,
    password: testPassword,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.cookie, 'Serverim jāatgriež sesijas sīkdatne (connect.sid)');
  userSessionCookie = res.cookie;
});

test('2.5. Autorizētā lietotāja profila iegūšana (/api/users/me)', async () => {
  const res = await makeRequest('GET', '/api/users/me', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.user.epasts, testEmail);
  assert.strictEqual(res.body.user.vards, 'Arturs');
});

test('2.6. Neautorizēta piekļuve profilam bez sesijas', async () => {
  const res = await makeRequest('GET', '/api/users/me', null, null);
  assert.strictEqual(res.status, 401, 'Bez sesijas jābūt 401');
  assert.strictEqual(res.body.success, false);
});

// ============================================================================
// 3. BIBLIOTĒKA UN GRĀMATU PĀRVALDĪBA
// ============================================================================
let createdBookId = null;

test('3.1. Grāmatu saraksta iegūšana (/api/books)', async () => {
  const res = await makeRequest('GET', '/api/books');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body), 'Jābūt masīvam ar grāmatām');
  assert.ok(res.body.length > 0, 'Bibliotēkā jābūt vismaz vienai sēklas grāmatai');
});

test('3.2. Grāmatu meklēšana pēc nosaukuma', async () => {
  const res = await makeRequest('GET', '/api/books?search=Never');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const found = res.body.some((b) => b.nosaukums.toLowerCase().includes('never'));
  assert.ok(found, 'Jāatrod grāmata ar "Never" nosaukumā');
});

test('3.3. Jaunas grāmatas pievienošana bibliotēkai ar pareiziem datiem', async () => {
  const newBook = {
    nosaukums: `Testa Grāmata ${Date.now()}`,
    autors: 'Valdis Grāmatnieks',
    lapas_kopa: 250,
    zanrs: 'Zinātniskā fantastika',
    atsauksmes_atskaites: 0.0,
  };
  const res = await makeRequest('POST', '/api/books', newBook, userSessionCookie);
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.gramata_id);
  createdBookId = res.body.gramata_id;
});

test('3.4. Grāmatas pievienošana bez obligātā nosaukuma (validācija)', async () => {
  const invalidBook = {
    nosaukums: '',
    autors: 'Kāds Autors',
    lapas_kopa: 100,
  };
  const res = await makeRequest('POST', '/api/books', invalidBook, userSessionCookie);
  assert.strictEqual(res.status, 400, 'Jābūt 400 kļūdai par trūkstošu nosaukumu');
});

// ============================================================================
// 4. PERSONĪGAIS GRĀMATU PLAUKTS (SAGLABĀŠANA UN DZĒŠANA)
// ============================================================================
test('4.1. Grāmatas saglabāšana savā plauktā (/api/books/:id/save)', async () => {
  assert.ok(createdBookId, 'Jābūt iepriekš izveidotai grāmatai');
  const res = await makeRequest('POST', `/api/books/${createdBookId}/save`, null, userSessionCookie);
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.message.includes('saglabāta') || res.body.message.includes('plauktā'));
});

test('4.2. Saglabāto grāmatu saraksta iegūšana (/api/books/saved)', async () => {
  const res = await makeRequest('GET', '/api/books/saved', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const hasBook = res.body.some((b) => Number(b.gramata_id) === Number(createdBookId));
  assert.ok(hasBook, 'Tikko saglabātajai grāmatai jābūt lietotāja plauktā');
});

test('4.3. Grāmatas saglabāšanas mēģinājums bez autorizācijas', async () => {
  const res = await makeRequest('POST', `/api/books/${createdBookId}/save`, null, null);
  assert.strictEqual(res.status, 401, 'Neautorizēts pieprasījums jānoraida ar 401');
});

test('4.4. Grāmatas izņemšana no plaukta (/api/books/:id/save DELETE)', async () => {
  const res = await makeRequest('DELETE', `/api/books/${createdBookId}/save`, null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.message.includes('izņemta') || res.body.message.includes('plaukta'));
});

// ============================================================================
// 5. LASĪŠANAS PROGRESA UN SESIJU UZSKAITE
// ============================================================================
test('5.1. Grāmatas pievienošana aktīvi lasāmajām (/api/reading/start)', async () => {
  const booksRes = await makeRequest('GET', '/api/books');
  const targetBook = booksRes.body.find((b) => b.nosaukums === 'Never Lie') || booksRes.body[0];

  const res = await makeRequest('POST', '/api/reading/start', {
    gramata_id: targetBook.gramata_id,
  }, userSessionCookie);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
});

test('5.2. Aktīvi lasāmo grāmatu saraksta pārbaude (/api/reading/current)', async () => {
  const res = await makeRequest('GET', '/api/reading/current', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.books));
  assert.ok(res.body.books.length > 0, 'Jābūt vismaz vienai aktīvi lasāmai grāmatai');
});

test('5.3. Progresa reģistrēšana - lapu un laika pieskaitīšana (/api/reading/log)', async () => {
  const currentBooks = await makeRequest('GET', '/api/reading/current', null, userSessionCookie);
  const book = currentBooks.body.books[0];

  const res = await makeRequest('POST', '/api/reading/log', {
    gramata_id: book.gramata_id,
    pages_read: 20,
    reading_time_minutes: 25,
  }, userSessionCookie);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.updatedBook);
  assert.ok(res.body.updatedBook.lapaspuses_izlasitas >= 20);
});

test('5.4. Progresa reģistrēšana ar nederīgām lapaspusēm (0 vai negatīvs)', async () => {
  const currentBooks = await makeRequest('GET', '/api/reading/current', null, userSessionCookie);
  const book = currentBooks.body.books[0];

  const res = await makeRequest('POST', '/api/reading/log', {
    gramata_id: book.gramata_id,
    pages_read: -5,
    reading_time_minutes: 10,
  }, userSessionCookie);

  assert.strictEqual(res.status, 400, 'Par negatīvām lapām jābūt 400 kļūdai');
  assert.strictEqual(res.body.success, false);
});

// ============================================================================
// 6. STATISTIKA, TEMPS UN SASNIEGUMI
// ============================================================================
test('6.1. Lietotāja kopsavilkuma statistikas iegūšana (/api/statistics/summary)', async () => {
  const res = await makeRequest('GET', '/api/statistics/summary', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok('totalPages' in res.body);
  assert.ok('totalBooks' in res.body);
  assert.ok('favoriteAuthor' in res.body);
  assert.ok('averagePace' in res.body);
  assert.ok(res.body.totalPages >= 20, 'Lapaspušu skaitam jābūt vismaz 20');
});

test('6.2. Mēneša heatmap datu iegūšana (/api/statistics/monthly)', async () => {
  const res = await makeRequest('GET', '/api/statistics/monthly?year=2026&month=10', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.month, 10);
  assert.strictEqual(res.body.year, 2026);
  assert.ok(Array.isArray(res.body.days));
  assert.strictEqual(res.body.days.length, 31, 'Oktobrī ir 31 diena');
});

test('6.3. Sasniegumu saraksta un progresa pārbaude (/api/statistics/achievements)', async () => {
  const res = await makeRequest('GET', '/api/statistics/achievements', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.achievements));
  assert.ok(res.body.achievements.length >= 7, 'Jābūt definētiem visiem sistēmas sasniegumiem');
  const beginner = res.body.achievements.find((a) => a.nosaukums === 'Iesācējs');
  assert.ok(beginner, 'Jābūt sasniegumam "Iesācējs"');
});

// ============================================================================
// 7. ATSAUKSMES UN 5 ZVAIGŽŅU VĒRTĒŠANAS SISTĒMA
// ============================================================================
test('7.1. Atsauksmes iesniegšana par grāmatu (5 zvaigznes)', async () => {
  const currentBooks = await makeRequest('GET', '/api/reading/current', null, userSessionCookie);
  const book = currentBooks.body.books[0];

  const res = await makeRequest('POST', '/api/reading/review', {
    gramata_id: book.gramata_id,
    vertejums: 5,
    recenzija: 'Aizraujoša grāmata, sižeta pavērsieni bija neparedzami!',
  }, userSessionCookie);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
});

test('7.2. Grāmatas vērtējuma robežvērtību pārbaude (nederīgs vērtējums 6)', async () => {
  const booksRes = await makeRequest('GET', '/api/books');
  const bookId = booksRes.body[0].gramata_id;

  const res = await makeRequest('POST', '/api/reading/review', {
    gramata_id: bookId,
    vertejums: 6, // Ārpus 1-5 robežām
    recenzija: 'Pārāk labs',
  }, userSessionCookie);

  assert.strictEqual(res.status, 400, 'Vērtējumam 6 jāatgriež 400');
  assert.strictEqual(res.body.success, false);
});

test('7.3. Atsauksmes pievienošana par platformu sākumlapai (/api/reviews)', async () => {
  const res = await makeRequest('POST', '/api/reviews', {
    autora_vards: 'Arturs Krumins',
    tips: 'sistema',
    vertejums: 5,
    teksts: 'Lielisks dizains un ērta statistikas pārskatāmība!',
  }, userSessionCookie);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.review);
  assert.strictEqual(res.body.review.autora_vards, 'Arturs Krumins');
});

test('7.4. Jaunāko atsauksmju ielāde sākumlapai (/api/reviews/latest)', async () => {
  const res = await makeRequest('GET', '/api/reviews/latest?limit=6');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.reviews));
  assert.ok(res.body.reviews.length > 0);
  assert.strictEqual(res.body.reviews[0].autora_vards, 'Arturs Krumins');
});

// ============================================================================
// 8. IZIEŠANA NO PROFILA (LOGOUT)
// ============================================================================
test('8.1. Iziešana no profila un sesijas izbeigšana (/api/users/logout)', async () => {
  const res = await makeRequest('POST', '/api/users/logout', null, userSessionCookie);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  // Pārbauda, ka pēc iziešanas me pieprasījums atgriež 401
  const checkRes = await makeRequest('GET', '/api/users/me', null, userSessionCookie);
  assert.strictEqual(checkRes.status, 401, 'Pēc izrakstīšanās sesija ir neaktīva');
});

// ============================================================================
// IZPILDĪTĀJS UN REZULTĀTU APKOPOŠANA
// ============================================================================
async function runTests() {
  console.log('='.repeat(70));
  console.log(' LOOK IN MY BOOK - AUTOMATIZĒTĀ TESTĒŠANAS KOPA (TEST SUITE)');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const t of tests) {
    process.stdout.write(`• ${t.name.padEnd(62, '.')} `);
    try {
      await t.fn();
      console.log('[\x1b[32mPAREIZI / PASS\x1b[0m]');
      passed++;
    } catch (err) {
      console.log('[\x1b[31mKĻŪDA / FAIL\x1b[0m]');
      console.error(`  -> Kļūdas apraksts: ${err.message}`);
      failed++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('='.repeat(70));
  console.log(`KOPĀ TESTU: ${tests.length} | IZPILDĪTI: ${passed} | NEIZDEVĀS: ${failed} | LAIKS: ${duration}s`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Palaist testus pēc tam, kad serveris gatavs
setTimeout(runTests, 800);
