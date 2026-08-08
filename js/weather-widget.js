// ==========================================
// TCS SOC - REGIONAL WEATHER SYSTEM (NORMAL MODE ONLY)
// - Live weather from Open-Meteo (no API key)
// - Precise location + state/country from BigDataCloud's free reverse-geocoder
// - Stats shown in English + the actual regional language of that precise location
// - Full-screen realistic animated weather background (canvas)
// Power Saver mode is completely untouched: this module no-ops there.
// ==========================================

// ---- Regional language dictionary (English is always shown alongside these) ----
const WEATHER_TRANSLATIONS = {
    en: { temperature: "Temperature", feels: "Feels like", humidity: "Humidity", wind: "Wind", locating: "Locating you…", fetching: "Fetching weather…", unable: "Unable to fetch live data", clear: "Clear Sky", cloudy: "Cloudy", overcast: "Overcast", fog: "Foggy", drizzle: "Light Drizzle", rain: "Rainy", snow: "Snowy", thunder: "Thunderstorm" },
    hi: { temperature: "तापमान", feels: "महसूस होता है", humidity: "नमी", wind: "हवा", locating: "आपका स्थान ढूंढा जा रहा है…", fetching: "मौसम की जानकारी ला रहे हैं…", unable: "लाइव डेटा प्राप्त करने में असमर्थ", clear: "साफ़ आसमान", cloudy: "बादल छाए हुए", overcast: "घने बादल", fog: "कोहरा", drizzle: "हल्की बूंदाबांदी", rain: "बारिश", snow: "बर्फ़बारी", thunder: "आंधी-तूफ़ान" },
    te: { temperature: "ఉష్ణోగ్రత", feels: "అనుభూతి", humidity: "తేమ", wind: "గాలి", locating: "మీ స్థానాన్ని గుర్తిస్తోంది…", fetching: "వాతావరణ సమాచారం పొందుతోంది…", unable: "ప్రత్యక్ష డేటాను పొందడం సాధ్యం కాలేదు", clear: "నిర్మలమైన ఆకాశం", cloudy: "మేఘావృతం", overcast: "దట్టమైన మేఘాలు", fog: "పొగమంచు", drizzle: "చిరు జల్లులు", rain: "వర్షం", snow: "మంచు", thunder: "ఉరుములతో కూడిన వర్షం" },
    ta: { temperature: "வெப்பநிலை", feels: "உணரப்படும் வெப்பநிலை", humidity: "ஈரப்பதம்", wind: "காற்று", locating: "உங்கள் இருப்பிடத்தை கண்டறிகிறது…", fetching: "வானிலை தகவலைப் பெறுகிறது…", unable: "நேரடி தரவைப் பெற முடியவில்லை", clear: "தெளிவான வானம்", cloudy: "மேகமூட்டம்", overcast: "அடர் மேகங்கள்", fog: "மூடுபனி", drizzle: "லேசான தூறல்", rain: "மழை", snow: "பனி", thunder: "இடி மழை" },
    kn: { temperature: "ತಾಪಮಾನ", feels: "ಅನುಭವವಾಗುತ್ತಿದೆ", humidity: "ತೇವಾಂಶ", wind: "ಗಾಳಿ", locating: "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಪತ್ತೆ ಮಾಡಲಾಗುತ್ತಿದೆ…", fetching: "ಹವಾಮಾನ ಮಾಹಿತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ…", unable: "ನೇರ ಡೇಟಾ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", clear: "ಸ್ಪಷ್ಟ ಆಕಾಶ", cloudy: "ಮೋಡ ಕವಿದ", overcast: "ದಟ್ಟ ಮೋಡ", fog: "ಮಂಜು", drizzle: "ತುಂತುರು ಮಳೆ", rain: "ಮಳೆ", snow: "ಹಿಮ", thunder: "ಗುಡುಗು ಸಹಿತ ಮಳೆ" },
    ml: { temperature: "താപനില", feels: "അനുഭവപ്പെടുന്നത്", humidity: "ഈർപ്പം", wind: "കാറ്റ്", locating: "നിങ്ങളുടെ സ്ഥാനം കണ്ടെത്തുന്നു…", fetching: "കാലാവസ്ഥാ വിവരം ശേഖരിക്കുന്നു…", unable: "തത്സമയ ഡാറ്റ ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല", clear: "തെളിഞ്ഞ ആകാശം", cloudy: "മേഘാവൃതം", overcast: "കട്ടിയുള്ള മേഘങ്ങൾ", fog: "മൂടൽമഞ്ഞ്", drizzle: "ചെറിയ മഴ", rain: "മഴ", snow: "മഞ്ഞ്", thunder: "ഇടിമിന്നലോടു കൂടിയ മഴ" },
    bn: { temperature: "তাপমাত্রা", feels: "অনুভূত হয়", humidity: "আর্দ্রতা", wind: "বাতাস", locating: "আপনার অবস্থান খোঁজা হচ্ছে…", fetching: "আবহাওয়ার তথ্য আনা হচ্ছে…", unable: "লাইভ ডেটা আনতে ব্যর্থ", clear: "পরিষ্কার আকাশ", cloudy: "মেঘলা", overcast: "ঘন মেঘ", fog: "কুয়াশা", drizzle: "হালকা বৃষ্টি", rain: "বৃষ্টি", snow: "তুষার", thunder: "বজ্রঝড়" },
    mr: { temperature: "तापमान", feels: "जाणवते", humidity: "आर्द्रता", wind: "वारा", locating: "तुमचे स्थान शोधत आहे…", fetching: "हवामान माहिती आणत आहे…", unable: "थेट डेटा मिळवता आला नाही", clear: "निरभ्र आकाश", cloudy: "ढगाळ", overcast: "दाट ढग", fog: "धुके", drizzle: "हलका शिडकावा", rain: "पाऊस", snow: "बर्फ", thunder: "वादळी पाऊस" },
    gu: { temperature: "તાપમાન", feels: "અનુભવાય છે", humidity: "ભેજ", wind: "પવન", locating: "તમારું સ્થાન શોધી રહ્યાં છીએ…", fetching: "હવામાન માહિતી લાવી રહ્યાં છીએ…", unable: "લાઈવ ડેટા મેળવવામાં અસમર્થ", clear: "સ્વચ્છ આકાશ", cloudy: "વાદળછાયું", overcast: "ઘાટા વાદળો", fog: "ધુમ્મસ", drizzle: "હળવો વરસાદ", rain: "વરસાદ", snow: "બરફ", thunder: "વાવાઝોડું" },
    pa: { temperature: "ਤਾਪਮਾਨ", feels: "ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ", humidity: "ਨਮੀ", wind: "ਹਵਾ", locating: "ਤੁਹਾਡੀ ਸਥਿਤੀ ਲੱਭੀ ਜਾ ਰਹੀ ਹੈ…", fetching: "ਮੌਸਮ ਦੀ ਜਾਣਕਾਰੀ ਲਿਆਂਦੀ ਜਾ ਰਹੀ ਹੈ…", unable: "ਲਾਈਵ ਡਾਟਾ ਪ੍ਰਾਪਤ ਕਰਨ ਵਿੱਚ ਅਸਮਰੱਥ", clear: "ਸਾਫ਼ ਅਸਮਾਨ", cloudy: "ਬੱਦਲਵਾਈ", overcast: "ਸੰਘਣੇ ਬੱਦਲ", fog: "ਧੁੰਦ", drizzle: "ਹਲਕੀ ਬੂੰਦਾਬਾਂਦੀ", rain: "ਮੀਂਹ", snow: "ਬਰਫ਼", thunder: "ਗਰਜ-ਤੂਫ਼ਾਨ" },
    ur: { temperature: "درجہ حرارت", feels: "محسوس ہوتا ہے", humidity: "نمی", wind: "ہوا", locating: "آپ کا مقام تلاش کیا جا رہا ہے…", fetching: "موسم کی معلومات حاصل کی جا رہی ہیں…", unable: "لائیو ڈیٹا حاصل کرنے میں ناکام", clear: "صاف آسمان", cloudy: "ابر آلود", overcast: "گھنے بادل", fog: "دھند", drizzle: "ہلکی بارش", rain: "بارش", snow: "برف", thunder: "آندھی طوفان" },
    or: { temperature: "ତାପମାତ୍ରା", feels: "ଅନୁଭବ ହେଉଛି", humidity: "ଆର୍ଦ୍ରତା", wind: "ପବନ", locating: "ଆପଣଙ୍କ ଅବସ୍ଥାନ ଖୋଜାଯାଉଛି…", fetching: "ପାଣିପାଗ ସୂଚନା ଆଣୁଛି…", unable: "ଲାଇଭ ତଥ୍ୟ ପାଇବାରେ ଅସମର୍ଥ", clear: "ପରିଷ୍କାର ଆକାଶ", cloudy: "ମେଘୁଆ", overcast: "ଘନ ମେଘ", fog: "କୁହୁଡ଼ି", drizzle: "ହାଲୁକା ବର୍ଷା", rain: "ବର୍ଷା", snow: "ପାଣି ବରଫ", thunder: "ବଜ୍ରପାତ ସହିତ ବର୍ଷା" },
    as: { temperature: "উষ্ণতা", feels: "অনুভৱ হয়", humidity: "আৰ্দ্ৰতা", wind: "বতাহ", locating: "আপোনাৰ অৱস্থান বিচাৰি উলিওৱা হৈছে…", fetching: "বতৰৰ তথ্য অনা হৈছে…", unable: "প্ৰত্যক্ষ তথ্য পাব পৰা নগ'ল", clear: "পৰিষ্কাৰ আকাশ", cloudy: "মেঘলা", overcast: "ঘন মেঘ", fog: "কুঁৱলী", drizzle: "পাতল বৰষুণ", rain: "বৰষুণ", snow: "বৰফ", thunder: "বজ্ৰপাতৰ সৈতে বৰষুণ" },
    es: { temperature: "Temperatura", feels: "Sensación térmica", humidity: "Humedad", wind: "Viento", locating: "Localizando…", fetching: "Obteniendo el clima…", unable: "No se pudo obtener datos en vivo", clear: "Cielo despejado", cloudy: "Nublado", overcast: "Muy nublado", fog: "Niebla", drizzle: "Llovizna", rain: "Lluvia", snow: "Nieve", thunder: "Tormenta eléctrica" },
    fr: { temperature: "Température", feels: "Ressenti", humidity: "Humidité", wind: "Vent", locating: "Localisation en cours…", fetching: "Récupération de la météo…", unable: "Impossible d'obtenir les données en direct", clear: "Ciel dégagé", cloudy: "Nuageux", overcast: "Couvert", fog: "Brouillard", drizzle: "Bruine", rain: "Pluie", snow: "Neige", thunder: "Orage" },
    de: { temperature: "Temperatur", feels: "Gefühlt wie", humidity: "Luftfeuchtigkeit", wind: "Wind", locating: "Standort wird ermittelt…", fetching: "Wetter wird abgerufen…", unable: "Live-Daten konnten nicht abgerufen werden", clear: "Klarer Himmel", cloudy: "Bewölkt", overcast: "Bedeckt", fog: "Nebel", drizzle: "Nieselregen", rain: "Regen", snow: "Schnee", thunder: "Gewitter" },
    pt: { temperature: "Temperatura", feels: "Sensação térmica", humidity: "Umidade", wind: "Vento", locating: "Localizando…", fetching: "Obtendo a previsão do tempo…", unable: "Não foi possível obter dados ao vivo", clear: "Céu limpo", cloudy: "Nublado", overcast: "Encoberto", fog: "Neblina", drizzle: "Garoa", rain: "Chuva", snow: "Neve", thunder: "Tempestade" },
    zh: { temperature: "温度", feels: "体感温度", humidity: "湿度", wind: "风速", locating: "正在定位…", fetching: "正在获取天气…", unable: "无法获取实时数据", clear: "晴朗", cloudy: "多云", overcast: "阴天", fog: "有雾", drizzle: "小雨", rain: "下雨", snow: "下雪", thunder: "雷暴" },
    ja: { temperature: "気温", feels: "体感温度", humidity: "湿度", wind: "風速", locating: "位置情報を取得中…", fetching: "天気を取得中…", unable: "ライブデータを取得できません", clear: "晴れ", cloudy: "曇り", overcast: "曇天", fog: "霧", drizzle: "小雨", rain: "雨", snow: "雪", thunder: "雷雨" },
    ar: { temperature: "درجة الحرارة", feels: "الإحساس الحراري", humidity: "الرطوبة", wind: "الرياح", locating: "جارٍ تحديد موقعك…", fetching: "جارٍ جلب حالة الطقس…", unable: "تعذر جلب البيانات المباشرة", clear: "سماء صافية", cloudy: "غائم جزئياً", overcast: "غائم", fog: "ضباب", drizzle: "رذاذ خفيف", rain: "أمطار", snow: "ثلوج", thunder: "عاصفة رعدية" },
    ru: { temperature: "Температура", feels: "Ощущается как", humidity: "Влажность", wind: "Ветер", locating: "Определение местоположения…", fetching: "Загрузка погоды…", unable: "Не удалось получить данные", clear: "Ясно", cloudy: "Облачно", overcast: "Пасмурно", fog: "Туман", drizzle: "Морось", rain: "Дождь", snow: "Снег", thunder: "Гроза" }
};

const RTL_LANGS = new Set(['ur', 'ar']);

// ---- Precise region -> language resolution ----
// Indian state/UT (as returned by the geocoder, in English) -> regional language code
const INDIA_STATE_LANG = {
    "andhra pradesh": "te",
    "telangana": "te",
    "odisha": "or",
    "orissa": "or",
    "tamil nadu": "ta",
    "puducherry": "ta",
    "karnataka": "kn",
    "kerala": "ml",
    "lakshadweep": "ml",
    "west bengal": "bn",
    "tripura": "bn",
    "maharashtra": "mr",
    "goa": "mr",
    "gujarat": "gu",
    "dadra and nagar haveli and daman and diu": "gu",
    "punjab": "pa",
    "chandigarh": "pa",
    "jammu and kashmir": "ur",
    "assam": "as",
    "bihar": "hi",
    "uttar pradesh": "hi",
    "madhya pradesh": "hi",
    "rajasthan": "hi",
    "delhi": "hi",
    "nct of delhi": "hi",
    "haryana": "hi",
    "jharkhand": "hi",
    "chhattisgarh": "hi",
    "uttarakhand": "hi",
    "himachal pradesh": "hi",
    "ladakh": "hi",
    "sikkim": "hi",
    "manipur": "hi",
    "meghalaya": "hi",
    "mizoram": "hi",
    "nagaland": "hi",
    "arunachal pradesh": "hi",
    "andaman and nicobar islands": "hi"
};

// Fallback for locations outside India: ISO country code -> primary regional language
const COUNTRY_LANG = {
    FR: "fr", DE: "de", AT: "de", CH: "de", ES: "es", MX: "es", AR: "es", CO: "es",
    CN: "zh", TW: "zh", JP: "ja", RU: "ru", BY: "ru",
    SA: "ar", AE: "ar", EG: "ar", QA: "ar", KW: "ar", OM: "ar", IQ: "ar",
    BR: "pt", PT: "pt", PK: "ur", BD: "bn"
};

function resolveRegionalLang(stateName, countryCode) {
    if (countryCode === 'IN' && stateName) {
        const key = stateName.trim().toLowerCase();
        if (INDIA_STATE_LANG[key]) return INDIA_STATE_LANG[key];
    }
    if (countryCode && COUNTRY_LANG[countryCode]) return COUNTRY_LANG[countryCode];
    // Last resort: browser locale, if we happen to have that language
    const browserBase = (navigator.language || '').split('-')[0].toLowerCase();
    if (WEATHER_TRANSLATIONS[browserBase]) return browserBase;
    return null; // English only
}

function t(key, langCode) {
    return (WEATHER_TRANSLATIONS[langCode] && WEATHER_TRANSLATIONS[langCode][key]) || WEATHER_TRANSLATIONS.en[key] || key;
}

// WMO weather code -> internal category
function codeToCategory(code) {
    if (code === 0) return 'clear';
    if (code === 1) return 'clear';
    if (code === 2) return 'cloudy';
    if (code === 3) return 'overcast';
    if (code === 45 || code === 48) return 'fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'thunder';
    return 'cloudy';
}

// ==========================================
// FETCH HELPERS (open, key-free APIs)
// ==========================================
async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather_fetch_failed');
    const data = await res.json();
    if (!data || !data.current) throw new Error('weather_no_data');
    return {
        current: data.current,
        high: data.daily && data.daily.temperature_2m_max ? data.daily.temperature_2m_max[0] : null,
        low: data.daily && data.daily.temperature_2m_min ? data.daily.temperature_2m_min[0] : null
    };
}

// 1. Precise, bilingual place name using Nominatim for street-level accuracy
async function fetchPreciseLocation(lat, lon) {
    // A. Fetch English version first
    const urlEn = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
    const resEn = await fetch(urlEn);
    if (!resEn.ok) throw new Error('geocode_failed');
    const dataEn = await resEn.json();
    
    const addrEn = dataEn.address || {};
    const partsEn = [];
    if (addrEn.road) partsEn.push(addrEn.road);
    if (addrEn.neighbourhood) partsEn.push(addrEn.neighbourhood);
    if (addrEn.suburb) partsEn.push(addrEn.suburb);
    else if (addrEn.village) partsEn.push(addrEn.village);
    
    const labelEn = partsEn.length > 0 ? partsEn.join(', ') : (addrEn.city || dataEn.name);
    const stateEn = addrEn.state || '';
    const countryCode = (addrEn.country_code || '').toUpperCase();

    // B. Determine Regional Language based on English state/country
    const regionalLang = resolveRegionalLang(stateEn, countryCode);

    // C. Fetch Local Language version if applicable
    let labelRegional = '';
    if (regionalLang && regionalLang !== 'en') {
        try {
            const urlLocal = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${regionalLang}`;
            const resLocal = await fetch(urlLocal);
            const dataLocal = await resLocal.json();
            
            const addrLocal = dataLocal.address || {};
            const partsLocal = [];
            if (addrLocal.road) partsLocal.push(addrLocal.road);
            if (addrLocal.neighbourhood) partsLocal.push(addrLocal.neighbourhood);
            if (addrLocal.suburb) partsLocal.push(addrLocal.suburb);
            else if (addrLocal.village) partsLocal.push(addrLocal.village);
            
            labelRegional = partsLocal.length > 0 ? partsLocal.join(', ') : (addrLocal.city || dataLocal.name);
        } catch(e) {
            console.warn("Failed to fetch local language location");
        }
    }

    return {
        labelEn: labelEn || '',
        labelRegional: labelRegional || '',
        regionalLang: regionalLang
    };
}

// ==========================================
// TEXT PANEL RENDERING (English + Regional)
// ==========================================
function getEls() {
    return {
        widget: document.getElementById('weather-hero'),
        temp: document.getElementById('weather-temp'),
        desc: document.getElementById('weather-desc'),
        place: document.getElementById('weather-place'),
        hilo: document.getElementById('weather-hilo'),
        meta: document.getElementById('weather-meta'),
        error: document.getElementById('weather-error')
    };
}

function bilingualLine(key, regionalLang) {
    const en = t(key, 'en');
    if (!regionalLang || regionalLang === 'en') {
        return `<span class="wx-en">${en}</span>`;
    }
    const dir = RTL_LANGS.has(regionalLang) ? ' dir="rtl"' : '';
    const regional = t(key, regionalLang);
    return `<span class="wx-en">${en}</span><span class="wx-regional"${dir}>${regional}</span>`;
}

function renderLoading(messageKey, regionalLang) {
    const els = getEls();
    if (!els.widget) return;
    els.widget.classList.remove('wx-error-state');
    if (els.temp) els.temp.textContent = '--°';
    if (els.desc) els.desc.innerHTML = bilingualLine(messageKey || 'fetching', regionalLang);
    if (els.place) els.place.textContent = '';
    if (els.hilo) els.hilo.innerHTML = '';
    if (els.meta) els.meta.innerHTML = '';
    if (els.error) els.error.style.display = 'none';
}

function renderError(regionalLang) {
    const els = getEls();
    if (!els.widget) return;
    els.widget.classList.add('wx-error-state');
    if (els.temp) els.temp.textContent = '--°';
    if (els.desc) els.desc.innerHTML = '';
    if (els.place) els.place.textContent = '';
    if (els.hilo) els.hilo.innerHTML = '';
    if (els.meta) els.meta.innerHTML = '';
    if (els.error) {
        const dir = regionalLang && RTL_LANGS.has(regionalLang) ? ' dir="rtl"' : '';
        const regionalMsg = regionalLang ? `<div class="wx-regional"${dir}>${t('unable', regionalLang)}</div>` : '';
        els.error.innerHTML = `<div class="wx-en">${t('unable', 'en')}</div>${regionalMsg}`;
        els.error.style.display = 'block';
    }
}

function metaRow(labelKey, value, regionalLang) {
    const dir = regionalLang && RTL_LANGS.has(regionalLang) ? ' dir="rtl"' : '';
    const regionalLabel = regionalLang ? `<span class="wx-regional"${dir}>${t(labelKey, regionalLang)}: ${value}</span>` : '';
    return `<div class="wx-meta-pair"><span class="wx-en">${t(labelKey, 'en')}: ${value}</span>${regionalLabel}</div>`;
}

// 2. Updated renderWeather to inject the HTML bilingual layout
function renderWeather(current, high, low, locationHtml, regionalLang) {
    const els = getEls();
    if (!els.widget) return;
    els.widget.classList.remove('wx-error-state');

    const category = codeToCategory(current.weather_code);
    if (els.temp) els.temp.textContent = `${Math.round(current.temperature_2m)}°`;
    if (els.desc) els.desc.innerHTML = bilingualLine(category, regionalLang);
    
    // Use innerHTML so we can stack the English and Regional spans
    if (els.place) els.place.innerHTML = locationHtml || ''; 
    
    if (els.hilo && high != null && low != null) {
        els.hilo.innerHTML = `<span class="wx-en">↑ ${Math.round(high)}° / ↓ ${Math.round(low)}°</span>`;
    }
    if (els.meta) {
        els.meta.innerHTML =
            metaRow('feels', `${Math.round(current.apparent_temperature)}°C`, regionalLang) +
            metaRow('humidity', `${Math.round(current.relative_humidity_2m)}%`, regionalLang) +
            metaRow('wind', `${Math.round(current.wind_speed_10m)} km/h`, regionalLang);
    }
    if (els.error) els.error.style.display = 'none';
}

// ==========================================
// FULL-SCREEN REALISTIC WEATHER BACKGROUND
// ==========================================
let canvas, ctx, canvasW, canvasH, dpr;
let rafId = null;
let currentCategory = 'generic';
let particles = { rain: [], snow: [], clouds: [] };
let lightningTimer = 0, lightningOpacity = 0;
let sunPulse = 0;
let canvasRunning = false;

function rand(min, max) { return Math.random() * (max - min) + min; }

function setupCanvas() {
    canvas = document.getElementById('weather-bg-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return true;
}

function resizeCanvas() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
}

function seedParticles() {
    // Rain — layered depths for a smooth, realistic parallax fall
    particles.rain = [];
    const rainCount = (currentCategory === 'rain' || currentCategory === 'thunder') ? 160 : (currentCategory === 'drizzle' ? 90 : 0);
    for (let i = 0; i < rainCount; i++) {
        const depth = rand(0.4, 1);
        particles.rain.push({
            x: rand(0, canvasW), y: rand(0, canvasH),
            len: rand(10, 26) * depth, speed: rand(6, 14) * depth,
            opacity: rand(0.2, 0.5) * depth
        });
    }

    // Snow
    particles.snow = [];
    const snowCount = currentCategory === 'snow' ? 130 : 0;
    for (let i = 0; i < snowCount; i++) {
        const depth = rand(0.4, 1);
        particles.snow.push({
            x: rand(0, canvasW), y: rand(0, canvasH),
            r: rand(1.5, 4) * depth, speed: rand(0.6, 1.8) * depth,
            sway: rand(0.5, 2), phase: rand(0, Math.PI * 2), opacity: rand(0.4, 0.9) * depth
        });
    }

    // Clouds (used for cloudy/overcast/fog/thunder/drizzle/rain, plus a light scattering for clear/snow so the
    // scene always reads as a real sky, not just a flat gradient) — layered "puffs" for a soft, painterly look
    particles.clouds = [];
    const wantsClouds = ['cloudy', 'overcast', 'fog', 'thunder', 'drizzle', 'rain', 'clear', 'snow', 'generic'].includes(currentCategory);
    if (wantsClouds) {
        let cloudCount;
        if (currentCategory === 'overcast' || currentCategory === 'thunder') cloudCount = 9;
        else if (currentCategory === 'cloudy' || currentCategory === 'fog' || currentCategory === 'drizzle' || currentCategory === 'rain') cloudCount = 6;
        else cloudCount = 3; // clear / snow / generic — a few light wisps for depth
        for (let i = 0; i < cloudCount; i++) {
            const depth = rand(0.3, 1);
            const rx = rand(110, 260) * depth;
            const ry = rand(35, 70) * depth;
            // Precompute a fixed cluster of offset puffs so each cloud keeps a consistent,
            // organic silhouette while it drifts (avoids a "single blurry oval" look).
            const puffs = [];
            const puffCount = 4 + Math.floor(rand(0, 3));
            for (let p = 0; p < puffCount; p++) {
                puffs.push({
                    ox: rand(-rx * 0.6, rx * 0.6),
                    oy: rand(-ry * 0.35, ry * 0.3),
                    r: rand(rx * 0.35, rx * 0.6)
                });
            }
            particles.clouds.push({
                x: rand(-100, canvasW + 100), y: rand(canvasH * 0.06, canvasH * 0.5),
                baseY: 0, bob: rand(0, Math.PI * 2),
                rx, ry, puffs,
                speed: rand(3, 11) * depth, opacity: rand(0.16, 0.42) * depth
            });
        }
    }

    // Distant landscape silhouette (very slow parallax layers, like the far shoreline in a scenic sky app)
    particles.horizon = [];
    for (let layer = 0; layer < 2; layer++) {
        const points = [];
        const segs = 10;
        for (let i = 0; i <= segs; i++) {
            points.push(rand(-14, 14));
        }
        particles.horizon.push({ points, seed: rand(0, 1000), depth: layer });
    }
}

function skyGradient() {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 19;
    const g = ctx.createLinearGradient(0, 0, 0, canvasH);

    if (currentCategory === 'clear') {
        if (isNight) { g.addColorStop(0, '#020617'); g.addColorStop(0.6, '#071022'); g.addColorStop(1, '#101b30'); }
        else { g.addColorStop(0, '#031225'); g.addColorStop(0.55, '#0a2038'); g.addColorStop(1, '#123852'); }
    } else if (currentCategory === 'fog') {
        g.addColorStop(0, '#0a121c'); g.addColorStop(0.6, '#141f2a'); g.addColorStop(1, '#233240');
    } else if (currentCategory === 'thunder') {
        g.addColorStop(0, '#050810'); g.addColorStop(0.6, '#0c131f'); g.addColorStop(1, '#141f2e');
    } else if (currentCategory === 'snow') {
        g.addColorStop(0, '#050b16'); g.addColorStop(0.6, '#0e1728'); g.addColorStop(1, '#1a2a3c');
    } else if (currentCategory === 'rain' || currentCategory === 'drizzle') {
        g.addColorStop(0, '#020810'); g.addColorStop(0.6, '#0a1420'); g.addColorStop(1, '#152230');
    } else if (currentCategory === 'overcast') {
        g.addColorStop(0, '#050810'); g.addColorStop(0.6, '#0f1620'); g.addColorStop(1, '#1b2732');
    } else {
        g.addColorStop(0, '#03060d'); g.addColorStop(0.6, '#0a121c'); g.addColorStop(1, '#131c28');
    }
    return { gradient: g, isNight };
}

function drawSun() {
    sunPulse += 0.01;
    const cx = canvasW * 0.82, cy = canvasH * 0.2;
    const pulse = 1 + Math.sin(sunPulse) * 0.05;
    const radius = Math.min(canvasW, canvasH) * 0.055 * pulse;

    // Rays
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sunPulse * 0.15);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 1.4, Math.sin(a) * radius * 1.4);
        ctx.lineTo(Math.cos(a) * radius * 2.4, Math.sin(a) * radius * 2.4);
        ctx.stroke();
    }
    ctx.restore();

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2); ctx.fill();

    // Core
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
}

function drawStars(seedTime) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
    for (let i = 0; i < 60; i++) {
        const x = (i * 137.5) % canvasW;
        const y = (i * 71.3) % (canvasH * 0.6);
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(seedTime * 0.001 + i));
        ctx.globalAlpha = twinkle * 0.6;
        ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
}

function drawClouds(t0) {
    particles.clouds.forEach(c => {
        c.x += c.speed * 0.016;
        if (c.x - c.rx > canvasW) c.x = -c.rx;
        c.bob += 0.004; // gentle vertical breathing so the sky never feels static
        const yOff = Math.sin(c.bob) * 3;
        const base = currentCategory === 'thunder' ? '30, 41, 59' : '100, 116, 139';

        // Render each cloud as a cluster of soft overlapping puffs for a natural, painterly silhouette
        c.puffs.forEach(p => {
            const px = c.x + p.ox;
            const py = c.y + yOff + p.oy;
            const g = ctx.createRadialGradient(px, py, 0, px, py, p.r);
            g.addColorStop(0, `rgba(${base}, ${c.opacity})`);
            g.addColorStop(0.7, `rgba(${base}, ${c.opacity * 0.6})`);
            g.addColorStop(1, `rgba(${base}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

function drawFogBands(t0) {
    for (let i = 0; i < 4; i++) {
        const y = canvasH * (0.55 + i * 0.12);
        const shift = Math.sin(t0 * 0.00025 + i) * 40;
        const g = ctx.createLinearGradient(0, y - 30, 0, y + 30);
        g.addColorStop(0, 'rgba(148, 163, 184, 0)');
        g.addColorStop(0.5, `rgba(148, 163, 184, ${0.12 + i * 0.03})`);
        g.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(-60 + shift, y - 30, canvasW + 120, 60);
    }
}

// A soft, distant landscape silhouette + a faint reflective "water" glow along the bottom edge —
// gives the full-screen scene the same calm, scenic depth as a scenic weather-app background,
// without depicting any specific illustration, character, or branded artwork.
function drawHorizon(t0) {
    const baseY = canvasH * 0.88;
    particles.horizon.forEach((layer, idx) => {
        const drift = Math.sin(t0 * 0.00006 + layer.seed) * (6 - layer.depth * 3);
        const rowY = baseY + layer.depth * 26;
        const shade = layer.depth === 0 ? 'rgba(8, 16, 26, 0.55)' : 'rgba(4, 9, 15, 0.75)';

        ctx.beginPath();
        ctx.moveTo(0, canvasH);
        ctx.lineTo(0, rowY + layer.points[0]);
        const segW = canvasW / (layer.points.length - 1);
        layer.points.forEach((p, i) => {
            ctx.lineTo(i * segW + drift, rowY + p);
        });
        ctx.lineTo(canvasW, canvasH);
        ctx.closePath();
        ctx.fillStyle = shade;
        ctx.fill();
    });

    // Faint reflective glow where "land" meets "water", echoing the sky tone
    const glow = ctx.createLinearGradient(0, baseY - 10, 0, canvasH);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, baseY - 10, canvasW, canvasH - baseY + 10);
}

function drawRain() {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineCap = 'round';
    particles.rain.forEach(p => {
        ctx.globalAlpha = p.opacity;
        ctx.lineWidth = p.len > 20 ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.15, p.y + p.len);
        ctx.stroke();
        p.y += p.speed * 1.6;
        p.x -= p.speed * 0.12;
        if (p.y > canvasH) { p.y = -p.len; p.x = rand(0, canvasW); }
    });
    ctx.globalAlpha = 1;
}

function drawSnow() {
    ctx.fillStyle = '#f1f5f9';
    particles.snow.forEach(p => {
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(p.phase) * p.sway * 6, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        p.phase += 0.015;
        if (p.y > canvasH) { p.y = -p.r; p.x = rand(0, canvasW); }
    });
    ctx.globalAlpha = 1;
}

function drawLightning(t0) {
    lightningTimer -= 16;
    if (lightningTimer <= 0) {
        lightningTimer = rand(2500, 7000);
        lightningOpacity = 1;
    }
    if (lightningOpacity > 0) {
        ctx.fillStyle = `rgba(199, 220, 255, ${lightningOpacity * 0.35})`;
        ctx.fillRect(0, 0, canvasW, canvasH);
        lightningOpacity -= 0.06;
        if (lightningOpacity < 0) lightningOpacity = 0;
    }
}

function drawGenericAmbient(t0) {
    // Calm, neutral drifting particles used before data loads or on error —
    // deliberately understated so it never implies a false weather condition.
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    for (let i = 0; i < 40; i++) {
        const x = (i * 97 + t0 * 0.01) % canvasW;
        const y = (i * 53) % canvasH;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderFrame(t0) {
    if (!ctx) return;
    const { gradient, isNight } = skyGradient();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Scenic base layer — distant shoreline + reflective water glow, present in every condition
    drawHorizon(t0);

    switch (currentCategory) {
        case 'clear':
            if (isNight) drawStars(t0); else drawSun();
            drawClouds(t0);
            break;
        case 'cloudy':
        case 'overcast':
            drawClouds(t0);
            break;
        case 'fog':
            drawClouds(t0);
            drawFogBands(t0);
            break;
        case 'drizzle':
        case 'rain':
            drawClouds(t0);
            drawRain();
            break;
        case 'snow':
            drawClouds(t0);
            drawSnow();
            break;
        case 'thunder':
            drawClouds(t0);
            drawRain();
            drawLightning(t0);
            break;
        default:
            drawClouds(t0);
            drawGenericAmbient(t0);
    }
}

function animateCanvas(t0) {
    if (!canvasRunning) return;
    renderFrame(t0);
    rafId = requestAnimationFrame(animateCanvas);
}

function updateUITheme(category) {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 19;
    const root = document.documentElement;

    // Default Glassmorphism Settings
    let bg = 'rgba(15, 23, 42, 0.45)';
    let accent = '#38bdf8';
    let border = 'rgba(255, 255, 255, 0.1)';

    if (category === 'clear') {
        bg = isNight ? 'rgba(5, 10, 20, 0.6)' : 'rgba(10, 30, 50, 0.3)';
        accent = isNight ? '#818cf8' : '#fbbf24'; // Yellow in day, Indigo at night
    } else if (category === 'rain' || category === 'drizzle' || category === 'thunder') {
        bg = 'rgba(5, 8, 15, 0.7)';
        accent = category === 'thunder' ? '#a78bfa' : '#60a5fa'; // Purple for thunder
        border = 'rgba(255, 255, 255, 0.05)';
    } else if (category === 'snow') {
        bg = 'rgba(40, 50, 65, 0.4)';
        accent = '#e0f2fe';
        border = 'rgba(255, 255, 255, 0.2)';
    } else if (category === 'fog' || category === 'overcast' || category === 'cloudy') {
        bg = 'rgba(15, 20, 30, 0.55)';
        accent = '#94a3b8'; // Slate grey for cloudy
    }

    root.style.setProperty('--ui-panel-bg', bg);
    root.style.setProperty('--ui-accent', accent);
    root.style.setProperty('--ui-border', border);
}

function setCategory(category) {
    if (category === currentCategory) return;
    currentCategory = category;
    seedParticles();
    updateUITheme(category); // Updates UI colors to match the weather
}

function startCanvasLoop() {
    if (canvasRunning || !canvas) return;
    canvasRunning = true;
    rafId = requestAnimationFrame(animateCanvas);
}

function stopCanvasLoop() {
    canvasRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
}

// Save CPU when the tab is hidden — same spirit as the existing power-save kill-switch
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopCanvasLoop();
    } else if (!document.body.classList.contains('power-save-mode')) {
        startCanvasLoop();
    }
});

// ==========================================
// ORCHESTRATION
// ==========================================
let weatherInitialized = false;
let weatherRefreshTimer = null;

function isPowerSave() {
    return document.body.classList.contains('power-save-mode');
}

// 3. Updated loadWeather to assemble the bilingual location string
async function loadWeather() {
    if (!navigator.geolocation) {
        setCategory('generic');
        renderError(null);
        return;
    }

    renderLoading('locating', null);

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const location = await fetchPreciseLocation(latitude, longitude);
                const regionalLang = location.regionalLang;
                renderLoading('fetching', regionalLang);

                const weatherData = await fetchWeather(latitude, longitude);
                const current = weatherData.current;
                const category = codeToCategory(current.weather_code);
                setCategory(category);
                
                // Assemble the UI stack for the location string
                let locationHtml = `<div style="display: flex; flex-direction: column; line-height: 1.2;">
                                        <span class="wx-en" style="color: #f8fafc;">${location.labelEn}</span>`;
                                        
                if (location.labelRegional && location.labelRegional !== location.labelEn) {
                    const dir = RTL_LANGS.has(regionalLang) ? ' dir="rtl"' : '';
                    locationHtml += `<span class="wx-regional"${dir} style="font-size: 0.75rem; color: var(--ui-accent); opacity: 0.9; font-weight: normal;">${location.labelRegional}</span>`;
                }
                locationHtml += `</div>`;

                renderWeather(current, weatherData.high, weatherData.low, locationHtml, regionalLang);
            } catch (e) {
                setCategory('generic');
                renderError(null);
            }
        },
        () => {
            setCategory('generic');
            renderError(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

export function initWeatherWidget() {
    const els = getEls();
    if (!els.widget) return;
    if (isPowerSave()) return; // Power Saver aesthetics stay untouched.

    if (!canvas) setupCanvas();
    startCanvasLoop();

    if (!weatherInitialized) {
        weatherInitialized = true;
        loadWeather();
        weatherRefreshTimer = setInterval(() => {
            if (!isPowerSave()) loadWeather();
        }, 15 * 60 * 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    initWeatherWidget();

    const powerToggle = document.getElementById('power-save-toggle');
    if (powerToggle) {
        powerToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Switched to Power Saver — stop the animation loop entirely (CSS also hides the canvas).
                stopCanvasLoop();
            } else {
                // Switched back to Normal Mode
                startCanvasLoop();
                initWeatherWidget();
            }
        });
    }
});

// If the app gates the dashboard behind login, initialize once auth is ready too
window.addEventListener('auth-ready', () => {
    initWeatherWidget();
});
