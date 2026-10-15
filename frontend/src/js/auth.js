(function () {
  const API_BASE = '/api/users';
  const USER_KEY = 'user';

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  function saveUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (error) {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
  }

  async function register(payload) {
    return request('/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function login(email, password) {
    const data = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    saveUser(data.user);
    return data;
  }

  async function logout() {
    try {
      return await request('/logout', { method: 'POST' });
    } finally {
      clearUser();
    }
  }

  async function me() {
    const data = await request('/me', { method: 'GET' });
    saveUser(data.user);
    return data.user;
  }

  function updateLoginIndicator() {
    const user = getStoredUser();
    const loginBtn = document.getElementById('login_button');
    const registerBtn = document.getElementById('register_button');
    const loginIndicator = document.getElementById('login_indicator');
    const userName = document.getElementById('user_name');

    if (loginBtn) loginBtn.style.display = user ? 'none' : '';
    if (registerBtn) registerBtn.style.display = user ? 'none' : '';
    if (loginIndicator) loginIndicator.style.display = user ? 'block' : 'none';
    if (userName && user) userName.textContent = user.vards || user.epasts;
  }

  window.AuthAPI = {
    register,
    login,
    logout,
    me,
    saveUser,
    getStoredUser,
    clearUser,
    updateLoginIndicator
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateLoginIndicator();

    const logoutLink = document.getElementById('logout_link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (event) => {
        event.preventDefault();
        await logout();
        window.location.href = 'index.html';
      });
    }
  });
})();
