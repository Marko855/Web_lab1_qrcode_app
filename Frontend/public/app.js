const AUTH0_DOMAIN = 'dev-vxlnpyk7pyklbtwf.us.auth0.com'; 
const AUTH0_CLIENT_ID = 'nLEhKOcZnSv98JCuLN7mQAEMsfAHWcnu'; 
const AUTH0_CALLBACK_URL = 'https://web-lab1-qrcode-app.onrender.com'; 
const AUTH0_LOGOUT_URL = `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${AUTH0_CALLBACK_URL}`; 
const AUTH0_AUDIENCE= `https://api.dananic-lab1.com`;

const webAuth = new auth0.WebAuth({
    domain: AUTH0_DOMAIN,
    clientID: AUTH0_CLIENT_ID,
    redirectUri: AUTH0_CALLBACK_URL,
    responseType: 'token id_token',
    scope: 'openid profile email',
    audience: AUTH0_AUDIENCE
});

const statusElement = document.getElementById('status');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const countElement = document.getElementById('count');

function clearCookies() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    console.log("Cookies cleared from localStorage.");
}

webAuth.parseHash((err, authResult) => {
    if (authResult && authResult.accessToken && authResult.idToken) {
        setSession(authResult);
        updateUI();
    } else if (err) {
        console.error('Error: ' + err.error);
        statusElement.innerHTML = 'Error logging in';
    } else {
        updateUI();
    }
});

function setSession(authResult) {
    const expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    window.location.href = AUTH0_LOGOUT_URL;
}

function updateUI() {
    const accessToken = localStorage.getItem('access_token');
    const isAuthenticated = accessToken && new Date().getTime() < localStorage.getItem('expires_at');

    if (isAuthenticated) {
        statusElement.innerHTML = 'Logged in';
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
    } else {
        statusElement.innerHTML = 'Logged out';
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
    }
}

async function fetchTicketCount() {
    try {
        const response = await fetch('https://web-lab1-qrcode-app-backend.onrender.com/ticketCount'); 

        if (response.ok) {
            const data = await response.json();
            console.log('Fetched ticket count:', data);
            countElement.textContent = data.totalCount !== null ? data.totalCount : 'Error fetching count'; 
        } else {
            console.error('Failed to fetch ticket count:', response.statusText);
            countElement.textContent = 'Error fetching count';
        }
    } catch (error) {
        console.error('Error fetching ticket count:', error);
        countElement.textContent = 'Error fetching count';
    }
}

clearCookies();
loginButton.onclick = () => webAuth.authorize();
logoutButton.onclick = logout;

updateUI(); 
fetchTicketCount(); 

setInterval(fetchTicketCount, 3000);

