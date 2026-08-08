document.addEventListener("DOMContentLoaded", () => {
    const bgContainer = document.getElementById('weather-bg-container');
    const statsPanel = document.getElementById('weather-stats');
    const tempElement = document.getElementById('w-temp');
    const descElement = document.getElementById('w-desc');
    const locElement = document.getElementById('w-location');
    const fallbackMsg = document.getElementById('weather-fallback-msg');

    // WMO Map with specific sky and landscape colors
    const weatherMap = {
        0: { desc: 'Clear sky', sky: '#4facfe', hills: '%233a5a40' },
        1: { desc: 'Mainly clear', sky: '#66a6ff', hills: '%233a5a40' },
        2: { desc: 'Partly cloudy', sky: '#89f7fe', hills: '%23465e49' },
        3: { desc: 'Cloudy', sky: '#a1b8c7', hills: '%234c5750' },
        45: { desc: 'Foggy', sky: '#cfd9df', hills: '%235c6360' },
        51: { desc: 'Drizzle', sky: '#b6c7d1', hills: '%2338423c' },
        61: { desc: 'Rain', sky: '#5b738c', hills: '%23232c26' },
        71: { desc: 'Snow', sky: '#e6e9f0', hills: '%23d0d6df' },
        95: { desc: 'Thunderstorm', sky: '#243b55', hills: '%23151c18' }
    };

    // --- INTEGRATION: TOGGLE SWITCH WATCHDOG ---
    function checkThemeState() {
        // Checks if ui-controller.js has applied standard dark mode classes to the body
        const isDark = document.body.classList.contains('dark-mode') || 
                       document.body.classList.contains('dark-theme') ||
                       document.body.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            bgContainer.style.visibility = 'hidden';
            statsPanel.style.visibility = 'hidden';
        } else {
            bgContainer.style.visibility = 'visible';
            statsPanel.style.visibility = 'visible';
        }
    }

    // Listen to changes on the body class triggered by your toggle button
    const observer = new MutationObserver(checkThemeState);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    // Fallback: Bind to the toggle input directly just in case
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', () => setTimeout(checkThemeState, 50));
    });
    // -------------------------------------------

    function triggerFallback() {
        fallbackMsg.style.display = 'block';
        statsPanel.style.display = 'none';
    }

    async function fetchWeather(lat, lon) {
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            if (!response.ok) throw new Error("API Connection Failed");
            
            const data = await response.json();
            const current = data.current_weather;
            const wData = weatherMap[current.weathercode] || weatherMap[3]; 

            tempElement.textContent = `${Math.round(current.temperature)}°`;
            descElement.textContent = wData.desc;
            
            bgContainer.style.setProperty('--sky-color', wData.sky);
            const hillsLayer = document.getElementById('w-hills');
            hillsLayer.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg preserveAspectRatio="none" viewBox="0 0 1200 200" xmlns="http://www.w3.org/2000/svg"><path d="M0 200 L0 100 C 300 -50, 800 250, 1200 50 L 1200 200 Z" fill="${wData.hills}"/></svg>')`;

            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                locElement.textContent = geoData.address.village || geoData.address.town || geoData.address.city || "Local Area";
            } else {
                locElement.textContent = "Current Location";
            }

            statsPanel.style.display = 'block';
            checkThemeState(); // Run check immediately after loading stats

        } catch (error) {
            console.error("Weather Engine Error:", error);
            triggerFallback();
        }
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeather(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.warn("Geolocation failed:", error.message);
                triggerFallback();
            },
            { timeout: 10000 }
        );
    } else {
        triggerFallback();
    }
});