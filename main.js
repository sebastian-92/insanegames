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

// Renamed function to reflect its broader purpose
function applyUiModifications() {
    if (typeof document === "undefined") return;

    // --- Specific MUI Button Text Change (for .css-1fs4034) ---
    const buttonToModifyTextSelector = '.MuiButtonBase-root.css-1fs4034'; // Corrected with leading dot
    document.querySelectorAll(buttonToModifyTextSelector).forEach(button => {
        if (button instanceof HTMLElement) {
            const newText = "Continue (CLICK HERE)";
            if (button.textContent !== newText) {
                let textContainer = button.querySelector('.MuiButton-label, .MuiButton-label-root, span');
                if (textContainer) {
                    textContainer.textContent = newText;
                } else {
                    button.textContent = newText;
                }
                console.log(`SaneGames: Changed text of button matching "${buttonToModifyTextSelector}"`);
            }
        }
    });

    // --- Selector for the MUI button to remove (for .css-b48h4t) ---
    const muiButtonToRemoveSelector = ".MuiButtonBase-root.css-b48h4t"; // Corrected with leading dot

    const selectorsToRemove = [
        muiButtonToRemoveSelector,
        "#crazygames-ad",
        ".ad-container",
    ];

    selectorsToRemove.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
            if (el.parentNode) { // Check if parentNode exists before removing
                console.warn(
                    `SaneGames: Removed element matching selector "${selector}":`,
                    el.tagName,
                    el.id,
                    el.className
                );
                el.remove();
            }
        });
    });

    // --- Broader ad-blocking/element removal logic ---
    document
        .querySelectorAll(
            "iframe, script, div, img, ins, video, style, button, a"
        )
        .forEach((el) => {
            const elSrc = el.src || el.href || el.data || el.poster;
            const elId = el.id || "";
            const elClass =
                el.className ||
                (el.classList ? Array.from(el.classList).join(" ") : "");

            let isPotentialAdOrAnnoyance = false;

            // Ensure we don't try to re-process elements we've specifically handled or intend to keep
            if (el.matches && (el.matches(buttonToModifyTextSelector) || el.matches(muiButtonToRemoveSelector))) {
                // Already handled by specific logic above (one is text-changed, other is removed)
                // No further action needed for these specific selectors in this generic loop
            }
            else if (
                elSrc &&
                typeof elSrc === "string" &&
                adBlockList.some((domain) => elSrc.includes(domain))
            ) {
                isPotentialAdOrAnnoyance = true;
            }
            else if (
                adBlockList.some((keyword) => {
                    const simpleKeyword = keyword.split(".")[0];
                    return (
                        (typeof elId === "string" &&
                            elId.toLowerCase().includes(simpleKeyword)) ||
                        (typeof elClass === "string" &&
                            elClass.toLowerCase().includes(simpleKeyword))
                    );
                })
            ) {
                isPotentialAdOrAnnoyance = true;
            }
            else {
                const commonAdKeywords = [
                    "adbox",
                    "advert",
                    "google_ads",
                    "banner_ad",
                    "promo",
                    "sponsor",
                ];
                if (
                    commonAdKeywords.some(
                        (keyword) =>
                            (typeof elId === "string" &&
                                elId.toLowerCase().includes(keyword)) ||
                            (typeof elClass === "string" &&
                                elClass.toLowerCase().includes(keyword))
                    )
                ) {
                    isPotentialAdOrAnnoyance = true;
                }
            }

            if (isPotentialAdOrAnnoyance && el.parentNode) {
                console.warn(
                    "SaneGames: Removed potential ad/annoying element (generic):",
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
        // No need to check mutations in detail if applyUiModifications handles all cases
        // Just call it to re-evaluate the DOM.
        // For performance, you might add checks if only specific mutations trigger it,
        // but for simplicity and robustness, calling it on any observed change is fine.
        applyUiModifications();
    });

    const startObserver = () => {
        if (document.body) {
            applyUiModifications(); // Initial run
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            document.addEventListener("DOMContentLoaded", () => {
                applyUiModifications(); // Initial run
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        }
    };
    startObserver();
}

async function fetchWithTimeout(url, timeout = 5000) {
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
        )}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(
            `https://games.crazygames.com/en_US/${gameSlug}/index.html`
        )}`,
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

    if (loader) loader.style.display = "flex";
    if (gameInput) {
        gameInput.classList.remove("active");
        gameInput.style.display = "none";
    }

    let options = await fetchGameConfig(gameSlug);
    if (!options) {
        if (loader) {
            loader.textContent =
                "Loading failed. Could not fetch game configuration. The game slug might be incorrect, the game might not exist, or all our proxy services are down. Please try again later or check the slug.";
            loader.style.display = "flex";
        }
        if (gameInput) {
            gameInput.classList.add("active");
            gameInput.style.display = "flex";
        }
        return;
    }

    document.title = (options.gameName || gameSlug) + " | SaneGames";

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
                    if (gameInput) gameInput.remove();
                })
                .catch((error) => {
                    console.error(
                        "SaneGames: Crazygames.load() failed:",
                        error
                    );
                    let errorMessage = `Failed to load game "${
                        options.gameName || gameSlug
                    }". `;

                    if (error && error.message) {
                        errorMessage += `Error: ${error.message}. `;
                        if (
                            error.message
                                .toLowerCase()
                                .includes("x-frame-options") ||
                            error.message
                                .toLowerCase()
                                .includes("refused to display") ||
                            error.message
                                .toLowerCase()
                                .includes("sameorigin") ||
                            error.message
                                .toLowerCase()
                                .includes("frame-ancestors")
                        ) {
                            errorMessage +=
                                "This game's security settings (like X-Frame-Options or Content-Security-Policy) likely prevent it from being embedded here. Some games cannot be played on SaneGames due to these restrictions. ";
                        }
                    } else {
                        errorMessage +=
                            "An unknown error occurred with the CrazyGames SDK. ";
                    }
                    errorMessage +=
                        "Check the browser console (F12) for more specific details. You can try a different game.";

                    if (loader) {
                        loader.textContent = errorMessage;
                        loader.style.display = "flex";
                    }
                    if (gameInput) {
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
            let currentUrl = new URL(window.location.href);
            currentUrl.search = `?game=${encodeURIComponent(gameSlug)}`;
            window.location.href = currentUrl.toString();
        } else {
            alert("Please enter a game slug.");
        }
    }
}

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

loadGame();