function updateLoginIndicator() {
    let user = null;
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
        } catch (error) {
            console.error('Unable to read stored user information:', error);
            localStorage.removeItem('user');
        }
    }

    const adminNavItem = document.getElementById('admin_nav_item');
    if (adminNavItem) {
        adminNavItem.style.display = (user && user.loma === 'admin') ? 'inline-block' : 'none';
    }

    if (!user) return;

    const registerButton = document.getElementById('register_button');
    const loginButton = document.getElementById('login_button');
    const loginIndicator = document.getElementById('login_indicator');
    const userName = document.getElementById('user_name');
    const profile = document.getElementById('profile');
    const profileLetter = document.getElementById('profile-letter');
    const name = user.vards || user.first_name || '';

    if (registerButton) registerButton.style.display = 'none';
    if (loginButton) loginButton.style.display = 'none';
    if (loginIndicator) loginIndicator.style.display = 'block';
    if (userName) userName.textContent = name;
    if (profile && name) {
        profile.style.display = 'flex';
        profile.setAttribute('aria-label', `Profila attēls: ${name}`);
    }
    if (profileLetter && name) profileLetter.textContent = Array.from(name)[0].toLocaleUpperCase();

    // Verify session in background to sync latest role/status
    fetch('/api/users/me')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                if (adminNavItem) {
                    adminNavItem.style.display = (data.user.loma === 'admin') ? 'inline-block' : 'none';
                }
            } else if (!data.success) {
                localStorage.removeItem('user');
                if (adminNavItem) adminNavItem.style.display = 'none';
                if (profile) profile.style.display = 'none';
                if (registerButton) registerButton.style.display = '';
                if (loginButton) loginButton.style.display = '';
            }
        })
        .catch(() => {});
}

async function initializeNavigation() {
    try {
        if (window.navigationReady) await window.navigationReady;

        updateLoginIndicator();

        const logoutLink = document.getElementById('logout_link');
        if (logoutLink) {
            logoutLink.addEventListener('click', (event) => {
                event.preventDefault();
                localStorage.removeItem('user');
                fetch('/api/users/logout', { method: 'POST' })
                    .catch((error) => console.error('Unable to log out from the server:', error))
                    .finally(() => {
                        window.location.href = 'hero.html';
                    });
            });
        }
    } catch (error) {
        console.error('Unable to initialize navigation:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
    initializeNavigation();
}
