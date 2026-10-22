# 8. TESTĒŠANA

## 8.1. Testēšanas plāna izveide

Testēšanas mērķis ir pārliecināties par lietotāja iespēju piereģistrēties un pierakstīties, un vai lietojumprogramma spēj apstrādāt gan pareizi ievadītus datus, gan nepareizi atbilstoši reaģējot uz tiem. Testēšana arī pārliecinātos par lietotāja spēju pievienot jaunas grāmatas, pievienot tās savam grāmatu plauktam, atzīmēt progresu, iesniegt atsauksmi par grāmatu un iziet no profila.

### 8.1.1. Testējamie moduļi un funkcionalitāte
Programmsistēmas testēšanai tika izdalīti šādi galvenie moduļi:
1. **Lietotāju autentifikācijas un profila pārvaldības modulis** – lietotāja reģistrācija, datu validācija, pieteikšanās sistēmā, sesijas uzturēšana, profila datu un iegūto sasniegumu attēlošana, izrakstīšanās (logout).
2. **Bibliotēkas un personīgā grāmatu plaukta modulis** – globālā grāmatu kataloga pārlūkošana, meklēšana un filtrēšana, jaunu grāmatu pievienošana bibliotēkai, grāmatu saglabāšana lietotāja personīgajā plauktā un izņemšana no tā.
3. **Lasīšanas progresa un sesiju uzskaites modulis** – aktīvi lasāmo grāmatu saraksts, izlasīto lapaspušu un lasīšanas laika pieskaitīšana, progresa joslas vizualizācija, pabeigšanas noteikšana.
4. **Statistikas, lasīšanas tempa un sasniegumu modulis** – kopējās statistikas apkopošana (lapaspuses, pabeigtās grāmatas, iecienītākais autors), vidējā tempa aprēķins (lapas/min), mēneša dienu aktivitātes kalendārs (heatmap), sasniegumu automātiska piešķiršana.
5. **Atsauksmju un 5 zvaigžņu vērtēšanas modulis** – grāmatu novērtēšana pēc izlasīšanas, platformas vispārējo atsauksmju pievienošana un jaunāko atsauksmju dinamiska attēlošana sākumlapā.
6. **Administrēšanas un sistēmas uzraudzības modulis** – administratora piekļuves kontrole, klientu profilu pārskatīšana, bloķēšana un dzēšana, nepiemērotu atsauksmju dzēšana un sistēmas statistikas pārskats.

### 8.1.2. Izvēlētie testēšanas veidi
Lai nodrošinātu vispusīgu programmsistēmas pārbaudi, tika pielietotas šādas testēšanas metodes:
- **Funkcionālā testēšana (melnās kastes metode)** – pārbauda, vai sistēmas funkcijas atbilst izvirzītajām funkcionālajām prasībām.
- **Robežvērtību testēšana (Boundary Value Analysis)** – pārbauda sistēmas uzvedību pie minimālajām, maksimālajām un nekorektajām datu ievades robežām (piem., paroles garums, vērtējuma skala 1–5, lapaspušu skaits, administratora pašaizsardzība).
- **Kļūdu un negatīvā testēšana** – pārbauda, vai sistēma korekti reaģē uz kļūdainiem, nepilnīgiem, dublētiem vai bloķētiem datiem, nodrošinot informatīvus kļūdu paziņojumus un datubāzes integritāti.
- **Drošības un piekļuves tiesību testēšana** – pārbauda, vai neautorizēti lietotāji un parastie klienti nevar piekļūt administratora panelim vai izpildīt administrēšanas funkcijas.
- **Integrācijas testēšana** – pārbauda savstarpējo mijiedarbību starp klienta saskarni, REST API maršrutiem un SQLite datubāzi.
- **Regresijas testēšana** – atkārtota testu izpilde pēc identificēto kļūdu novēršanas un sistēmas uzlabojumu veikšanas.

---

## 8.2. Programmsistēmas testēšanas veikšana un rezultāti

Tika veikta lietotāju autentifikācijas, grāmatu pārvaldības, progresa fiksēšanas, statistikas, atsauksmju un administrēšanas moduļu testēšana. Tabulā 8.1. apkopoti funkcionālās testēšanas scenāriji, prasības, sagaidāmie un faktiskie rezultāti.

### 8.1. Tabula
**Funkcionālās testēšanas dati**

| Lietotāja loma: | Nereģistrējies lietotājs / Reģistrēts lietotājs |
| :--- | :--- |
| **Prasības identifikators:** | **PS 2.2.1. (Reģistrācija un autorizācija)** |
| **Prasības apraksts:** | Jānodrošina, ka lietotājs var izveidot jaunu kontu ar unikāliem datiem un autorizēties sistēmā, saņemot atbilstošus paziņojumus pie kļūdainas ievades. |

| Nr. | Ievaddati / situācijas apraksts | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :---: |
| 1. | Nereģistrēts lietotājs reģistrējas ar korektiem, iepriekš neizmantotiem datiem (`first_name`, `last_name`, `email`, `password`, `rep_password`). | Profils tiek veiksmīgi izveidots (HTTP 201), lietotājs var pieslēgties sistēmai. | Lietotājs tika reģistrēts, atgriezts statuss 201 un izveidots profila ID. | Pareizi |
| 2. | Nereģistrēts lietotājs mēģina reģistrēties ar sistēmā jau eksistējošu e-pasta adresi. | Profils netiek izveidots (HTTP 400), parādās informatīvs paziņojums, ka e-pasts jau ir aizņemts. | Parādīts paziņojums par aizņemtu e-pastu, pieprasījums noraidīts. | Pareizi |
| 3. | Reģistrācijas formā netiek aizpildīts kāds no obligātajiem laukiem (piemēram, vārds vai e-pasts). | Profils netiek izveidots (HTTP 400), sistēma pieprasa aizpildīt visus laukus. | Reģistrācija apturēta, pieprasīts aizpildīt visus laukus. | Pareizi |
| 4. | Reģistrācijas formā paroles apstiprinājums nesakrīt ar ievadīto paroli. | Profils netiek izveidots (HTTP 400), lietotājam tiek paziņots par nesakrītošām parolēm. | Tiek attēlots kļūdas paziņojums, ka paroles nesakrīt. | Pareizi |
| 5. | Reģistrēts lietotājs autorizējas ar pareizu e-pastu un paroli. | Tiek izveidota droša sesija (`connect.sid`), lietotājs tiek ielogots, navigācijā parādās profila iniciālis. | Autorizācija veiksmīga, sesija izveidota, navigācijā attēlots iniciālis. | Pareizi |
| 6. | Lietotājs autorizācijas formā ievada nepareizu paroli vai neeksistējošu e-pastu. | Piekļuve tiek liegta (HTTP 401), parādās paziņojums par nederīgu e-pastu vai paroli. | Parādīts kļūdas paziņojums, piekļuve liegta. | Pareizi |

---

| Lietotāja loma: | Reģistrēts lietotājs |
| :--- | :--- |
| **Prasības identifikators:** | **PS 2.3.1. (Bibliotēka un personīgais plaukts)** |
| **Prasības apraksts:** | Jānodrošina iespēja pārlūkot grāmatas, veikt meklēšanu, pievienot jaunas grāmatas bibliotēkai un saglabāt tās personīgajā plauktā. |

| Nr. | Ievaddati / situācijas apraksts | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :---: |
| 7. | Lietotājs atver bibliotēkas lapu (`library.html`) un ievada meklēšanas frāzi (piem., "Never"). | Saraksts dinamiski filtrējas, attēlojot tikai tās grāmatas, kuru nosaukumā ir meklētais vārds. | Tiek atlasītas un parādītas atbilstošās grāmatas. | Pareizi |
| 8. | Lietotājs bibliotēkā nospiež pogu "+" un aizpilda jaunas grāmatas formu (nosaukums, autors, lapas, žanrs). | Grāmata tiek saglabāta datubāzē (HTTP 201), modālais logs aizveras un grāmata parādās sarakstā. | Grāmata pievienota datubāzei un uzreiz attēlota sarakstā. | Pareizi |
| 9. | Lietotājs bibliotēkā pie grāmatas nospiež "＋ Saglabāt sev". | Grāmata tiek piesaistīta lietotāja plauktam (`personiga_gramatu_kratuve`), poga mainās uz "✓ Saglabāta manā plauktā". | Grāmata pievienota plauktam, poga vizuāli atjaunojas. | Pareizi |
| 10. | Lietotājs nospiež pogu "✓ Saglabāta manā plauktā" atkārtoti. | Grāmata tiek izņemta no personīgā plaukta, poga atgriežas sākotnējā stāvoklī. | Ieraksts dzēsts no plaukta, parādās paziņojums. | Pareizi |

---

| Lietotāja loma: | Reģistrēts lietotājs |
| :--- | :--- |
| **Prasības identifikators:** | **PS 2.4.1. (Lasīšanas progress, statistika un sasniegumi)** |
| **Prasības apraksts:** | Jānodrošina pašlaik lasāmo grāmatu uzskaite, izlasīto lapaspušu un laika reģistrācija, progresa joslas un statistikas automātiska pārrēķināšana. |

| Nr. | Ievaddati / situācijas apraksts | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :---: |
| 11. | Informācijas panelī pie lasāmās grāmatas lietotājs ievada izlasītās lapas (piem., 20) un laiku (piem., 25 min), spiežot "Saglabāt". | Lapaspuses tiek pieskaitītas, sesija saglabāta, progresa josla pieaug, statistika un temps tiek pārrēķināti. | Lapaspuses pieskaitītas, progresa % atjaunots, sesija reģistrēta. | Pareizi |
| 12. | Grāmatas izlasīto lapaspušu skaits sasniedz 100% no kopējā apjoma. | Grāmatai parādās pabeigšanas pārklājums ("Grāmata pabeigta!") ar aicinājumu iesniegt atsauksmi. | Attēlots pabeigšanas pārklājums un poga "Iesniegt atsauksmi". | Pareizi |
| 13. | Lietotājs atver statistikas skatu (`statistics.html`). | Tiek precīzi parādīts kopējais lapaspušu skaits, pabeigtās grāmatas, mīļākais autors, mēneša heatmap un sasniegumi. | Visi rādītāji tiek korekti aprēķināti un vizualizēti. | Pareizi |
| 14. | Lietotājs izpilda sasnieguma nosacījumu (piem., izlasīta 1 grāmata). | Sasniegums "Iesācējs" automātiski iegūst 100% statusu un tiek piešķirts profilam. | Sasniegums atzīmēts kā iegūts, skaits kopsavilkumā palielināts. | Pareizi |

---

| Lietotāja loma: | Reģistrēts lietotājs / Apmeklētājs |
| :--- | :--- |
| **Prasības identifikators:** | **PS 2.5.1. (Atsauksmes, vērtēšana un profila iziešana)** |
| **Prasības apraksts:** | Jānodrošina iespēja novērtēt grāmatas un sistēmu ar 1–5 zvaigznēm un komentāru, attēlot jaunākās atsauksmes sākumlapā un droši iziet no profila. |

| Nr. | Ievaddati / situācijas apraksts | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :---: |
| 15. | Lietotājs novērtē izlasīto grāmatu ar 5 zvaigznēm un komentāru modālajā logā. | Atsauksme tiek saglabāta, grāmata atzīmēta kā `izlasits`, grāmatas reitings atjaunots un piešķirts žetons "Kritiķis". | Atsauksme saglabāta, statuss nomainīts, žetons piešķirts. | Pareizi |
| 16. | Sākumlapā lietotājs pievieno jaunu atsauksmi par sistēmu ("Look in My Book"). | Atsauksme tiek saglabāta datubāzē un parādās sākumlapas jaunāko atsauksmju saraksta augšgalā. | Atsauksme pievienota un tūlītēji attēlota sākumlapā. | Pareizi |
| 17. | Lietotājs profilā vai navigācijā nospiež pogu "Izrakstīties". | Sesija tiek iznīcināta serverī, notīrīti lokālie dati (`localStorage`), lietotājs novirzīts uz sākumlapu (`hero.html`). | Sesija slēgta, autorizācijas dati notīrīti, notikusi pāradresācija. | Pareizi |

---

| Lietotāja loma: | Administrators |
| :--- | :--- |
| **Prasības identifikators:** | **PS 2.6.1. (Administrēšana un sistēmas uzraudzība)** |
| **Prasības apraksts:** | Jānodrošina, ka administrators var piekļūt administrēšanas panelim, pārskatīt un pārvaldīt klientu profilus (bloķēt, dzēst), dzēst nepiemērotas klientu atsauksmes, kā arī liegt piekļuvi neautorizētām personām un parastiem lietotājiem. |

| Nr. | Ievaddati / situācijas apraksts | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :---: |
| 18. | Administrators autorizējas ar sistēmas ģenerēto administratora kontu (`admin@limb.lv` / `Admin123!`). | Autorizācija veiksmīga (HTTP 200), tiek izsniegta administratora sesija, navigācijā kļūst redzama saite "Administrēšana". | Piekļuve atļauta, loma `admin`, navigācijā parādās administrēšanas poga. | Pareizi |
| 19. | Administrators atver paneli (`admin.html`) un pieprasa sistēmas datus (`/api/admin/stats`). | Tiek atgriezts sistēmas kopsavilkums: kopējie lietotāji, bloķētie profili, grāmatas un atsauksmes. | Dati korekti ielādēti un atspoguļoti statistikas kartītēs. | Pareizi |
| 20. | Administrators pārlūko klientu profilus un nospiež "Bloķēt" izvēlētajam klientam, apstiprinot darbību modālajā logā. | Klienta statuss datubāzē nomainās uz `blokets` (HTTP 200), sarakstā parādās sarkana atzīme "● Bloķēts". | Statuss veiksmīgi nomainīts, lietotājs ir atzīmēts kā bloķēts. | Pareizi |
| 21. | Bloķētais klients mēģina pierakstīties savā kontā (`/api/users/login`). | Piekļuve tiek liegta (HTTP 403 Forbidden), parādās informatīvs paziņojums par bloķētu kontu. | Pieprasījums noraidīts ar kodu 403, autorizācija liegta. | Pareizi |
| 22. | Administrators administrēšanas panelī nospiež "Atbloķēt" bloķētajam klientam, apstiprinot darbību. | Klienta statuss tiek atjaunots uz `aktivs` (HTTP 200), klients var atkal sekmīgi pierakstīties. | Statuss atjaunots, klients var pieslēgties platformai. | Pareizi |
| 23. | Administrators klientu atsauksmju sadaļā dzēš nepiemērotu vai aizskarošu atsauksmi, apstiprinot dzēšanu. | Atsauksme tiek neatgriezeniski dzēsta no datubāzes (HTTP 200), un grāmatas vidējais vērtējums tiek pārrēķināts. | Atsauksme dzēsta, atjaunots grāmatas reitings. | Pareizi |
| 24. | Administrators dzēš pārkāpēja klienta profilu, apstiprinot neatgriezenisku dzēšanu modālajā logā. | Profils un visi saistītie dati (plaukts, sesijas, atsauksmes) tiek dzēsti (HTTP 200), lietotājs vairs neeksistē sistēmā. | Lietotājs un saistītie ieraksti neatgriezeniski dzēsti. | Pareizi |

---

Lai detalizēti pārbaudītu reģistrācijas, autorizācijas, datu ievades, vērtēšanas un administrēšanas robežgadījumus un kļūdu situācijas, tika izpildīti robežvērtību un negatīvie testa gadījumi. Testa gadījumu rezultāti apkopoti 8.2. tabulā.

### 8.2. Tabula
**Detalizētās testēšanas dati (robežvērtību un kļūdu testi)**

| Nr. | Testa gadījums | Ievaddati / darbība | Sagaidāmais rezultāts | Faktiskais rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1. | Veiksmīga lietotāja reģistrācija | Vārds: Janis, Uzvārds: Berzins, E-pasts: unikals@limb.lv, Parole: Password123 | Konts tiek izveidots (HTTP 201) | Konts izveidots | Pareizi |
| 2. | Nepareizs / kļūdains e-pasts | E-pasta laukā ievadīts `abc.lv` (bez @ simbola) | Pārlūka validācijas kļūda, forma netiek nosūtīta | Kļūdas paziņojums | Pareizi |
| 3. | Tukšs vārda lauks reģistrācijā | Vārds nav ievadīts, pārējie lauki aizpildīti | Tiek pieprasīts aizpildīt lauku (HTTP 400) | Tiek pieprasīts aizpildīt lauku | Pareizi |
| 4. | Parole: 5 simboli (zem robežvērtības) | Parole: `12345` (minimālā prasība: vismaz 6 simboli) | Kļūdas paziņojums par nepietiekamu paroles garumu (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 5. | Parole: 6 simboli (robežvērtība) | Parole: `Pass6!` (minimālais atļautais garums) | Reģistrācija atļauta (HTTP 201) | Reģistrācija atļauta | Pareizi |
| 6. | Parole: 8 simboli un speciālie simboli | Parole: `!Janka68` | Reģistrācija atļauta (HTTP 201) | Reģistrācija atļauta | Pareizi |
| 7. | Nesakrītošas paroles | Parole: `Parole123`, Apstiprinājums: `Parole999` | Kļūdas paziņojums "Passwords do not match" (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 8. | Pieslēgšanās ar tukšu paroli | E-pasts ievadīts, parole tukša | Kļūdas paziņojums "Email and password are required" | Kļūdas paziņojums | Pareizi |
| 9. | Piekļuve aizsargātam profilam bez sesijas | Pieprasījums `GET /api/users/me` bez sesijas sīkfaila | HTTP 401 Unauthorized, pāradresācija uz `login.html` | HTTP 401 Unauthorized | Pareizi |
| 10. | Grāmatas pievienošana bez nosaukuma | Nosaukums: tukšs, Autors: "Kāds Autors" | Kļūdas paziņojums "Title and Author are required" (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 11. | Grāmatas saglabāšana plauktā bez pieteikšanās | Nereģistrēts apmeklētājs spiež "＋ Saglabāt sev" | HTTP 401: "Lai saglabātu grāmatu, vispirms pieslēdzies." | Kļūdas paziņojums | Pareizi |
| 12. | Negatīvs izlasīto lapaspušu skaits | Lapaspušu skaits: `-15` | Kļūdas paziņojums, lapas netiek pieskaitītas (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 13. | 0 izlasītas lapaspuses | Lapaspušu skaits: `0` | Pieprasījums noraidīts, lapām jābūt > 0 (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 14. | Vērtējuma robežvērtība: 0 zvaigznes | Vērtējums: `0` (atļauts 1 līdz 5) | Kļūdas paziņojums, atsauksme netiek saglabāta (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 15. | Vērtējuma robežvērtība: 6 zvaigznes | Vērtējums: `6` (virs maksimālās robežas) | Kļūdas paziņojums, atsauksme netiek saglabāta (HTTP 400) | Kļūdas paziņojums | Pareizi |
| 16. | Vērtējuma robežvērtība: 5 zvaigznes | Vērtējums: `5` (maksimālais derīgais) | Atsauksme veiksmīgi saglabāta (HTTP 200) | Atsauksme saglabāta | Pareizi |
| 17. | Neautorizēta piekļuve administrēšanas API | Pieprasījums `GET /api/admin/stats` bez aktīvas sesijas | Piekļuve liegta (HTTP 401 Unauthorized) | HTTP 401 Unauthorized | Pareizi |
| 18. | Parasta lietotāja mēģinājums piekļūt admin API | Pieprasījums `GET /api/admin/users` ar `loma: user` sesiju | Piekļuve liegta (HTTP 403 Forbidden) | HTTP 403 Forbidden | Pareizi |
| 19. | Bloķēta konta pieteikšanās mēģinājums | Autorizācija kontam ar `statuss: 'blokets'` | Piekļuve liegta (HTTP 403), paziņojums par bloķētu kontu | HTTP 403 Forbidden | Pareizi |
| 20. | Administratora pašaizsardzība (sevis dzēšana/bloķēšana) | Administrators mēģina dzēst vai bloķēt savu ID | Pieprasījums noraidīts (HTTP 400 Bad Request), liegums sevi bloķēt/dzēst | HTTP 400 Bad Request | Pareizi |

---

## 8.3. Kļūdu identificēšana un novēršana

Veicot programmsistēmas testēšanu, tika identificētas vairākas kļūdas, kas ietekmēja sistēmas funkcionalitāti, drošību un lietojamību. Katrai identificētajai kļūdai tika noteikts tās cēlonis un veikti nepieciešamie labojumi. Pēc kļūdu novēršanas tika veikta atkārtota testēšana, lai pārliecinātos par veikto labojumu korektumu. Identificētās kļūdas, to cēloņi, veiktie labojumi un atkārtotās testēšanas rezultāti apkopoti 8.3. tabulā.

### 8.3. Tabula
**Identificēto kļūdu novēršana un atkārtotās testēšanas rezultāti**

| Nr. | Identificētā kļūda | Kļūdas cēlonis | Veiktā labošana | Atkārtotās testēšanas rezultāts | Statuss |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1. | Lietotājs varēja nosūtīt reģistrācijas vai grāmatas formu, neaizpildot visus obligātos laukus. | Formas laukiem nebija veikta obligāto vērtību pārbaude. | Pievienota obligāto lauku validācija un stingra servera puses pārbaude. | Neaizpildot laukus, sistēma pieprasa tos aizpildīt. | Novērsta |
| 2. | Navigācijas josla un lietotāja profila statuss dažādās lapās bija nekonsekvents. | Katrā HTML failā navigācijas kods bija dublēts atsevišķi. | Izveidots modulārs `navigation.html` un asinhrona ielāde ar `navigation.js`. | Visās lapās navigācija ielādējas vienoti un atspoguļo lietotāju. | Novērsta |
| 3. | Pēc izrakstīšanās no sistēmas pārlūks pāradresēja uz novecojušu sākuma lapu (`index.html`). | Iziešanas apstrādātājos bija saglabāta saite uz veco CRUD tabulas lapu. | Pāradresācija nomainīta uz `hero.html` un servera maršruts `/` iestatīts uz `hero.html`. | Lietotājs korekti nonāk sākumlapā, un sesijas dati ir notīrīti. | Novērsta |
| 4. | Neautorizēts lietotājs varēja atvērt statistikas lapu un redzēt tukšus datus. | Lapas ielādē netika veikta pieslēgtās sesijas pārbaude. | Pievienota `AuthAPI.me()` pārbaude pirms datu ielādes un pāradresācija uz `login.html`. | Neautorizēts lietotājs automātiski tiek novirzīts uz pieslēgšanos. | Novērsta |
| 5. | Saglabājot grāmatu personīgajā plauktā, pogas statuss neatjaunojās bez lapas pārlādes. | Lokālais saglabāto grāmatu ID saraksts (`savedBookIds`) netika sinhronizēts. | Pievienota `savedBookIds` tūlītēja atjaunošana un pogas teksta/stila pārslēgšana. | Poga uzreiz pārslēdzas uz "✓ Saglabāta manā plauktā". | Novērsta |
| 6. | Sasniedzot 100% lasīšanas progresu, lietotājam nebija iespējas ērti novērtēt grāmatu. | Trūka pabeigšanas notikuma sasaistes ar vērtēšanas modālo logu. | Ieviests vizuāls pārklājums ("Grāmata pabeigta!") ar pogu "Iesniegt atsauksmi". | Pēc pabeigšanas var uzreiz atstāt vērtējumu 1–5 zvaigžņu skalā. | Novērsta |
| 7. | Parasts lietotājs varēja atvērt administrēšanas lapu vai tieši izsaukt administrēšanas maršrutus. | Trūka lomas pārbaudes starpprogrammatūras pirms pieprasījumu apstrādes. | Ieviesta `requireAdmin` pārbaude serverī, kas atgriež HTTP 403 Forbidden, un pāradresācija pārlūkā. | Parastiem lietotājiem un viesiem piekļuve administrēšanai ir bloķēta. | Novērsta |
| 8. | Bloķēts lietotājs varēja turpināt autorizēties un izmantot platformu. | Pieslēgšanās pārbaudē netika vērtēts konta bloķēšanas statuss (`statuss`). | Pievienota obligāta `statuss === 'blokets'` pārbaude autorizācijā, atgriežot kļūdu 403. | Bloķētam lietotājam autorizācija tiek tūlītēji noraidīta ar paziņojumu. | Novērsta |

---

## 8.4. Testēšanas dokumentācija un secinājumi

### 8.4.1. Automatizētās testēšanas rezultāti
Lai nodrošinātu nepārtrauktu programmsistēmas kvalitāti un atbilstību visām izstrādes prasībām, tika izveidots automatizēts testēšanas skripts `test/test_suite.js`, kas ietver **42 testa gadījumus**, aptverot visus sešus funkcionālos moduļus.

Testēšanas palaišana tiek veikta ar komandu:
```bash
npm test
```

**Testēšanas izpildes atskaite:**
```text
======================================================================
 LOOK IN MY BOOK - AUTOMATIZĒTĀ TESTĒŠANAS KOPA (TEST SUITE)
======================================================================
• 1.1. Veiksmīga reģistrācija ar pareiziem datiem............... [PAREIZI / PASS]
• 1.2. Reģistrācija ar jau izmantotu e-pastu (dublikāts)........ [PAREIZI / PASS]
• 1.3. Reģistrācija ar neaizpildītiem obligātajiem laukiem...... [PAREIZI / PASS]
• 1.4. Reģistrācija ar nesakrītošām parolēm..................... [PAREIZI / PASS]
• 1.5. Paroles garuma robežvērtība (<6 simboli)................. [PAREIZI / PASS]
• 2.1. Sagatavošana - testa lietotāja reģistrēšana.............. [PAREIZI / PASS]
• 2.2. Pieslēgšanās ar nepareizu paroli......................... [PAREIZI / PASS]
• 2.3. Pieslēgšanās ar neeksistējošu e-pastu.................... [PAREIZI / PASS]
• 2.4. Veiksmīga pieslēgšanās un sesijas iegūšana............... [PAREIZI / PASS]
• 2.5. Autorizētā lietotāja profila iegūšana (/api/users/me).... [PAREIZI / PASS]
• 2.6. Neautorizēta piekļuve profilam bez sesijas............... [PAREIZI / PASS]
• 3.1. Grāmatu saraksta iegūšana (/api/books)................... [PAREIZI / PASS]
• 3.2. Grāmatu meklēšana pēc nosaukuma.......................... [PAREIZI / PASS]
• 3.3. Jaunas grāmatas pievienošana bibliotēkai ar pareiziem datiem [PAREIZI / PASS]
• 3.4. Grāmatas pievienošana bez obligātā nosaukuma (validācija) [PAREIZI / PASS]
• 4.1. Grāmatas saglabāšana savā plauktā (/api/books/:id/save).. [PAREIZI / PASS]
• 4.2. Saglabāto grāmatu saraksta iegūšana (/api/books/saved)... [PAREIZI / PASS]
• 4.3. Grāmatas saglabāšanas mēģinājums bez autorizācijas....... [PAREIZI / PASS]
• 4.4. Grāmatas izņemšana no plaukta (/api/books/:id/save DELETE) [PAREIZI / PASS]
• 5.1. Grāmatas pievienošana aktīvi lasāmajām (/api/reading/start) [PAREIZI / PASS]
• 5.2. Aktīvi lasāmo grāmatu saraksta pārbaude (/api/reading/current) [PAREIZI / PASS]
• 5.3. Progresa reģistrēšana - lapu un laika pieskaitīšana (/api/reading/log) [PAREIZI / PASS]
• 5.4. Progresa reģistrēšana ar nederīgām lapaspusēm (0 vai negatīvs) [PAREIZI / PASS]
• 6.1. Lietotāja kopsavilkuma statistikas iegūšana (/api/statistics/summary) [PAREIZI / PASS]
• 6.2. Mēneša heatmap datu iegūšana (/api/statistics/monthly)... [PAREIZI / PASS]
• 6.3. Sasniegumu saraksta un progresa pārbaude (/api/statistics/achievements) [PAREIZI / PASS]
• 7.1. Atsauksmes iesniegšana par grāmatu (5 zvaigznes)......... [PAREIZI / PASS]
• 7.2. Grāmatas vērtējuma robežvērtību pārbaude (nederīgs vērtējums 6) [PAREIZI / PASS]
• 7.3. Atsauksmes pievienošana par platformu sākumlapai (/api/reviews) [PAREIZI / PASS]
• 7.4. Jaunāko atsauksmju ielāde sākumlapai (/api/reviews/latest) [PAREIZI / PASS]
• 8.1. Iziešana no profila un sesijas izbeigšana (/api/users/logout) [PAREIZI / PASS]
• 9.1. Piekļuves kontrole: neautorizētam apmeklētājam liegta piekļuve (/api/admin/stats) [PAREIZI / PASS]
• 9.2. Piekļuves kontrole: parastam lietotājam liegta administratora piekļuve (/api/admin/users) [PAREIZI / PASS]
• 9.3. Administratora autorizācija ar ģenerētajiem datiem (admin@limb.lv) [PAREIZI / PASS]
• 9.4. Administratora kopsavilkuma statistikas iegūšana (/api/admin/stats) [PAREIZI / PASS]
• 9.5. Klientu profilu saraksta pārskatīšana (/api/admin/users). [PAREIZI / PASS]
• 9.6. Klienta profila bloķēšana (/api/admin/users/:id/block)... [PAREIZI / PASS]
• 9.7. Bloķēta klienta autorizācijas liegums (/api/users/login). [PAREIZI / PASS]
• 9.8. Klienta profila atbloķēšana (/api/admin/users/:id/block). [PAREIZI / PASS]
• 9.9. Klientu atsauksmju pārvaldība un dzēšana (/api/admin/reviews) [PAREIZI / PASS]
• 9.10. Robežgadījums: administrators nevar bloķēt vai dzēst pats savu kontu [PAREIZI / PASS]
• 9.11. Klienta profila neatgriezeniska dzēšana (/api/admin/users/:id) [PAREIZI / PASS]
======================================================================
KOPĀ TESTU: 42 | IZPILDĪTI: 42 | NEIZDEVĀS: 0 | LAIKS: 0.59s
======================================================================
```

### 8.4.2. Secinājumi par programmatūras gatavību
1. **Funkcionālo prasību izpilde**: Visi izvirzītie testēšanas mērķi ir pilnībā sasniegti – lietotājs var droši reģistrēties un pieslēgties sistēmai, pārvaldīt grāmatas bibliotēkā un savā plauktā, fiksēt izlasīto lapaspušu progresu un lasīšanas laiku, sekot līdzi statistikai un sasniegumiem, kā arī atstāt atsauksmes ar 5 zvaigžņu vērtējumu.
2. **Administrēšanas un lomu piekļuves kontrole**: Izveidota un pārbaudīta administratora loma ar automātiski ģenerētu kontu (`admin@limb.lv` / `Admin123!`). Administrators spēj skatīt klientu profilus, tos bloķēt un dzēst, kā arī dzēst nepieklājīgas vai nepiemērotas atsauksmes. Vienlaikus parastajiem lietotājiem un viesiem administrēšanas panelis un maršruti ir stingri liegti ar autorizācijas un tiesību pārbaudi (HTTP 401 un HTTP 403).
3. **Kļūdu un robežvērtību apstrāde**: Sistēma demonstrē augstu stabilitāti pie nekorektiem un robežvērtību ievaddatiem (tukši lauki, nesakrītošas paroles, dublēti e-pasti, negatīvs lapu skaits, vērtējums ārpus 1–5 skalas robežām, bloķēta konta pieteikšanās mēģinājums, administratora pašaizsardzība pret sevis bloķēšanu vai dzēšanu), atgriežot atbilstošus HTTP statusa kodus (400, 401, 403, 404) un saprotamus kļūdu paziņojumus lietotāja saskarnē.
4. **Kļūdu novēršana un stabilitāte**: Visas identificētās kļūdas (navigācijas nekonsekvence, autorizācijas pārbaude statistikai, pāradresācijas pēc izrakstīšanās, datu sinhronizācija plauktā, administratora piekļuves aizsardzība un bloķēto lietotāju liegums) tika dokumentētas un veiksmīgi novērstas, ko apliecina 100% pozitīvi atkārtotās testēšanas rezultāti.
5. **Gatavība ekspluatācijai**: Programmatūra ir pilnībā gatava demonstrēšanai, aizstāvēšanai un praktiskai lietošanai.
