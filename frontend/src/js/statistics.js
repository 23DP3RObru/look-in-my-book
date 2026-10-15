/**
 * Look in My Book - Statistics & Reading Tracker Controller
 */

(function () {
  let currentUser = null;
  let currentMonth = 9;  // Defaults to September 2026 to match mock
  let currentYear = 2026;
  let activeChartTab = 'pace'; // 'pace' or 'pages'
  let trendsData = null;
  let activeReviewBookId = null;
  let selectedRating = 3; // Default 3 stars selected like in mockup
  let chartInstance = null;

  // Initialize page
  document.addEventListener('DOMContentLoaded', async () => {
    initUser();
    setupEventListeners();
    await loadAllData();
  });

  function getUserId() {
    return currentUser ? currentUser.lietotajs_id : 1;
  }

  function getApiHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const uid = getUserId();
    if (uid) headers['x-user-id'] = uid.toString();
    return headers;
  }

  function initUser() {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }

    // If no user stored, use default demo user matching screenshot ('Elīna')
    if (!currentUser) {
      currentUser = {
        lietotajs_id: 1,
        vards: 'Elīna',
        uzvards: 'Bērziņa',
        epasts: 'elina@limb.lv'
      };
    }

    updateNavbarUser();
  }

  function updateNavbarUser() {
    const name = currentUser.vards || currentUser.first_name || 'Elīna';
    const profile = document.getElementById('profile');
    const profileLetter = document.getElementById('profile-letter');
    const registerBtn = document.getElementById('register_button');
    const loginBtn = document.getElementById('login_button');

    if (profile && profileLetter) {
      profile.style.display = 'flex';
      profile.className = 'profile profile-avatar-blue';
      profileLetter.textContent = Array.from(name)[0].toUpperCase();
      profile.onclick = () => window.location.href = 'profile.html';
    }

    if (registerBtn) registerBtn.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'none';
  }

  async function loadAllData() {
    await Promise.all([
      loadSummary(),
      loadMonthlyHeatmap(currentYear, currentMonth),
      loadTrends(),
      loadCurrentBooks(),
      loadAchievements()
    ]);
  }

  /* --------------------------------------------------------------------------
     1. "KOPĀ" SUMMARY DATA
     -------------------------------------------------------------------------- */
  async function loadSummary() {
    try {
      const res = await fetch('/api/statistics/summary', {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) return;

      document.getElementById('kopa-pages').textContent = data.totalPages || 0;
      document.getElementById('kopa-books').textContent = data.totalBooks || 0;
      document.getElementById('kopa-author').textContent = data.favoriteAuthor || '-';
      document.getElementById('kopa-achievements').textContent = data.completedAchievements || 0;

      // Update pace badge in Vidēji
      const paceEl = document.getElementById('average-pace-val');
      const minEl = document.getElementById('average-min-val');
      if (paceEl) paceEl.textContent = data.averagePace ? data.averagePace.toFixed(2) : '0.00';
      if (minEl) minEl.textContent = data.minutesPerPage ? data.minutesPerPage.toFixed(1) : '-';
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }

  /* --------------------------------------------------------------------------
     2. "MĒNEŠA KOPSAVILKUMS" HEATMAP
     -------------------------------------------------------------------------- */
  async function loadMonthlyHeatmap(year, month) {
    try {
      const res = await fetch(`/api/statistics/monthly?year=${year}&month=${month}`, {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) return;

      currentYear = data.year;
      currentMonth = data.month;

      // Update title subtitle
      document.getElementById('heatmap-month-title').textContent = `${data.monthName} ${data.year}`;
      document.getElementById('heatmap-month-total').textContent = data.totalPagesInMonth || 0;

      const grid = document.getElementById('heatmap-tiles-grid');
      grid.innerHTML = '';

      (data.days || []).forEach(d => {
        const tile = document.createElement('div');
        tile.className = `heatmap-tile level-${d.level}`;
        tile.title = `${d.day}. ${data.monthName}: ${d.pages} lpp.${d.minutes ? ` (${d.minutes} min)` : ''}`;
        grid.appendChild(tile);
      });
    } catch (err) {
      console.error('Error loading monthly heatmap:', err);
    }
  }

  /* --------------------------------------------------------------------------
     3. "VIDĒJI" TRENDS & CHART
     -------------------------------------------------------------------------- */
  async function loadTrends() {
    try {
      const res = await fetch('/api/statistics/trends', {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) return;

      trendsData = data.trends || [];
      renderChart();
    } catch (err) {
      console.error('Error loading trends:', err);
    }
  }

  function renderChart() {
    const canvas = document.getElementById('statsChart');
    if (!canvas || !window.Chart) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    if (!trendsData || trendsData.length === 0) {
      return;
    }

    const labels = trendsData.map(t => t.label || t.monthName);

    if (activeChartTab === 'pace') {
      const paces = trendsData.map(t => t.pace || 0);

      chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Lasīšanas temps (lapas / min)',
            data: paces,
            borderColor: '#FF9D00',
            backgroundColor: 'rgba(255, 157, 0, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#FF9D00',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Temps: ${ctx.raw} lpp./min.`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: 1.5,
              ticks: {
                callback: (val) => `${val} lpp/min`
              },
              grid: { color: '#f1f3f5' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } else {
      const pages = trendsData.map(t => t.pages || 0);
      const books = trendsData.map(t => t.booksCompleted || 0);

      chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Izlasītās lapaspuses',
              data: pages,
              backgroundColor: '#FF9D00',
              borderRadius: 4,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: 'Pabeigtās grāmatas',
              data: books,
              borderColor: '#0099FF',
              backgroundColor: '#0099FF',
              pointRadius: 4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Lapaspuses' },
              grid: { color: '#f1f3f5' }
            },
            y1: {
              beginAtZero: true,
              position: 'right',
              title: { display: true, text: 'Grāmatas' },
              grid: { display: false },
              ticks: { stepSize: 1 }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     4. "PAŠLAIK TIEK LASĪTAS" LIST
     -------------------------------------------------------------------------- */
  async function loadCurrentBooks() {
    try {
      const res = await fetch('/api/reading/current', {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) return;

      const listContainer = document.getElementById('current-books-list');
      listContainer.innerHTML = '';

      if (!data.books || data.books.length === 0) {
        listContainer.innerHTML = `
          <div class="no-books-message">
            <p>Pašlaik nav nevienas aktīvas lasāmās grāmatas.</p>
            <button class="chart-tab-btn" id="btn-add-reading-book" style="margin-top: 8px;">+ Izvēlēties no bibliotēkas</button>
          </div>
        `;
        const addBtn = document.getElementById('btn-add-reading-book');
        if (addBtn) addBtn.onclick = showAvailableBooksModal;
        return;
      }

      data.books.forEach(book => {
        const card = createBookCard(book);
        listContainer.appendChild(card);
      });
    } catch (err) {
      console.error('Error loading current books:', err);
    }
  }

  function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card-item';
    card.id = `book-card-${book.gramata_id}`;

    const percent = book.progress_percent || 0;
    const coverUrl = book.bilde_url || 'src/img/default-cover.svg';

    card.innerHTML = `
      <div class="book-card-main">
        <img class="book-card-cover" src="${coverUrl}" alt="${book.nosaukums}" onerror="this.src='src/img/default-cover.svg'">
        <div class="book-card-info">
          <h3 class="book-card-title">${book.nosaukums}</h3>
          <div class="book-card-author">${book.autors}</div>
          <div class="book-card-inputs-row">
            <div class="book-input-group">
              <label class="book-input-label">Lapaspušu skaits izlasīts:</label>
              <input type="number" min="1" class="book-card-input input-pages" placeholder="19">
            </div>
            <div class="book-input-group">
              <label class="book-input-label">Laiks min.(Neobligāts):</label>
              <input type="number" min="1" class="book-card-input input-time" placeholder="20">
            </div>
            <button type="button" class="book-save-btn btn-save-progress">Saglabāt</button>
          </div>
        </div>
      </div>

      <div class="book-progress-wrapper">
        <div class="book-progress-track">
          <div class="book-progress-fill" style="width: ${percent}%;"></div>
          <span class="book-progress-label-left">Progress</span>
          <span class="book-progress-label-right">${percent}%</span>
        </div>
      </div>
    `;

    // If already 100% completed, attach completion overlay
    if (book.is_completed || percent >= 100) {
      attachCompletionOverlay(card, book);
    }

    // Save button event handler
    const saveBtn = card.querySelector('.btn-save-progress');
    saveBtn.onclick = async () => {
      const pagesInput = card.querySelector('.input-pages');
      const timeInput = card.querySelector('.input-time');

      const pages = parseInt(pagesInput.value || pagesInput.placeholder, 10);
      const time = parseInt(timeInput.value || timeInput.placeholder, 10) || 0;

      if (isNaN(pages) || pages <= 0) {
        alert('Lūdzu ievadiet izlasīto lapaspušu skaitu!');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = '...';

      try {
        const response = await fetch('/api/reading/log', {
          method: 'POST',
          headers: getApiHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            gramata_id: book.gramata_id,
            pages_read: pages,
            reading_time_minutes: time
          })
        });

        const result = await response.json();
        if (result.success) {
          // Clear inputs
          pagesInput.value = '';
          timeInput.value = '';

          // Update progress visually right away
          const newPercent = result.updatedBook.progress_percent;
          card.querySelector('.book-progress-fill').style.width = `${newPercent}%`;
          card.querySelector('.book-progress-label-right').textContent = `${newPercent}%`;

          // If reached 100%, show overlay!
          if (result.completed) {
            attachCompletionOverlay(card, book);
          }

          // Reload other stats
          loadSummary();
          loadMonthlyHeatmap(currentYear, currentMonth);
          loadTrends();
          loadAchievements();
        } else {
          alert(result.error || 'Neizdevās saglabāt datus.');
        }
      } catch (e) {
        console.error('Error logging reading progress:', e);
        alert('Gadījās kļūda, mēģiniet vēlreiz.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Saglabāt';
      }
    };

    return card;
  }

  function attachCompletionOverlay(card, book) {
    if (card.querySelector('.book-completed-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'book-completed-overlay';
    overlay.innerHTML = `
      <div class="book-completed-title">Grāmata pabeigta!</div>
      <div class="book-completed-prompt">Vai vēlaties novērtēt šo grāmatu?</div>
      <button type="button" class="book-completed-review-btn">Iesniegt atsauksmi</button>
    `;

    overlay.querySelector('.book-completed-review-btn').onclick = () => {
      openReviewModal(book.gramata_id);
    };

    card.appendChild(overlay);
  }

  /* --------------------------------------------------------------------------
     5. "SASNIEGUMI" ACHIEVEMENTS LIST
     -------------------------------------------------------------------------- */
  async function loadAchievements() {
    try {
      const res = await fetch('/api/statistics/achievements', {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('achievements-list');
      container.innerHTML = '';

      (data.achievements || []).forEach(ach => {
        const item = document.createElement('div');
        item.className = 'achievement-item-card';

        const percent = ach.progress_percent || 0;
        const isComplete = ach.is_completed;

        item.innerHTML = `
          <div class="achievement-icon-box">🏆</div>
          <div class="achievement-info">
            <h4 class="achievement-name">${ach.nosaukums}</h4>
            <div class="achievement-desc">${ach.apraksts}</div>
            <div class="achievement-progress-track">
              <div class="achievement-progress-fill" style="width: ${percent}%;"></div>
              ${isComplete
                ? `<span class="achievement-progress-fill-text">Progress ${percent}%</span>`
                : `<span class="achievement-progress-text">${percent}%</span>`
              }
            </div>
          </div>
        `;

        container.appendChild(item);
      });
    } catch (err) {
      console.error('Error loading achievements:', err);
    }
  }

  /* --------------------------------------------------------------------------
     6. REVIEW MODAL ("NOVĒRTĒ GRĀMATU" - Image 2)
     -------------------------------------------------------------------------- */
  function openReviewModal(gramataId) {
    activeReviewBookId = gramataId;
    selectedRating = 3; // Default 3 stars like in Image 2
    renderStarSelection(selectedRating);
    document.getElementById('review-comment').value = '';

    const modal = document.getElementById('review-modal');
    modal.classList.add('active');
  }

  function closeReviewModal() {
    activeReviewBookId = null;
    const modal = document.getElementById('review-modal');
    modal.classList.remove('active');
  }

  function renderStarSelection(rating) {
    const stars = document.querySelectorAll('.review-star-btn');
    stars.forEach((btn, idx) => {
      const starIndex = idx + 1;
      if (starIndex <= rating) {
        btn.textContent = '★';
        btn.classList.add('filled');
      } else {
        btn.textContent = '☆';
        btn.classList.remove('filled');
      }
    });
  }

  async function submitReview() {
    if (!activeReviewBookId) return;

    const comment = document.getElementById('review-comment').value.trim();
    const submitBtn = document.getElementById('btn-submit-review');
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/reading/review', {
        method: 'POST',
        headers: getApiHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          gramata_id: activeReviewBookId,
          vertejums: selectedRating,
          recenzija: comment
        })
      });

      const data = await response.json();
      if (data.success) {
        closeReviewModal();
        alert('Paldies! Jūsu atsauksme ir veiksmīgi saglabāta.');
        await loadAllData();
      } else {
        alert(data.error || 'Neizdevās saglabāt atsauksmi.');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Gadījās kļūda iesniedzot atsauksmi.');
    } finally {
      submitBtn.disabled = false;
    }
  }

  /* --------------------------------------------------------------------------
     7. HELPER: START READING FROM LIBRARY
     -------------------------------------------------------------------------- */
  async function showAvailableBooksModal() {
    try {
      const res = await fetch('/api/reading/available', {
        headers: getApiHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success || !data.books.length) {
        alert('Visas bibliotēkas grāmatas jau ir tavā lasīšanas sarakstā!');
        return;
      }

      const bookNames = data.books.map((b, i) => `${i + 1}. ${b.nosaukums} (${b.autors})`).join('\n');
      const pick = prompt(`Izvēlies grāmatas numuru ko sākt lasīt:\n\n${bookNames}`);
      const index = parseInt(pick, 10) - 1;

      if (!isNaN(index) && data.books[index]) {
        const book = data.books[index];
        await fetch('/api/reading/start', {
          method: 'POST',
          headers: getApiHeaders(),
          credentials: 'include',
          body: JSON.stringify({ gramata_id: book.gramata_id })
        });
        loadCurrentBooks();
      }
    } catch (err) {
      console.error(err);
    }
  }

  /* --------------------------------------------------------------------------
     8. EVENT LISTENERS
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    // Heatmap month navigation
    document.getElementById('btn-prev-month').onclick = () => {
      let m = currentMonth - 1;
      let y = currentYear;
      if (m < 1) { m = 12; y--; }
      loadMonthlyHeatmap(y, m);
    };

    document.getElementById('btn-next-month').onclick = () => {
      let m = currentMonth + 1;
      let y = currentYear;
      if (m > 12) { m = 1; y++; }
      loadMonthlyHeatmap(y, m);
    };

    // Chart Tabs
    const tabPace = document.getElementById('tab-chart-pace');
    const tabPages = document.getElementById('tab-chart-pages');

    tabPace.onclick = () => {
      activeChartTab = 'pace';
      tabPace.classList.add('active');
      tabPages.classList.remove('active');
      renderChart();
    };

    tabPages.onclick = () => {
      activeChartTab = 'pages';
      tabPages.classList.add('active');
      tabPace.classList.remove('active');
      renderChart();
    };

    // Review Modal Star selection
    const stars = document.querySelectorAll('.review-star-btn');
    stars.forEach((btn, idx) => {
      const starIndex = idx + 1;
      btn.onclick = () => {
        selectedRating = starIndex;
        renderStarSelection(selectedRating);
      };
      btn.onmouseenter = () => {
        renderStarSelection(starIndex);
      };
      btn.onmouseleave = () => {
        renderStarSelection(selectedRating);
      };
    });

    // Review Modal buttons
    document.getElementById('btn-cancel-review').onclick = closeReviewModal;
    document.getElementById('btn-submit-review').onclick = submitReview;

    // Close review modal when clicking backdrop
    document.getElementById('review-modal').onclick = (e) => {
      if (e.target.id === 'review-modal') closeReviewModal();
    };
  }
})();
