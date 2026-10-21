const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType
} = require('docx');

const FONT_NAME = 'Times New Roman';
const CODE_FONT = 'Consolas';

// Crisp solid black borders matching the user's screenshot
const blackBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '000000'
};

const tableBorders = {
  top: blackBorder,
  bottom: blackBorder,
  left: blackBorder,
  right: blackBorder,
  insideHorizontal: blackBorder,
  insideVertical: blackBorder
};

// Shading for table header matching screenshot
const HEADER_BG = 'BFBFBF';

function p(text, options = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({
        text,
        font: FONT_NAME,
        size: options.size || 24, // 12pt default
        bold: !!options.bold,
        italics: !!options.italics,
        color: options.color || '000000'
      })];
  return new Paragraph({
    children: runs,
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: {
      before: options.before !== undefined ? options.before : 60,
      after: options.after !== undefined ? options.after : 120,
      line: options.line || 276 // ~1.15 line spacing
    }
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: FONT_NAME, size: 32, bold: true, color: '000000' })],
    spacing: { before: 240, after: 180 }
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: FONT_NAME, size: 28, bold: true, color: '000000' })],
    spacing: { before: 200, after: 140 }
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: FONT_NAME, size: 24, bold: true, color: '000000' })],
    spacing: { before: 160, after: 100 }
  });
}

// Table number and title formatted matching user's screenshot:
// Right-aligned: "8.X. Tabula"
// Centered: "Title text" (Bold)
function makeTableHeadings(tabulaNr, title) {
  return [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: tabulaNr,
          font: FONT_NAME,
          size: 22, // 11pt
          bold: true
        })
      ],
      spacing: { before: 240, after: 40 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: title,
          font: FONT_NAME,
          size: 22, // 11pt
          bold: true
        })
      ],
      spacing: { before: 0, after: 100 }
    })
  ];
}

// Table cell with compact academic font size (9.5pt = 19 half-points)
function tableCell(content, options = {}) {
  const textSize = options.size || 19; // 9.5pt
  const children = Array.isArray(content)
    ? content
    : [
        new Paragraph({
          children: [
            new TextRun({
              text: content,
              font: FONT_NAME,
              size: textSize,
              bold: !!options.bold,
              italics: !!options.italics,
              color: options.color || '000000'
            })
          ],
          alignment: options.alignment || AlignmentType.LEFT,
          spacing: {
            before: options.before !== undefined ? options.before : 20,
            after: options.after !== undefined ? options.after : 20,
            line: 240 // single line spacing inside tables
          }
        })
      ];

  const cellObj = {
    children,
    borders: tableBorders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 }
  };

  if (options.widthPercent) {
    cellObj.width = { size: options.widthPercent, type: WidthType.PERCENTAGE };
  }
  if (options.shadingColor) {
    cellObj.shading = { fill: options.shadingColor, type: ShadingType.CLEAR };
  }
  if (options.columnSpan) {
    cellObj.columnSpan = options.columnSpan;
  }
  return new TableCell(cellObj);
}

// Header cell matching the screenshot: Bold + Italic + Gray background + 9.5pt/10pt
function tableHeaderCell(text, widthPercent, alignment = AlignmentType.LEFT) {
  return tableCell(text, {
    bold: true,
    italics: true,
    size: 19,
    widthPercent,
    alignment,
    shadingColor: HEADER_BG
  });
}

function createDoc() {
  const children = [];

  // 8. TESTĒŠANA
  children.push(h1('8. TESTĒŠANA'));

  // 8.1. Testēšanas plāna izveide
  children.push(h2('8.1. Testēšanas plāna izveide'));
  children.push(p(
    'Testēšanas mērķis ir pārliecināties par lietotāja iespēju piereģistrēties un pierakstīties, un vai lietojumprogramma spēj apstrādāt gan pareizi ievadītus datus, gan nepareizi atbilstoši reaģējot uz tiem. Testēšana arī pārliecinātos par lietotāja spēju pievienot jaunas grāmatas, pievienot tās savam grāmatu plauktam, atzīmēt progresu, iesniegt atsauksmi par grāmatu un iziet no profila.'
  ));

  children.push(h3('8.1.1. Testējamie moduļi un funkcionalitāte'));
  children.push(p('Programmsistēmas testēšanai tika izdalīti šādi galvenie moduļi:'));
  const modules = [
    ['1. Lietotāju autentifikācijas un profila pārvaldības modulis', ' – lietotāja reģistrācija, datu validācija, pieteikšanās sistēmā, sesijas uzturēšana, profila datu un iegūto sasniegumu attēlošana, izrakstīšanās (logout).'],
    ['2. Bibliotēkas un personīgā grāmatu plaukta modulis', ' – globālā grāmatu kataloga pārlūkošana, meklēšana un filtrēšana, jaunu grāmatu pievienošana bibliotēkai, grāmatu saglabāšana lietotāja personīgajā plauktā un izņemšana no tā.'],
    ['3. Lasīšanas progresa un sesiju uzskaites modulis', ' – aktīvi lasāmo grāmatu saraksts, izlasīto lapaspušu un lasīšanas laika pieskaitīšana, progresa joslas vizualizācija, pabeigšanas noteikšana.'],
    ['4. Statistikas, lasīšanas tempa un sasniegumu modulis', ' – kopējās statistikas apkopošana (lapaspuses, pabeigtās grāmatas, iecienītākais autors), vidējā tempa aprēķins (lapas/min), mēneša dienu aktivitātes kalendārs (heatmap), sasniegumu automātiska piešķiršana.'],
    ['5. Atsauksmju un 5 zvaigžņu vērtēšanas modulis', ' – grāmatu novērtēšana pēc izlasīšanas, platformas vispārējo atsauksmju pievienošana un jaunāko atsauksmju dinamiska attēlošana sākumlapā.']
  ];
  for (const m of modules) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: m[0], font: FONT_NAME, size: 24, bold: true }),
        new TextRun({ text: m[1], font: FONT_NAME, size: 24 })
      ],
      spacing: { before: 40, after: 60 }
    }));
  }

  children.push(h3('8.1.2. Izvēlētie testēšanas veidi'));
  children.push(p('Lai nodrošinātu vispusīgu programmsistēmas pārbaudi, tika pielietotas šādas testēšanas metodes:'));
  const types = [
    ['Funkcionālā testēšana (melnās kastes metode)', ' – pārbauda, vai sistēmas funkcijas atbilst izvirzītajām prasībām.'],
    ['Robežvērtību testēšana (Boundary Value Analysis)', ' – pārbauda sistēmas uzvedību pie minimālajām, maksimālajām un nekorektajām datu ievades robežām (piem., paroles garums, vērtējuma skala 1–5, lapaspušu skaits).'],
    ['Kļūdu un negatīvā testēšana', ' – pārbauda, vai sistēma korekti reaģē uz kļūdainiem, nepilnīgiem vai dublētiem datiem, nodrošinot informatīvus kļūdu paziņojumus un datubāzes integritāti.'],
    ['Integrācijas testēšana', ' – pārbauda savstarpējo mijiedarbību starp klienta saskarni, REST API maršrutiem un SQLite datubāzi.'],
    ['Regresijas testēšana', ' – atkārtota testu izpilde pēc identificēto kļūdu novēršanas un sistēmas uzlabojumu veikšanas.']
  ];
  for (const t of types) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: '• ' + t[0], font: FONT_NAME, size: 24, bold: true }),
        new TextRun({ text: t[1], font: FONT_NAME, size: 24 })
      ],
      spacing: { before: 40, after: 60 }
    }));
  }

  // 8.2. Programmsistēmas testēšanas veikšana un rezultāti
  children.push(h2('8.2. Programmsistēmas testēšanas veikšana un rezultāti'));
  children.push(p(
    'Tika veikta lietotāju autentifikācijas, grāmatu pārvaldības, progresa fiksēšanas, statistikas un atsauksmju moduļu testēšana. Tabulā 8.1. apkopoti funkcionālās testēšanas scenāriji, prasības, sagaidāmie un faktiskie rezultāti.'
  ));

  // Heading for Table 8.1
  children.push(...makeTableHeadings('8.1. Tabula', 'Funkcionālās testēšanas dati'));

  // Table 8.1
  const t81Rows = [];

  function addRequirementBlock(role, reqId, reqDesc, tests) {
    // Header block
    t81Rows.push(new TableRow({
      children: [
        tableCell('Lietotāja loma:', { bold: true, widthPercent: 24 }),
        tableCell(role, { bold: true, widthPercent: 76, columnSpan: 4 })
      ]
    }));
    t81Rows.push(new TableRow({
      children: [
        tableCell('Prasības identifikators:', { bold: true, widthPercent: 24 }),
        tableCell(reqId, { bold: true, widthPercent: 76, columnSpan: 4 })
      ]
    }));
    t81Rows.push(new TableRow({
      children: [
        tableCell('Prasības apraksts:', { bold: true, widthPercent: 24 }),
        tableCell(reqDesc, { widthPercent: 76, columnSpan: 4 })
      ]
    }));
    // Columns header row (matching screenshot style)
    t81Rows.push(new TableRow({
      children: [
        tableHeaderCell('Nr.', 6, AlignmentType.LEFT),
        tableHeaderCell('Ievaddati / situācijas apraksts', 34),
        tableHeaderCell('Sagaidāmais rezultāts', 28),
        tableHeaderCell('Faktiskais rezultāts', 22),
        tableHeaderCell('Statuss', 10, AlignmentType.LEFT)
      ]
    }));
    // Tests rows
    for (const test of tests) {
      t81Rows.push(new TableRow({
        children: [
          tableCell(test[0] + '.', { alignment: AlignmentType.LEFT, widthPercent: 6 }),
          tableCell(test[1], { widthPercent: 34 }),
          tableCell(test[2], { widthPercent: 28 }),
          tableCell(test[3], { widthPercent: 22 }),
          tableCell(test[4], { alignment: AlignmentType.LEFT, widthPercent: 10 })
        ]
      }));
    }
  }

  addRequirementBlock(
    'Nereģistrējies lietotājs / Reģistrēts lietotājs',
    'PS 2.2.1. (Reģistrācija un autorizācija)',
    'Jānodrošina, ka lietotājs var izveidot jaunu kontu ar unikāliem datiem un autorizēties sistēmā, saņemot atbilstošus paziņojumus pie kļūdainas ievades.',
    [
      [1, 'Nereģistrēts lietotājs reģistrējas ar korektiem, iepriekš neizmantotiem datiem (first_name, last_name, email, password, rep_password).', 'Profils tiek veiksmīgi izveidots (HTTP 201), lietotājs var pieslēgties sistēmai.', 'Lietotājs tika reģistrēts, atgriezts statuss 201 un izveidots profila ID.', 'Pareizi'],
      [2, 'Nereģistrēts lietotājs mēģina reģistrēties ar sistēmā jau eksistējošu e-pasta adresi.', 'Profils netiek izveidots (HTTP 400), parādās informatīvs paziņojums, ka e-pasts jau ir aizņemts.', 'Parādīts paziņojums par aizņemtu e-pastu, pieprasījums noraidīts.', 'Pareizi'],
      [3, 'Reģistrācijas formā netiek aizpildīts kāds no obligātajiem laukiem (piemēram, vārds vai e-pasts).', 'Profils netiek izveidots (HTTP 400), sistēma pieprasa aizpildīt visus laukus.', 'Reģistrācija apturēta, pieprasīts aizpildīt visus laukus.', 'Pareizi'],
      [4, 'Reģistrācijas formā paroles apstiprinājums nesakrīt ar ievadīto paroli.', 'Profils netiek izveidots (HTTP 400), lietotājam tiek paziņots par nesakrītošām parolēm.', 'Tiek attēlots kļūdas paziņojums, ka paroles nesakrīt.', 'Pareizi'],
      [5, 'Reģistrēts lietotājs autorizējas ar pareizu e-pastu un paroli.', 'Tiek izveidota droša sesija (connect.sid), lietotājs tiek ielogots, navigācijā parādās profila iniciālis.', 'Autorizācija veiksmīga, sesija izveidota, navigācijā attēlots iniciālis.', 'Pareizi'],
      [6, 'Lietotājs autorizācijas formā ievada nepareizu paroli vai neeksistējošu e-pastu.', 'Piekļuve tiek liegta (HTTP 401), parādās paziņojums par nederīgu e-pastu vai paroli.', 'Parādīts kļūdas paziņojums, piekļuve liegta.', 'Pareizi']
    ]
  );

  addRequirementBlock(
    'Reģistrēts lietotājs',
    'PS 2.3.1. (Bibliotēka un personīgais plaukts)',
    'Jānodrošina iespēja pārlūkot grāmatas, veikt meklēšanu, pievienot jaunas grāmatas bibliotēkai un saglabāt tās personīgajā plauktā.',
    [
      [7, 'Lietotājs atver bibliotēkas lapu (library.html) un ievada meklēšanas frāzi (piem., "Never").', 'Saraksts dinamiski filtrējas, attēlojot tikai tās grāmatas, kuru nosaukumā ir meklētais vārds.', 'Tiek atlasītas un parādītas atbilstošās grāmatas.', 'Pareizi'],
      [8, 'Lietotājs bibliotēkā nospiež pogu "+" un aizpilda jaunas grāmatas formu (nosaukums, autors, lapas, žanrs).', 'Grāmata tiek saglabāta datubāzē (HTTP 201), modālais logs aizveras un grāmata parādās sarakstā.', 'Grāmata pievienota datubāzei un uzreiz attēlota sarakstā.', 'Pareizi'],
      [9, 'Lietotājs bibliotēkā pie grāmatas nospiež "＋ Saglabāt sev".', 'Grāmata tiek piesaistīta lietotāja plauktam (personiga_gramatu_kratuve), poga mainās uz "✓ Saglabāta manā plauktā".', 'Grāmata pievienota plauktam, poga vizuāli atjaunojas.', 'Pareizi'],
      [10, 'Lietotājs nospiež pogu "✓ Saglabāta manā plauktā" atkārtoti.', 'Grāmata tiek izņemta no personīgā plaukta, poga atgriežas sākotnējā stāvoklī.', 'Ieraksts dzēsts no plaukta, parādās paziņojums.', 'Pareizi']
    ]
  );

  addRequirementBlock(
    'Reģistrēts lietotājs',
    'PS 2.4.1. (Lasīšanas progress, statistika un sasniegumi)',
    'Jānodrošina pašlaik lasāmo grāmatu uzskaite, izlasīto lapaspušu un laika reģistrācija, progresa joslas un statistikas automātiska pārrēķināšana.',
    [
      [11, 'Informācijas panelī pie lasāmās grāmatas lietotājs ievada izlasītās lapas (piem., 20) un laiku (piem., 25 min), spiežot "Saglabāt".', 'Lapaspuses tiek pieskaitītas, sesija saglabāta, progresa josla pieaug, statistika un temps tiek pārrēķināti.', 'Lapaspuses pieskaitītas, progresa % atjaunots, sesija reģistrēta.', 'Pareizi'],
      [12, 'Grāmatas izlasīto lapaspušu skaits sasniedz 100% no kopējā apjoma.', 'Grāmatai parādās pabeigšanas pārklājums ("Grāmata pabeigta!") ar aicinājumu iesniegt atsauksmi.', 'Attēlots pabeigšanas pārklājums un poga "Iesniegt atsauksmi".', 'Pareizi'],
      [13, 'Lietotājs atver statistikas skatu (statistics.html).', 'Tiek precīzi parādīts kopējais lapaspušu skaits, pabeigtās grāmatas, mīļākais autors, mēneša heatmap un sasniegumi.', 'Visi rādītāji tiek korekti aprēķināti un vizualizēti.', 'Pareizi'],
      [14, 'Lietotājs izpilda sasnieguma nosacījumu (piem., izlasīta 1 grāmata).', 'Sasniegums "Iesācējs" automātiski iegūst 100% statusu un tiek piešķirts profilam.', 'Sasniegums atzīmēts kā iegūts, skaits kopsavilkumā palielināts.', 'Pareizi']
    ]
  );

  addRequirementBlock(
    'Reģistrēts lietotājs / Apmeklētājs',
    'PS 2.5.1. (Atsauksmes, vērtēšana un profila iziešana)',
    'Jānodrošina iespēja novērtēt grāmatas un sistēmu ar 1–5 zvaigznēm un komentāru, attēlot jaunākās atsauksmes sākumlapā un droši iziet no profila.',
    [
      [15, 'Lietotājs novērtē izlasīto grāmatu ar 5 zvaigznēm un komentāru modālajā logā.', 'Atsauksme tiek saglabāta, grāmata atzīmēta kā izlasits, grāmatas reitings atjaunots un piešķirts žetons "Kritiķis".', 'Atsauksme saglabāta, statuss nomainīts, žetons piešķirts.', 'Pareizi'],
      [16, 'Sākumlapā lietotājs pievieno jaunu atsauksmi par sistēmu ("Look in My Book").', 'Atsauksme tiek saglabāta datubāzē un parādās sākumlapas jaunāko atsauksmju saraksta augšgalā.', 'Atsauksme pievienota un tūlītēji attēlota sākumlapā.', 'Pareizi'],
      [17, 'Lietotājs profilā vai navigācijā nospiež pogu "Izrakstīties".', 'Sesija tiek iznīcināta serverī, notīrīti lokālie dati (localStorage), lietotājs novirzīts uz sākumlapu (hero.html).', 'Sesija slēgta, autorizācijas dati notīrīti, notikusi pāradresācija.', 'Pareizi']
    ]
  );

  children.push(new Table({
    rows: t81Rows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  children.push(p(
    'Lai detalizēti pārbaudītu reģistrācijas, autorizācijas, grāmatu datu ievades un vērtēšanas robežgadījumus un kļūdu situācijas, tika izpildīti robežvērtību un negatīvie testa gadījumi. Katrā testa gadījumā tika salīdzināts sagaidāmais rezultāts ar faktiski iegūto rezultātu. Testa gadījumu rezultāti apkopoti 8.2. tabulā.',
    { before: 140 }
  ));

  // Heading for Table 8.2
  children.push(...makeTableHeadings('8.2. Tabula', 'Detalizētās testēšanas dati (robežvērtību un kļūdu testi)'));

  // Table 8.2
  const t82Rows = [
    new TableRow({
      children: [
        tableHeaderCell('Nr.', 6, AlignmentType.LEFT),
        tableHeaderCell('Testa gadījums', 26),
        tableHeaderCell('Ievaddati / darbība', 30),
        tableHeaderCell('Sagaidāmais rezultāts', 20),
        tableHeaderCell('Faktiskais rezultāts', 18),
        tableHeaderCell('Statuss', 10, AlignmentType.LEFT)
      ]
    })
  ];

  const t82Data = [
    [1, 'Veiksmīga lietotāja reģistrācija', 'Vārds: Janis, Uzvārds: Berzins, E-pasts: unikals@limb.lv, Parole: Password123', 'Konts tiek izveidots (HTTP 201)', 'Konts izveidots', 'Pareizi'],
    [2, 'Nepareizs / kļūdains e-pasts', 'E-pasta laukā ievadīts abc.lv (bez @ simbola)', 'Pārlūka validācijas kļūda, forma netiek nosūtīta', 'Kļūdas paziņojums', 'Pareizi'],
    [3, 'Tukšs vārda lauks reģistrācijā', 'Vārds nav ievadīts, pārējie lauki aizpildīti', 'Tiek pieprasīts aizpildīt lauku (HTTP 400)', 'Tiek pieprasīts aizpildīt lauku', 'Pareizi'],
    [4, 'Parole: 5 simboli (zem robežvērtības)', 'Parole: 12345 (minimālā prasība: vismaz 6 simboli)', 'Kļūdas paziņojums par nepietiekamu paroles garumu (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [5, 'Parole: 6 simboli (robežvērtība)', 'Parole: Pass6! (minimālais atļautais garums)', 'Reģistrācija atļauta (HTTP 201)', 'Reģistrācija atļauta', 'Pareizi'],
    [6, 'Parole: 8 simboli un speciālie simboli', 'Parole: !Janka68', 'Reģistrācija atļauta (HTTP 201)', 'Reģistrācija atļauta', 'Pareizi'],
    [7, 'Nesakrītošas paroles', 'Parole: Parole123, Apstiprinājums: Parole999', 'Kļūdas paziņojums "Passwords do not match" (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [8, 'Pieslēgšanās ar tukšu paroli', 'E-pasts ievadīts, parole tukša', 'Kļūdas paziņojums "Email and password are required"', 'Kļūdas paziņojums', 'Pareizi'],
    [9, 'Piekļuve aizsargātam profilam bez sesijas', 'Pieprasījums GET /api/users/me bez sesijas sīkfaila', 'HTTP 401 Unauthorized, pāradresācija uz login.html', 'HTTP 401 Unauthorized', 'Pareizi'],
    [10, 'Grāmatas pievienošana bez nosaukuma', 'Nosaukums: tukšs, Autors: "Kāds Autors"', 'Kļūdas paziņojums "Title and Author are required" (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [11, 'Grāmatas saglabāšana plauktā bez pieteikšanās', 'Nereģistrēts apmeklētājs spiež "＋ Saglabāt sev"', 'HTTP 401: "Lai saglabātu grāmatu, vispirms pieslēdzies."', 'Kļūdas paziņojums', 'Pareizi'],
    [12, 'Negatīvs izlasīto lapaspušu skaits', 'Lapaspušu skaits: -15', 'Kļūdas paziņojums, lapas netiek pieskaitītas (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [13, '0 izlasītas lapaspuses', 'Lapaspušu skaits: 0', 'Pieprasījums noraidīts, lapām jābūt > 0 (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [14, 'Vērtējuma robežvērtība: 0 zvaigznes', 'Vērtējums: 0 (atļauts 1 līdz 5)', 'Kļūdas paziņojums, atsauksme netiek saglabāta (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [15, 'Vērtējuma robežvērtība: 6 zvaigznes', 'Vērtējums: 6 (virs maksimālās robežas)', 'Kļūdas paziņojums, atsauksme netiek saglabāta (HTTP 400)', 'Kļūdas paziņojums', 'Pareizi'],
    [16, 'Vērtējuma robežvērtība: 5 zvaigznes', 'Vērtējums: 5 (maksimālais derīgais)', 'Atsauksme veiksmīgi saglabāta (HTTP 200)', 'Atsauksme saglabāta', 'Pareizi']
  ];

  for (const item of t82Data) {
    t82Rows.push(new TableRow({
      children: [
        tableCell(item[0] + '.', { alignment: AlignmentType.LEFT, widthPercent: 6 }),
        tableCell(item[1], { widthPercent: 26 }),
        tableCell(item[2], { widthPercent: 30 }),
        tableCell(item[3], { widthPercent: 20 }),
        tableCell(item[4], { widthPercent: 18 }),
        tableCell(item[5], { alignment: AlignmentType.LEFT, widthPercent: 10 })
      ]
    }));
  }

  children.push(new Table({
    rows: t82Rows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // 8.3. Kļūdu identificēšana un novēršana
  children.push(h2('8.3. Kļūdu identificēšana un novēršana'));
  children.push(p(
    'Veicot programmsistēmas testēšanu, tika identificētas vairākas kļūdas, kas ietekmēja sistēmas funkcionalitāti un lietojamību. Katrai identificētajai kļūdai tika noteikts tās cēlonis un veikti nepieciešamie labojumi. Pēc kļūdu novēršanas tika veikta atkārtota testēšana, lai pārliecinātos par veikto labojumu korektumu. Identificētās kļūdas, to cēloņi, veiktie labojumi un atkārtotās testēšanas rezultāti apkopoti 8.3. tabulā.'
  ));

  // Heading for Table 8.3 (exactly matching the user's uploaded image style!)
  children.push(...makeTableHeadings('8.3. Tabula', 'Identificēto kļūdu novēršana un atkārtotās testēšanas rezultāti'));

  // Table 8.3
  const t83Rows = [
    new TableRow({
      children: [
        tableHeaderCell('Nr.', 6, AlignmentType.LEFT),
        tableHeaderCell('Identificētā kļūda', 22),
        tableHeaderCell('Kļūdas cēlonis', 22),
        tableHeaderCell('Veiktā labošana', 24),
        tableHeaderCell('Atkārtotās testēšanas rezultāts', 16),
        tableHeaderCell('Statuss', 10, AlignmentType.LEFT)
      ]
    })
  ];

  const t83Data = [
    [1, 'Lietotājs varēja nosūtīt reģistrācijas vai grāmatas formu, neaizpildot visus obligātos laukus.', 'Formas laukiem nebija veikta obligāto vērtību pārbaude.', 'Pievienota obligāto lauku validācija un stingra servera puses pārbaude.', 'Neaizpildot laukus, sistēma pieprasa tos aizpildīt.', 'Novērsta'],
    [2, 'Navigācijas josla un lietotāja profila statuss dažādās lapās bija nekonsekvents.', 'Katrā HTML failā navigācijas kods bija dublēts atsevišķi.', 'Izveidots modulārs navigation.html un asinhrona ielāde ar navigation.js.', 'Visās lapās navigācija ielādējas vienoti un atspoguļo lietotāju.', 'Novērsta'],
    [3, 'Pēc izrakstīšanās no sistēmas pārlūks pāradresēja uz novecojušu sākuma lapu (index.html).', 'Iziešanas apstrādātājos bija saglabāta saite uz veco CRUD tabulas lapu.', 'Pāradresācija nomainīta uz hero.html un servera maršruts / iestatīts uz hero.html.', 'Lietotājs korekti nonāk sākumlapā, un sesijas dati ir notīrīti.', 'Novērsta'],
    [4, 'Neautorizēts lietotājs varēja atvērt statistikas lapu un redzēt tukšus datus.', 'Lapas ielādē netika veikta pieslēgtās sesijas pārbaude.', 'Pievienota AuthAPI.me() pārbaude pirms datu ielādes un pāradresācija uz login.html.', 'Neautorizēts lietotājs automātiski tiek novirzīts uz pieslēgšanos.', 'Novērsta'],
    [5, 'Saglabājot grāmatu personīgajā plauktā, pogas statuss neatjaunojās bez lapas pārlādes.', 'Lokālais saglabāto grāmatu ID saraksts (savedBookIds) netika sinhronizēts.', 'Pievienota savedBookIds tūlītēja atjaunošana un pogas teksta/stila pārslēgšana.', 'Poga uzreiz pārslēdzas uz "✓ Saglabāta manā plauktā".', 'Novērsta'],
    [6, 'Sasniedzot 100% lasīšanas progresu, lietotājam nebija iespējas ērti novērtēt grāmatu.', 'Trūka pabeigšanas notikuma sasaistes ar vērtēšanas modālo logu.', 'Ieviests vizuāls pārklājums ("Grāmata pabeigta!") ar pogu "Iesniegt atsauksmi".', 'Pēc pabeigšanas var uzreiz atstāt vērtējumu 1–5 zvaigžņu skalā.', 'Novērsta']
  ];

  for (const item of t83Data) {
    t83Rows.push(new TableRow({
      children: [
        tableCell(item[0] + '.', { alignment: AlignmentType.LEFT, widthPercent: 6 }),
        tableCell(item[1], { widthPercent: 22 }),
        tableCell(item[2], { widthPercent: 22 }),
        tableCell(item[3], { widthPercent: 24 }),
        tableCell(item[4], { widthPercent: 16 }),
        tableCell(item[5], { alignment: AlignmentType.LEFT, widthPercent: 10 })
      ]
    }));
  }

  children.push(new Table({
    rows: t83Rows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // 8.4. Testēšanas dokumentācija un secinājumi
  children.push(h2('8.4. Testēšanas dokumentācija un secinājumi'));
  children.push(h3('8.4.1. Automatizētās testēšanas rezultāti'));
  children.push(p(
    'Lai nodrošinātu nepārtrauktu programmsistēmas kvalitāti un atbilstību izstrādes prasībām, tika izveidots automatizēts testēšanas skripts test/test_suite.js, kas ietver 31 testa gadījumu, aptverot visus funkcionālos moduļus.'
  ));
  children.push(p('Testēšanas palaišana tiek veikta ar komandu: npm test', { bold: true }));

  const testOutputLines = [
    '======================================================================',
    ' LOOK IN MY BOOK - AUTOMATIZĒTĀ TESTĒŠANAS KOPA (TEST SUITE)',
    '======================================================================',
    '• 1.1. Veiksmīga reģistrācija ar pareiziem datiem............... [PAREIZI / PASS]',
    '• 1.2. Reģistrācija ar jau izmantotu e-pastu (dublikāts)........ [PAREIZI / PASS]',
    '• 1.3. Reģistrācija ar neaizpildītiem obligātajiem laukiem...... [PAREIZI / PASS]',
    '• 1.4. Reģistrācija ar nesakrītošām parolēm..................... [PAREIZI / PASS]',
    '• 1.5. Paroles garuma robežvērtība (<6 simboli)................. [PAREIZI / PASS]',
    '• 2.1. Sagatavošana - testa lietotāja reģistrēšana.............. [PAREIZI / PASS]',
    '• 2.2. Pieslēgšanās ar nepareizu paroli......................... [PAREIZI / PASS]',
    '• 2.3. Pieslēgšanās ar neeksistējošu e-pastu.................... [PAREIZI / PASS]',
    '• 2.4. Veiksmīga pieslēgšanās un sesijas iegūšana............... [PAREIZI / PASS]',
    '• 2.5. Autorizētā lietotāja profila iegūšana (/api/users/me).... [PAREIZI / PASS]',
    '• 2.6. Neautorizēta piekļuve profilam bez sesijas............... [PAREIZI / PASS]',
    '• 3.1. Grāmatu saraksta iegūšana (/api/books)................... [PAREIZI / PASS]',
    '• 3.2. Grāmatu meklēšana pēc nosaukuma.......................... [PAREIZI / PASS]',
    '• 3.3. Jaunas grāmatas pievienošana bibliotēkai ar pareiziem datiem [PAREIZI / PASS]',
    '• 3.4. Grāmatas pievienošana bez obligātā nosaukuma (validācija) [PAREIZI / PASS]',
    '• 4.1. Grāmatas saglabāšana savā plauktā (/api/books/:id/save).. [PAREIZI / PASS]',
    '• 4.2. Saglabāto grāmatu saraksta iegūšana (/api/books/saved)... [PAREIZI / PASS]',
    '• 4.3. Grāmatas saglabāšanas mēģinājums bez autorizācijas....... [PAREIZI / PASS]',
    '• 4.4. Grāmatas izņemšana no plaukta (/api/books/:id/save DELETE) [PAREIZI / PASS]',
    '• 5.1. Grāmatas pievienošana aktīvi lasāmajām (/api/reading/start) [PAREIZI / PASS]',
    '• 5.2. Aktīvi lasāmo grāmatu saraksta pārbaude (/api/reading/current) [PAREIZI / PASS]',
    '• 5.3. Progresa reģistrēšana - lapu un laika pieskaitīšana (/api/reading/log) [PAREIZI / PASS]',
    '• 5.4. Progresa reģistrēšana ar nederīgām lapaspusēm (0 vai negatīvs) [PAREIZI / PASS]',
    '• 6.1. Lietotāja kopsavilkuma statistikas iegūšana (/api/statistics/summary) [PAREIZI / PASS]',
    '• 6.2. Mēneša heatmap datu iegūšana (/api/statistics/monthly)... [PAREIZI / PASS]',
    '• 6.3. Sasniegumu saraksta un progresa pārbaude (/api/statistics/achievements) [PAREIZI / PASS]',
    '• 7.1. Atsauksmes iesniegšana par grāmatu (5 zvaigznes)......... [PAREIZI / PASS]',
    '• 7.2. Grāmatas vērtējuma robežvērtību pārbaude (nederīgs vērtējums 6) [PAREIZI / PASS]',
    '• 7.3. Atsauksmes pievienošana par platformu sākumlapai (/api/reviews) [PAREIZI / PASS]',
    '• 7.4. Jaunāko atsauksmju ielāde sākumlapai (/api/reviews/latest) [PAREIZI / PASS]',
    '• 8.1. Iziešana no profila un sesijas izbeigšana (/api/users/logout) [PAREIZI / PASS]',
    '======================================================================',
    'KOPĀ TESTU: 31 | IZPILDĪTI: 31 | NEIZDEVĀS: 0 | LAIKS: 0.32s',
    '======================================================================'
  ];

  const codeBoxParagraphs = testOutputLines.map(line => new Paragraph({
    children: [new TextRun({ text: line, font: CODE_FONT, size: 17, color: '1E293B' })],
    spacing: { before: 15, after: 15, line: 200 }
  }));

  children.push(new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: codeBoxParagraphs,
            borders: tableBorders,
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  children.push(h3('8.4.2. Secinājumi par programmatūras gatavību'));
  const conclusions = [
    ['1. Funkcionālo prasību izpilde: ', 'Visi izvirzītie testēšanas mērķi ir sasniegti – lietotājs var droši reģistrēties un pieslēgties sistēmai, pārvaldīt grāmatas bibliotēkā un savā plauktā, fiksēt izlasīto lapaspušu progresu un lasīšanas laiku, sekot līdzi statistikai un sasniegumiem, kā arī atstāt atsauksmes ar 5 zvaigžņu vērtējumu.'],
    ['2. Kļūdu un robežvērtību apstrāde: ', 'Sistēma demonstrē augstu stabilitāti pie nekorektiem un robežvērtību ievaddatiem (tukši lauki, nesakrītošas paroles, dublēti e-pasti, negatīvs lapu skaits, vērtējums ārpus 1–5 skalas robežām), atgriežot atbilstošus HTTP statusa kodus (400, 401, 404) un saprotamus kļūdu paziņojumus lietotāja saskarnē.'],
    ['3. Kļūdu novēršana: ', 'Visas identificētās kļūdas (navigācijas nekonsekvence, autorizācijas pārbaude statistikai, pāradresācijas pēc izrakstīšanās un datu sinhronizācija plauktā) tika dokumentētas un veiksmīgi novērstas, ko apliecina 100% pozitīvi atkārtotās testēšanas rezultāti.'],
    ['4. Gatavība ekspluatācijai: ', 'Programmatūra ir pilnībā gatava demonstrēšanai, aizstāvēšanai un praktiskai lietošanai.']
  ];
  for (const c of conclusions) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: c[0], font: FONT_NAME, size: 24, bold: true }),
        new TextRun({ text: c[1], font: FONT_NAME, size: 24 })
      ],
      spacing: { before: 60, after: 80 }
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            bottom: 1440,
            left: 1440,
            right: 1440
          }
        }
      },
      children
    }]
  });

  return doc;
}

async function main() {
  const doc = createDoc();
  const buffer = await Packer.toBuffer(doc);
  
  const target1 = path.join(__dirname, '..', 'docs', '8_TESTESANA.docx');
  const target1Fallback = path.join(__dirname, '..', 'docs', '8_TESTESANA_atjaunots.docx');
  const target2 = path.join(__dirname, '..', '8_TESTESANA.docx');
  const artifactTarget = 'C:\\Users\\Rey\\.gemini\\antigravity\\brain\\885e3df2-9ee0-4a4b-b702-720ed92365b5\\8_TESTESANA.docx';

  try {
    fs.writeFileSync(target1, buffer);
    console.log(' - ' + target1);
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.log(' - ' + target1 + ' is currently open in Word. Writing to fallback: ' + target1Fallback);
      fs.writeFileSync(target1Fallback, buffer);
    } else {
      throw err;
    }
  }

  try {
    fs.writeFileSync(target2, buffer);
    console.log(' - ' + target2);
  } catch (err) {
    console.warn('Could not write to root:', err.message);
  }

  try {
    fs.writeFileSync(artifactTarget, buffer);
    console.log(' - ' + artifactTarget);
  } catch (err) {
    // ignore
  }

  console.log('Successfully generated Word documents matching sample style!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
