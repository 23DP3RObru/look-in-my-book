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
    if (profile && name) profile.style.display = 'flex';
    if (profileLetter && name) profileLetter.textContent = name.charAt(0).toUpperCase();
}

updateLoginIndicator();

const logoutLink = document.getElementById('logout_link');
if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('user');
        fetch('http://localhost:1000/api/users/logout', { method: 'POST' })
            .catch((error) => console.error('Unable to log out from the server:', error))
            .finally(() => {
                window.location.href = 'index.html';
            });
    });
}