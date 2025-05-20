const adBlockList = [
    "doubleclick.net",
    "adservice.google.com",
    "googlesyndication.com",
    "ads.crazygames.com",
    "pagead2.googlesyndication.com",
    "securepubads.g.doubleclick.net",
    "cpx.to",
    "adnxs.com",
    "googletagmanager.com",
    "imasdk.googleapis.com",
];

(function blockAds() {
    if (typeof window === "undefined") return; // Guard for non-browser environments

    let originalFetch = window.fetch;
    window.fetch = async function (...args) {
        try {
            if (
                args[0] &&
                typeof args[0] === "string" &&
                adBlockList.some((domain) => args[0].includes(domain))
            ) {
                console.warn(
                    "SaneGames: Intercepted ad request (fetch):",
                    args[0]
                );
                return new Response("{}", {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
            }
        } catch (e) {
            console.error("SaneGames: Error in fetch override", e);
        }
        return originalFetch.apply(this, args);
    };

    if (typeof XMLHttpRequest !== "undefined") {
        let originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            try {
                if (
                    url &&
                    typeof url === "string" &&
                    adBlockList.some((domain) => url.includes(domain))
                ) {
                    console.warn(
                        "SaneGames: Intercepted ad request (XHR):",
                        url
                    );
                    // Effectively neuter the request
                    this.send = () => {
                        console.log("SaneGames: Blocked XHR send to " + url);
                    };
                    // Some scripts might check readyState, so try to make it look "done" without error
                    Object.defineProperty(this, "readyState", {
                        value: 4,
                        writable: false,
                    });
                    Object.defineProperty(this, "status", {
                        value: 200,
                        writable: false,
                    });
                    Object.defineProperty(this, "responseText", {
                        value: "{}",
                        writable: false,
                    });
                    Object.defineProperty(this, "response", {
                        value: {},
                        writable: false,
                    });
                    if (this.onload) {
                        try {
                            this.onload();
                        } catch (e) {}
                    }
                    if (this.onreadystatechange) {
                        try {
                            this.onreadystatechange();
                        } catch (e) {}
                    }
                    return; // End here, don't call originalOpen
                }
            } catch (e) {
                console.error("SaneGames: Error in XHR.open override", e);
            }
            return originalOpen.apply(this, arguments);
        };
    }
})();

function removeAdElements() {
    if (typeof document === "undefined") return;
    document
        .querySelectorAll("iframe, script, div, img, ins, video, style")
        .forEach((el) => {
            // Check common ad attributes or src containing ad domains
            const elSrc = el.src || el.href || el.data || el.poster; // Include more sources
            const elId = el.id || "";
            const elClass = el.className || "";

            let isAdElement = false;
            if (
                elSrc &&
                typeof elSrc === "string" &&
                adBlockList.some((domain) => elSrc.includes(domain))
            ) {
                isAdElement = true;
            } else if (
                (typeof elId === "string" &&
                    adBlockList.some((keyword) =>
                        elId.toLowerCase().includes(keyword.split(".")[0])
                    )) || // e.g., 'doubleclick'
                (typeof elClass === "string" &&
                    adBlockList.some((keyword) =>
                        elClass.toLowerCase().includes(keyword.split(".")[0])
                    ))
            ) {
                // Basic check for IDs/classes like "ad", "ads", "advert" etc.
                const commonAdKeywords = [
                    "adbox",
                    "advert",
                    "google_ads",
                    "banner_ad",
                ];
                if (
                    commonAdKeywords.some(
                        (keyword) =>
                            elId.toLowerCase().includes(keyword) ||
                            elClass.toLowerCase().includes(keyword)
                    )
                ) {
                    isAdElement = true;
                }
            }

            // Also check for specific CrazyGames ad-related selectors if known
            const crazyGamesAdSelectors = ["#crazygames-ad", ".ad-container"]; // Example selectors
            if (
                crazyGamesAdSelectors.some((selector) => el.matches(selector))
            ) {
                isAdElement = true;
            }

            if (isAdElement) {
                console.warn(
                    "SaneGames: Removed potential ad element:",
                    el.tagName,
                    el.id,
                    el.className,
                    elSrc
                );
                el.remove();
            }
        });
}

if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
        // Using forEach on mutations is fine, but can be heavy.
        // A more optimized way might be to process addedNodes directly.
        let needsRemoval = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                needsRemoval = true;
                break;
            }
        }
        if (needsRemoval) {
            removeAdElements();
        }
    });

    // Make sure document.body exists before observing
    const startObserver = () => {
        if (document.body) {
            removeAdElements(); // Initial run
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        } else {
            // If body is not yet available (e.g. script in head without defer)
            document.addEventListener("DOMContentLoaded", () => {
                removeAdElements(); // Initial run
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            });
        }
    };
    startObserver();
}

async function fetchWithTimeout(url, timeout = 5000) {
    // Increased timeout slightly
    return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
    ]);
}

async function fetchGameConfig(gameSlug) {
    const urls = [
        `https://opencors.netlify.app/.netlify/functions/main?url=${encodeURIComponent(
            `https://games.crazygames.com/en_US/${gameSlug}/index.html`
        )}`,
        `https://corsproxy.io/?key=d6168cb0&url=${encodeURIComponent(
            `https://games.crazygames.com/en_US/${gameSlug}/index.html`
        )}`, // This key might expire or be rate-limited
        `https://api.allorigins.win/raw?url=${encodeURIComponent(
            `https://games.crazygames.com/en_US/${gameSlug}/index.html`
        )}`, // Another common proxy
    ];

    for (let i = 0; i < urls.length; i++) {
        try {
            console.log(
                `SaneGames: Attempting to fetch config via proxy ${i + 1}: ${
                    urls[i].split("?")[0]
                }`
            );
            let response = await fetchWithTimeout(urls[i]);
            if (!response.ok) {
                throw new Error(
                    `Proxy ${i + 1} request failed with status ${
                        response.status
                    }`
                );
            }
            let text = await response.text();
            let match = text.match(/var options = (\{[\s\S]*?\});/);
            if (match && match[1]) {
                console.log(
                    `SaneGames: Successfully fetched config via proxy ${i + 1}`
                );
                return JSON.parse(match[1]);
            } else {
                console.warn(
                    `SaneGames: Proxy ${
                        i + 1
                    } returned content, but no options found.`
                );
            }
        } catch (error) {
            console.warn(
                `SaneGames: Fetching config with proxy ${i + 1} failed:`,
                error.message
            );
        }
    }
    console.error("SaneGames: All proxy attempts to fetch game config failed.");
    return null;
}

async function loadGame() {
    if (typeof window === "undefined" || typeof document === "undefined")
        return;

    let params = new URLSearchParams(window.location.search);
    let gameSlug = params.get("game");
    let loader = document.getElementById("loader");
    let gameInput = document.getElementById("gameInput");

    if (!gameSlug) {
        if (loader) loader.style.display = "none";
        if (gameInput) gameInput.classList.add("active");
        return;
    }

    // If gameSlug is present, loader should be visible, gameInput hidden initially
    if (loader) loader.style.display = "flex"; // Ensure loader is visible
    if (gameInput) gameInput.classList.remove("active"); // Ensure form is hidden
    if (gameInput) gameInput.style.display = "none";

    let options = await fetchGameConfig(gameSlug);
    if (!options) {
        if (loader) {
            loader.textContent =
                "Loading failed. Could not fetch game configuration. The game slug might be incorrect, the game might not exist, or all our proxy services are down. Please try again later or check the slug.";
            loader.style.display = "flex"; // Ensure loader (now error message) is visible
        }
        if (gameInput) {
            // Show input form again if config fails
            gameInput.classList.add("active");
            gameInput.style.display = "flex"; // Make sure it's flex
        }
        return;
    }

    document.title = (options.gameName || gameSlug) + " | SaneGames";

    if (options.url) {
        const originalGameHtmlUrl = options.url;
        const proxyBaseUrl =
            window.location.hostname === "localhost"
                ? "http://localhost:8888/.netlify/functions/proxy-game"
                : "https://sanegames.netlify.app/.netlify/functions/proxy-game";

        options.url = `${proxyBaseUrl}?target=${encodeURIComponent(
            originalGameHtmlUrl
        )}`;
        console.log(
            `SaneGames: Rewrote game HTML URL to use proxy: ${options.url}`
        );
    } else {
        console.warn(
            "SaneGames: options.url not found in game config. Cannot proxy game HTML."
        );
        if (loader) {
            loader.textContent =
                "Game configuration is missing the main game URL. Cannot load.";
            loader.style.display = "flex";
        }
        if (gameInput) {
            gameInput.classList.add("active");
            gameInput.style.display = "flex";
        }
        return;
    }

    let sdkScriptUrl = "https://builds.crazygames.com/gameframe/v1/bundle.js";
    let script = document.createElement("script");
    script.src = sdkScriptUrl;

    script.onerror = () => {
        console.error(
            "SaneGames: Crazygames SDK script failed to load from:",
            sdkScriptUrl
        );
        if (loader) {
            loader.textContent =
                "Failed to load the CrazyGames SDK script. Please check your internet connection or an adblocker might be blocking the SDK URL. Try again later.";
            loader.style.display = "flex";
        }
        if (gameInput) {
            // Show input form again if SDK script fails
            gameInput.classList.add("active");
            gameInput.style.display = "flex";
        }
    };

    script.onload = () => {
        if (window.Crazygames && typeof window.Crazygames.load === "function") {
            console.log(
                "SaneGames: CrazyGames SDK loaded. Attempting to load game:",
                options.gameName || gameSlug
            );
            Crazygames.load(options)
                .then(() => {
                    console.log(
                        "SaneGames: Game loaded successfully:",
                        options.gameName || gameSlug
                    );
                    if (loader) loader.remove();
                    if (gameInput) gameInput.remove(); // Remove the input form elements entirely
                })
                .catch((error) => {
                    console.error(
                        "SaneGames: Crazygames.load() failed:",
                        error
                    );
                    let errorMessage = `Failed to load game "${
                        options.gameName || gameSlug
                    }". `;

                    // Attempt to guess if it's an X-Frame-Options issue, though this is hard to detect reliably
                    // as the error might be generic from the SDK's perspective.
                    // The browser console will show the X-Frame-Options error directly.
                    if (error && error.message) {
                        errorMessage += `Error: ${error.message}. `;
                        if (
                            error.message
                                .toLowerCase()
                                .includes("x-frame-options") ||
                            error.message
                                .toLowerCase()
                                .includes("refused to display") ||
                            error.message.toLowerCase().includes("sameorigin")
                        ) {
                            errorMessage +=
                                "This game's security settings (X-Frame-Options) likely prevent it from being embedded here. Some games cannot be played on SaneGames due to this. ";
                        }
                    } else {
                        errorMessage +=
                            "An unknown error occurred with the CrazyGames SDK. ";
                    }
                    errorMessage +=
                        "Check the browser console (F12) for more details. You can try a different game.";

                    if (loader) {
                        loader.textContent = errorMessage;
                        loader.style.display = "flex";
                    }
                    if (gameInput) {
                        // Show input form again if game load fails
                        gameInput.classList.add("active");
                        gameInput.style.display = "flex";
                    }
                });
        } else {
            console.error(
                "SaneGames: Crazygames SDK loaded, but window.Crazygames.load is not available or SDK is malformed."
            );
            if (loader) {
                loader.textContent =
                    "CrazyGames SDK loaded incorrectly. The SaneGames client might be outdated, or there's an issue with the SDK itself. Try refreshing.";
                loader.style.display = "flex";
            }
            if (gameInput) {
                // Show input form again
                gameInput.classList.add("active");
                gameInput.style.display = "flex";
            }
        }
    };
    document.head.appendChild(script);
}

function loadGameFromInput() {
    if (typeof window === "undefined" || typeof document === "undefined")
        return;
    let gameSlugInput = document.getElementById("gameSlugInput");
    if (gameSlugInput) {
        let gameSlug = gameSlugInput.value.trim();
        if (gameSlug) {
            // Construct new URL carefully to preserve hash if any, though unlikely needed here
            let currentUrl = new URL(window.location.href);
            currentUrl.search = `?game=${encodeURIComponent(gameSlug)}`;
            window.location.href = currentUrl.toString();
        } else {
            alert("Please enter a game slug.");
        }
    }
}

// --- Recommendations Popup Functions (kept in case you uncomment the HTML) ---
function recommendations() {
    if (typeof document === "undefined") return;
    const popup = document.getElementById("recommendationsPopup");
    if (popup) popup.classList.add("active");
}

function closeRecommendations() {
    if (typeof document === "undefined") return;
    const popup = document.getElementById("recommendationsPopup");
    if (popup) popup.classList.remove("active");
}

if (typeof window !== "undefined") {
    window.onclick = function (event) {
        if (typeof document === "undefined") return;
        const popup = document.getElementById("recommendationsPopup");
        if (
            popup &&
            event.target == popup &&
            popup.classList.contains("active")
        ) {
            closeRecommendations();
        }
    };
}
// --- End Recommendations Popup Functions ---

// Initialize game loading when script runs
loadGame();
