/**
 * Look in My Book - Administration Panel Controller
 * Handles user moderation (block, delete), review moderation, website content updates,
 * and operational statistics.
 */

(function () {
  let currentUser = null;
  let allUsers = [];
  let allBookReviews = [];
  let allPlatformReviews = [];
  let pendingAction = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await verifyAdminAccess();
    setupTabs();
    setupModal();
    setupFilters();
    loadDashboardStats();
    loadUsers();
    loadReviews();
  });

  // Verify that the logged in user is an administrator
  async function verifyAdminAccess() {
    try {
      const res = await fetch('/api/users/me');
      if (!res.ok) {
        window.location.href = 'login.html';
        return;
      }
      const data = await res.json();
      if (!data.success || !data.user || data.user.loma !== 'admin') {
        alert('Piekļuve liegta! Šī lapa ir pieejama tikai sistēmas administratoriem.');
        window.location.href = 'hero.html';
        return;
      }
      currentUser = data.user;
    } catch (e) {
      console.error('Neizdevās pārbaudīt administratora sesiju:', e);
      window.location.href = 'login.html';
    }
  }

  // Dashboard Stats
  async function loadDashboardStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        document.getElementById('stat-total-users').textContent = data.stats.total_users || 0;
        document.getElementById('stat-blocked-users').textContent = data.stats.blocked_users || 0;
        document.getElementById('stat-total-books').textContent = data.stats.total_books || 0;
        document.getElementById('stat-total-reviews').textContent = data.stats.total_reviews || 0;
      }
    } catch (e) {
      console.error('Kļūda ielādējot statistiku:', e);
    }
  }

  // Tab switching
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // Toast notification
  function showToast(message) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Modal setup
  function setupModal() {
    const backdrop = document.getElementById('admin-confirm-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    function closeModal() {
      backdrop.classList.remove('open');
      pendingAction = null;
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) closeModal();
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        if (typeof pendingAction === 'function') {
          confirmBtn.disabled = true;
          try {
            await pendingAction();
          } catch (err) {
            alert('Kļūda darbības izpildē: ' + err.message);
          } finally {
            confirmBtn.disabled = false;
            closeModal();
          }
        }
      };
    }
  }

  function openConfirmModal(title, text, confirmButtonText, confirmClass, actionFn) {
    const backdrop = document.getElementById('admin-confirm-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body-text');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    titleEl.textContent = title;
    bodyEl.textContent = text;
    confirmBtn.textContent = confirmButtonText || 'Apstiprināt';
    confirmBtn.className = confirmClass || 'btn-danger';

    pendingAction = actionFn;
    backdrop.classList.add('open');
  }

  // =========================================================================
  // 1. LIETOTĀJU PĀRVALDĪBA (KLIENTU PROFILI)
  // =========================================================================
  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        allUsers = data.users;
        renderUsersTable();
      }
    } catch (e) {
      console.error('Kļūda ielādējot lietotājus:', e);
    }
  }

  function setupFilters() {
    const userSearch = document.getElementById('user-search');
    const userStatusFilter = document.getElementById('user-status-filter');
    if (userSearch) userSearch.addEventListener('input', renderUsersTable);
    if (userStatusFilter) userStatusFilter.addEventListener('change', renderUsersTable);

    const reviewSearch = document.getElementById('review-search');
    const reviewTypeFilter = document.getElementById('review-type-filter');
    if (reviewSearch) reviewSearch.addEventListener('input', renderReviewsTable);
    if (reviewTypeFilter) reviewTypeFilter.addEventListener('change', renderReviewsTable);
  }

  function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('user-search')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('user-status-filter')?.value || 'all';

    const filtered = allUsers.filter(u => {
      const fullName = `${u.vards || ''} ${u.uzvards || ''}`.toLowerCase();
      const email = (u.epasts || '').toLowerCase();
      const matchesSearch = fullName.includes(searchTerm) || email.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || u.statuss === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #9ca3af;">Lietotāji netika atrasti.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const isSelf = currentUser && u.lietotajs_id === currentUser.lietotajs_id;
      const isBlocked = u.statuss === 'blokets';
      const statusBadge = isBlocked
        ? `<span class="badge-status badge-blocked">● Bloķēts</span>`
        : `<span class="badge-status badge-active">● Aktīvs</span>`;
      const roleBadge = u.loma === 'admin'
        ? `<span class="badge-role badge-role-admin">Administrators</span>`
        : `<span class="badge-role badge-role-user">Lietotājs</span>`;

      const blockBtnText = isBlocked ? 'Atbloķēt' : 'Bloķēt';
      const blockBtnClass = isBlocked ? 'btn-unblock' : 'btn-block';

      return `
        <tr>
          <td><strong>#${u.lietotajs_id}</strong></td>
          <td>${escapeHtml(u.vards)} ${escapeHtml(u.uzvards)}</td>
          <td>${escapeHtml(u.epasts)}</td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>${formatDate(u.izveidots_at)}</td>
          <td>
            <div class="action-btn-group">
              ${isSelf ? `
                <span style="font-size: 11px; color: #9ca3af; font-style: italic;">(Tavs konts)</span>
              ` : `
                <button
                  class="btn-action ${blockBtnClass}"
                  onclick="window.AdminController.confirmBlockUser(${u.lietotajs_id}, '${escapeJs(u.vards + ' ' + u.uzvards)}', '${u.statuss}')"
                  title="${isBlocked ? 'Atbloķēt piekļuvi' : 'Bloķēt lietotāja profilu'}"
                >${blockBtnText}</button>
                <button
                  class="btn-action btn-delete"
                  onclick="window.AdminController.confirmDeleteUser(${u.lietotajs_id}, '${escapeJs(u.vards + ' ' + u.uzvards)}')"
                  title="Dzēst klienta profilu"
                >Dzēst</button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function confirmBlockUser(id, name, currentStatus) {
    const isCurrentlyBlocked = currentStatus === 'blokets';
    const actionWord = isCurrentlyBlocked ? 'atbloķēt' : 'bloķēt';
    const newStatus = isCurrentlyBlocked ? 'aktivs' : 'blokets';

    openConfirmModal(
      `Apstiprināt klienta profila ${actionWord}šanu`,
      `Vai tiešām vēlaties ${actionWord} lietotāja "${name}" (ID: #${id}) profilu? ${isCurrentlyBlocked ? 'Lietotājs atkal varēs pieslēgties platformai.' : 'Bloķētais lietotājs nevarēs autorizēties sistēmā.'}`,
      isCurrentlyBlocked ? 'Atbloķēt profilu' : 'Bloķēt profilu',
      isCurrentlyBlocked ? 'btn-warning' : 'btn-danger',
      async () => {
        const res = await fetch(`/api/admin/users/${id}/block`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statuss: newStatus })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Neizdevās mainīt lietotāja statusu');
        }
        showToast(data.message);
        await loadUsers();
        await loadDashboardStats();
      }
    );
  }

  function confirmDeleteUser(id, name) {
    openConfirmModal(
      'Apstiprināt klienta profila dzēšanu',
      `UZMANĪBU: Vai tiešām vēlaties neatgriezeniski dzēst lietotāju "${name}" (ID: #${id})? Visi saistītie dati (plaukts, progresa sesijas un sasniegumi) tiks dzēsti. Šo darbību nevar atsaukt!`,
      'Dzēst profilu',
      'btn-danger',
      async () => {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Neizdevās dzēst lietotāju');
        }
        showToast(data.message);
        await loadUsers();
        await loadDashboardStats();
      }
    );
  }

  // =========================================================================
  // 2. KLIENTU ATSAUKSMJU PĀRVALDĪBA
  // =========================================================================
  async function loadReviews() {
    try {
      const res = await fetch('/api/admin/reviews');
      const data = await res.json();
      if (data.success) {
        allBookReviews = data.book_reviews || [];
        allPlatformReviews = data.platform_reviews || [];
        renderReviewsTable();
      }
    } catch (e) {
      console.error('Kļūda ielādējot atsauksmes:', e);
    }
  }

  function renderReviewsTable() {
    const tbody = document.getElementById('reviews-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('review-search')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('review-type-filter')?.value || 'all';

    let list = [];
    if (typeFilter === 'all' || typeFilter === 'gramata') {
      list = list.concat(allBookReviews);
    }
    if (typeFilter === 'all' || typeFilter === 'sistema') {
      list = list.concat(allPlatformReviews);
    }

    const filtered = list.filter(r => {
      const text = (r.teksts || '').toLowerCase();
      const author = (r.autora_vards || '').toLowerCase();
      const item = (r.gramata_nosaukums || '').toLowerCase();
      return text.includes(searchTerm) || author.includes(searchTerm) || item.includes(searchTerm);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #9ca3af;">Atsauksmes netika atrastas.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const isBook = r.tips === 'gramata';
      const id = isBook ? r.atskaite_id : r.atsauksme_id;
      const typeLabel = isBook
        ? `<span class="badge-role badge-role-user">Grāmata</span> <strong>${escapeHtml(r.gramata_nosaukums || 'Nezināma')}</strong>`
        : `<span class="badge-role badge-role-admin">Platforma</span> <strong>Look in My Book</strong>`;

      const stars = '★'.repeat(r.vertejums || 0) + '☆'.repeat(Math.max(0, 5 - (r.vertejums || 0)));

      return `
        <tr>
          <td><strong>#${id}</strong></td>
          <td>${typeLabel}</td>
          <td>${escapeHtml(r.autora_vards || 'Anonīms')}</td>
          <td style="color: #f59e0b; font-size: 15px; letter-spacing: 1px;">${stars} <span style="color:#6b7280; font-size:12px;">(${r.vertejums}/5)</span></td>
          <td style="max-width: 320px; word-break: break-word;">${escapeHtml(r.teksts || '')}</td>
          <td>${formatDate(r.datums)}</td>
          <td>
            <button
              class="btn-action btn-delete"
              onclick="window.AdminController.confirmDeleteReview('${r.tips}', ${id}, '${escapeJs((r.teksts || '').slice(0, 40))}')"
              title="Dzēst nepieklājīgu vai nepiemērotu atsauksmi"
            >Dzēst</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function confirmDeleteReview(type, id, preview) {
    const isBook = type === 'gramata';
    const endpoint = isBook ? `/api/admin/reviews/book/${id}` : `/api/admin/reviews/platform/${id}`;

    openConfirmModal(
      'Apstiprināt klienta atsauksmes dzēšanu',
      `Vai tiešām vēlaties dzēst šo atsauksmi (#${id}: "${preview}...")? Ja atsauksme ir nepiemērota vai nepieklājīga, tā tiks neatgriezeniski noņemta no platformas.`,
      'Dzēst atsauksmi',
      'btn-danger',
      async () => {
        const res = await fetch(endpoint, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Neizdevās dzēst atsauksmi');
        }
        showToast(data.message || 'Atsauksme dzēsta');
        await loadReviews();
        await loadDashboardStats();
      }
    );
  }

  // Utilities
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJs(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('lv-LV', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }

  // Expose methods for onclick handlers
  window.AdminController = {
    confirmBlockUser,
    confirmDeleteUser,
    confirmDeleteReview,
    loadUsers,
    loadReviews
  };
})();
