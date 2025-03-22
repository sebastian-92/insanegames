const adBlockList = [
    'doubleclick.net',
    'adservice.google.com',
    'googlesyndication.com',
    'ads.crazygames.com',
    'pagead2.googlesyndication.com',
    'securepubads.g.doubleclick.net',
    'cpx.to',
    'adnxs.com',
    'googletagmanager.com',
    'imasdk.googleapis.com',
];

(function blockAds() {
    let originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (adBlockList.some(domain => args[0].includes(domain))) {
            console.warn('Intercepted ad request:', args[0]);
            return new Response('{}', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        return originalFetch(...args);
    };

    let originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (adBlockList.some(domain => url.includes(domain))) {
            console.warn('Intercepted ad request:', url);
            this.send = () => {};
            return;
        }
        return originalOpen.apply(this, arguments);
    };
})();

function removeAds() {
    document.querySelectorAll('iframe, script, div').forEach(el => {
        if (adBlockList.some(domain => el.src && el.src.includes(domain))) {
            el.remove();
            console.warn('Removed ad element:', el);
        }
    });
}

const observer = new MutationObserver(mutations => {
    mutations.forEach(() => removeAds());
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

async function fetchWithTimeout(url, timeout = 3000) {
    return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout),
        ),
    ]);
}

async function fetchGameConfig(gameSlug) {
    try {
        let response = await fetchWithTimeout(
            `https://opencors.netlify.app/.netlify/functions/main?url=${encodeURIComponent(
      `https://games.crazygames.com/en_US/${gameSlug}/index.html`,
    )}`,
        );
        let text = await response.text();
        let match = text.match(/var options = (\{[\s\S]*?\});/);
        return match ? JSON.parse(match[1]) : null;
    } catch (error) {
        console.warn('Primary fetch failed, attempting fallback:', error);
        try {
            let response = await fetchWithTimeout(
                `https://corsproxy.io/?key=d6168cb0&url=${encodeURIComponent(
        `https://games.crazygames.com/en_US/${gameSlug}/index.html`,
      )}`,
            );
            let text = await response.text();
            let match = text.match(/var options = (\{[\s\S]*?\});/);
            return match ? JSON.parse(match[1]) : null;
        } catch (error) {
            console.error('Fallback fetch failed:', error);
            return null;
        }
    }
}

async function loadGame() {
    let params = new URLSearchParams(window.location.search);
    let gameSlug = params.get('game');
    let loader = document.getElementById('loader');
    let gameInput = document.getElementById('gameInput');

    if (!gameSlug) {
        loader.style.display = 'none';
        gameInput.classList.add('active');
        return;
    }

    let options = await fetchGameConfig(gameSlug);
    if (!options) {
        loader.textContent =
            "Loading failed. Either there's some error, or, most likely, you mistyped the slug.";
        return;
    }

    document.title = options.gameName + " | SaneGames" || "SaneGames";

    let script = document.createElement('script');
    script.src = 'https://builds.crazygames.com/gameframe/v1/bundle.js';
    script.onload = () => {
        if (window.Crazygames) {
            Crazygames.load(options).then(() => {
                loader.remove();
                gameInput.remove();
            });
        } else {
            console.error('Crazygames SDK failed to load.');
        }
    };
    document.head.appendChild(script);
}

function loadGameFromInput() {
    let gameSlug = document.getElementById('gameSlugInput').value;
    if (gameSlug) {
        let newUrl = window.location.href.split('?')[0] + '?game=' + gameSlug;
        window.location.href = newUrl;
    }
}

function recommendations() {
    const popup = document.getElementById('recommendationsPopup');
    popup.classList.add('active');
}

function closeRecommendations() {
    const popup = document.getElementById('recommendationsPopup');
    popup.classList.remove('active');
}

window.onclick = function(event) {
    const popup = document.getElementById('recommendationsPopup');
    if (
        event.target == popup &&
        popup.classList.contains('active') === true
    ) {
        closeRecommendations();
    }
};

loadGame();