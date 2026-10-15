/**
 * Hero Page Controller - Reviews & Landing Interactivity
 */

(function () {
  let selectedRating = 5;
  let allBooks = [];

  document.addEventListener('DOMContentLoaded', () => {
    initHeroUser();
    loadLatestReviews();
    loadBooksForDropdown();
    setupHeroModal();
  });

  function initHeroUser() {
    const stored = localStorage.getItem('user');
    const profile = document.getElementById('profile');
    const profileLetter = document.getElementById('profile-letter');
    const registerBtn = document.getElementById('register_button');
    const loginBtn = document.getElementById('login_button');

    if (stored) {
      try {
        const user = JSON.parse(stored);
        const name = user.vards || user.first_name || '';
        if (name && profile && profileLetter) {
          profile.style.display = 'flex';
          profile.className = 'profile profile-avatar-blue';
          profileLetter.textContent = Array.from(name)[0].toUpperCase();
          profile.onclick = () => window.location.href = 'profile.html';
        }
        if (registerBtn) registerBtn.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'none';
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Load latest reviews for hero section
  async function loadLatestReviews() {
    try {
      const res = await fetch('/api/reviews/latest?limit=6');
      const data = await res.json();
      if (!data.success || !data.reviews) return;

      const container = document.getElementById('hero-reviews-stack');
      if (!container) return;
      container.innerHTML = '';

      data.reviews.forEach(r => {
        const card = createReviewCardElement(r);
        container.appendChild(card);
      });

      // Update positive reviews counter if element exists
      const positiveReviews = data.reviews.filter(r => r.vertejums >= 4).length;
      const counterEl = document.getElementById('stats-positive-reviews');
      if (counterEl) {
        // Base 1000 + additional reviews
        const total = 1000 + (data.reviews.length > 3 ? data.reviews.length - 3 : 0);
        counterEl.textContent = total;
      }
    } catch (e) {
      console.error('Error loading latest reviews:', e);
    }
  }

  function createReviewCardElement(r) {
    const card = document.createElement('div');
    card.className = 'hero-review-card';

    // Stars string e.g. ★★★★☆
    const fullStars = '★'.repeat(r.vertejums || 5);
    const emptyStars = '☆'.repeat(5 - (r.vertejums || 5));
    const starsHtml = `<span style="color:#FFC000;">${fullStars}</span><span style="color:#cbd5e1;">${emptyStars}</span>`;

    const tagText = (r.tips === 'gramata' && r.gramata_nosaukums)
      ? `Grāmata: ${r.gramata_nosaukums}`
      : 'Look in My Book platforma';

    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-avatar" style="background-color: ${r.avatar_bg || '#d9f99d'}; color: ${r.avatar_color || '#3f6212'};">
          ${r.initial || 'U'}
        </div>
        <div class="review-author-info">
          <div class="review-author-name">${r.autora_vards}</div>
          <div class="review-target-tag">${tagText}</div>
        </div>
        <div class="review-stars">${starsHtml}</div>
      </div>
      <p class="review-card-body">${r.teksts}</p>
    `;

    return card;
  }

  // Load books for dropdown
  async function loadBooksForDropdown() {
    try {
      const res = await fetch('/api/books');
      allBooks = await res.json();
      const select = document.getElementById('review-book-select');
      if (!select || !Array.isArray(allBooks)) return;

      select.innerHTML = '<option value="">-- Izvēlies grāmatu --</option>';
      allBooks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.gramata_id;
        opt.textContent = `${b.nosaukums} (${b.autors})`;
        opt.dataset.title = b.nosaukums;
        select.appendChild(opt);
      });
    } catch (e) {
      console.error('Error loading books for dropdown:', e);
    }
  }

  function setupHeroModal() {
    const modal = document.getElementById('hero-review-modal');
    const openBtn = document.getElementById('btn-open-review-modal');
    const openBtn2 = document.getElementById('btn-open-review-modal-header');
    const cancelBtn = document.getElementById('btn-cancel-hero-review');
    const submitBtn = document.getElementById('btn-submit-hero-review');
    const typeSelect = document.getElementById('review-type-select');
    const bookGroup = document.getElementById('book-select-group');

    if (!modal) return;

    function openModal() {
      // Pre-fill user name if logged in
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          const nameInput = document.getElementById('review-author-input');
          if (nameInput && !nameInput.value) {
            nameInput.value = `${user.vards || ''} ${user.uzvards || ''}`.trim() || user.epasts;
          }
        } catch (e) {}
      }

      selectedRating = 5;
      renderModalStars(5);
      modal.classList.add('active');
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    if (openBtn) openBtn.onclick = openModal;
    if (openBtn2) openBtn2.onclick = openModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    // Toggle book dropdown depending on review type
    if (typeSelect && bookGroup) {
      typeSelect.onchange = () => {
        bookGroup.style.display = (typeSelect.value === 'gramata') ? 'flex' : 'none';
      };
    }

    // Modal Stars
    const stars = document.querySelectorAll('.modal-star-btn');
    stars.forEach((btn, idx) => {
      const starIndex = idx + 1;
      btn.onclick = () => {
        selectedRating = starIndex;
        renderModalStars(selectedRating);
      };
      btn.onmouseenter = () => {
        renderModalStars(starIndex);
      };
      btn.onmouseleave = () => {
        renderModalStars(selectedRating);
      };
    });

    function renderModalStars(rating) {
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

    // Submit Review
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const name = document.getElementById('review-author-input').value.trim();
        const type = typeSelect ? typeSelect.value : 'sistema';
        const bookSelect = document.getElementById('review-book-select');
        const text = document.getElementById('review-text-input').value.trim();

        if (!name) {
          alert('Lūdzu ievadiet savu vārdu!');
          return;
        }

        if (!text) {
          alert('Lūdzu uzrakstiet savu atsauksmi!');
          return;
        }

        let bookId = null;
        let bookTitle = null;

        if (type === 'gramata') {
          if (!bookSelect.value) {
            alert('Lūdzu izvēlieties grāmatu, kuru vēlaties novērtēt!');
            return;
          }
          bookId = parseInt(bookSelect.value, 10);
          const selectedOption = bookSelect.options[bookSelect.selectedIndex];
          bookTitle = selectedOption ? selectedOption.dataset.title : '';
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Iesniedz...';

        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              autora_vards: name,
              tips: type,
              gramata_id: bookId,
              gramata_nosaukums: bookTitle,
              vertejums: selectedRating,
              teksts: text
            })
          });

          const data = await res.json();
          if (data.success && data.review) {
            closeModal();
            // Clear inputs
            document.getElementById('review-text-input').value = '';

            // Prepend new review card to top of the stack
            const stack = document.getElementById('hero-reviews-stack');
            if (stack) {
              const newCard = createReviewCardElement(data.review);
              stack.insertBefore(newCard, stack.firstChild);
            }

            alert('Paldies! Jūsu atsauksme tika veiksmīgi publicēta.');
          } else {
            alert(data.error || 'Neizdevās saglabāt atsauksmi.');
          }
        } catch (e) {
          console.error(e);
          alert('Gadījās kļūda, mēģiniet vēlreiz.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iesniegt atsauksmi';
        }
      };
    }
  }
})();
