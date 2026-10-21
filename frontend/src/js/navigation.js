window.navigationReady = (async () => {
    const container = document.getElementById('navigation');
    if (!container) throw new Error('Navigation container was not found.');

    const response = await fetch('navigation.html');
    if (!response.ok) throw new Error(`Unable to load navigation (${response.status}).`);

    container.innerHTML = await response.text();

    const currentPage = window.location.pathname.split('/').pop() || 'library.html';
    document.querySelectorAll('#nav_bar a[href]').forEach((link) => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
})();
