// ==========================================
// TCS SOC - FIREBASE AUTH & DATABASE CACHE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, Timestamp, collection, query, where, limit, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD-KHjtm33KZX_S1bgCBzpSQ25pG5f7Lmo",
    authDomain: "ioc-enrich-v2.firebaseapp.com",
    projectId: "ioc-enrich-v2",
    storageBucket: "ioc-enrich-v2.firebasestorage.app",
    messagingSenderId: "519445754169",
    appId: "1:519445754169:web:566e0ddcd9b6475e7bb8e8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app); // Export db for other files to use

// ==========================================
// CACHE CONTROLLERS (24h Lazy Eval + 24h Auto Delete)
// ==========================================
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

export async function getCachedIOC(safeDocId) {
    try {
        const docRef = doc(db, 'ioc_cache', safeDocId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const now = Date.now();
            const cacheTime = data.timestamp || data.cachedAt || 0;
            
            // LAZY EVALUATION: Is it less than 24 hours old?
            if (now - cacheTime < CACHE_TTL_MS) {
                console.log(`[CACHE HIT] Fresh data found for ID: ${safeDocId}`);
                return data; 
            } else {
                console.log(`[CACHE EXPIRED] Data for ${safeDocId} is older than 24h.`);
                return null; 
            }
        }
        return null;
    } catch (error) {
        console.error(`[DB ERROR] Failed to check cache:`, error);
        return null; 
    }
}

export async function saveToCache(safeDocId, intelData, analystName) {
    try {
        const docRef = doc(db, 'ioc_cache', safeDocId);
        
        const now = Date.now();
        // Each IOC's own 24h clock starts the moment IT is cached — not a shared/global expiry.
        const expireDate = new Date(now + CACHE_TTL_MS);

        const payloadToSave = {
            intel_data: intelData,
            checkedBy: analystName,
            timestamp: now,
            cachedAt: now, 
            expireAt: Timestamp.fromDate(expireDate) // For Google's automated TTL policy (enable TTL on 'expireAt' in the Firestore console for server-side purge as a backstop to the client sweep below)
        };

        await setDoc(docRef, payloadToSave);
        console.log(`[CACHE SAVED] Doc ${safeDocId} will auto-delete on ${expireDate.toLocaleString()} (24h TTL).`);
    } catch (error) {
        console.error(`[DB ERROR] Failed to save cache:`, error);
    }
}

// ==========================================
// ACTIVE CACHE CLEANUP (client-side, per-document 24h expiry)
// ==========================================
// Firestore's server-side TTL policy (the 'expireAt' field above) only runs if a TTL
// policy has been enabled on the 'ioc_cache' collection in the Firebase console, and even
// then Google documents it as "usually within 24 hours of expiration", not to-the-minute.
// This active sweep guarantees expired entries get removed promptly regardless of console
// config: each doc carries its own 'timestamp', and anything older than CACHE_TTL_MS from
// its OWN write time is deleted — so every IOC really does get its own independent 24h life.
const CLEANUP_BATCH_SIZE = 200;
const CLEANUP_MAX_BATCHES_PER_RUN = 5; // safety cap so one run can't run away on cost/time
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // sweep hourly while the app is open

let cleanupTimer = null;
let cleanupInFlight = false;

export async function cleanupExpiredIOCCache() {
    if (cleanupInFlight) return; // avoid overlapping sweeps
    cleanupInFlight = true;
    try {
        const cutoff = Date.now() - CACHE_TTL_MS;
        let totalDeleted = 0;

        for (let pass = 0; pass < CLEANUP_MAX_BATCHES_PER_RUN; pass++) {
            const expiredQuery = query(
                collection(db, 'ioc_cache'),
                where('timestamp', '<', cutoff),
                limit(CLEANUP_BATCH_SIZE)
            );
            const snap = await getDocs(expiredQuery);
            if (snap.empty) break;

            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            totalDeleted += snap.size;
            if (snap.size < CLEANUP_BATCH_SIZE) break; // fewer than a full page left = we're caught up
        }

        if (totalDeleted > 0) {
            console.log(`[CACHE CLEANUP] Removed ${totalDeleted} IOC cache entr${totalDeleted === 1 ? 'y' : 'ies'} past their individual 24h TTL.`);
        }
    } catch (error) {
        // Non-fatal: a failed sweep just means the lazy-eval check above keeps ignoring stale
        // docs (so the UI is unaffected), and the next scheduled sweep will retry.
        console.error('[DB ERROR] Cache cleanup sweep failed:', error);
    } finally {
        cleanupInFlight = false;
    }
}

function startCacheCleanupSchedule() {
    cleanupExpiredIOCCache(); // sweep immediately on login
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = setInterval(cleanupExpiredIOCCache, CLEANUP_INTERVAL_MS);
}

function stopCacheCleanupSchedule() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}

// ==========================================
// BROWSER TOKEN & FINGERPRINT RESTRICTION
// ==========================================
const loginGateway = document.getElementById('login-gateway');
const mainDashboard = document.getElementById('main-dashboard'); 
const userGreeting = document.getElementById('user-greeting');

let userStatListener = null;
let globalStatListener = null;

const getDeviceBindingToken = () => {
    let localAnchor = localStorage.getItem('soc_device_anchor');
    if (!localAnchor) {
        localAnchor = window.crypto && window.crypto.randomUUID 
            ? window.crypto.randomUUID() 
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
        localStorage.setItem('soc_device_anchor', localAnchor);
    }
    const nav = window.navigator;
    const screen = window.screen;
    const hardwareProfile = `${nav.userAgent}|${screen.width}x${screen.height}|${nav.hardwareConcurrency}`;
    return btoa(`${localAnchor}|${hardwareProfile}`).replace(/=/g, '').slice(0, 32); 
};

onAuthStateChanged(auth, async (user) => {
    if (user && user.email) {
        const currentToken = getDeviceBindingToken();
        const userEmailId = user.email.toLowerCase(); 
        const userDocRef = doc(db, "users", userEmailId);
        
        try {
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.authorized_token && userData.authorized_token !== currentToken) {
                    alert("🛑 SECURITY ALERT: Unauthorized Workstation Detected.\nThis account is permanently bound to a different hardware fingerprint. Please use your authorized corporate device.");
                    await signOut(auth);
                    return; 
                }
                if (!userData.authorized_token) {
                    await setDoc(userDocRef, { authorized_token: currentToken }, { merge: true });
                }
            } else {
                await setDoc(userDocRef, { 
                    authorized_token: currentToken, 
                    total_checks: 0, 
                    daily_checks: 0, 
                    last_active_date: new Date().toISOString().split('T')[0] 
                }, { merge: true });
            }

            if (loginGateway) loginGateway.style.display = 'none';
            if (mainDashboard) mainDashboard.style.display = 'block';
            
            const emailPrefix = user.email.split('@')[0];
            const formattedName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).replace('.', ' ');
            
            if (userGreeting) userGreeting.innerHTML = `Welcome, <strong>${formattedName}</strong>!`;
            sessionStorage.setItem('analyst_name', formattedName);
            window.currentAnalystEmail = userEmailId; 
            window.dispatchEvent(new Event('auth-ready'));

            startCacheCleanupSchedule();

            userStatListener = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const todayString = new Date().toISOString().split('T')[0];
                    const dailyCount = data.last_active_date === todayString ? (data.daily_checks || 0) : 0;
                    
                    const dailyEl = document.getElementById('daily-checks');
                    if(dailyEl) {
                        dailyEl.textContent = dailyCount;
                        if (dailyCount >= 20) dailyEl.classList.add('critical-quota');
                        else { dailyEl.classList.remove('critical-quota'); dailyEl.style.color = '#4ade80'; }
                    }
                    const totalEl = document.getElementById('total-checks');
                    if(totalEl) totalEl.textContent = data.total_checks || 0;
                }
            });

            globalStatListener = onSnapshot(doc(db, "system", "stats"), (docSnap) => {
                if (docSnap.exists()) {
                    const globalEl = document.getElementById('global-checks');
                    if(globalEl) globalEl.textContent = docSnap.data().total_checks || 0;
                }
            });

        } catch (error) {
            console.error("[AUTH TRACE] Database Error:", error);
            alert("Failed to verify security token. Check your internet connection or contact SOC Management.");
            await signOut(auth);
        }
    } else {
        if (loginGateway) loginGateway.style.display = 'flex';
        if (mainDashboard) mainDashboard.style.display = 'none';
        sessionStorage.removeItem('analyst_name');
        
        if (userStatListener) userStatListener();
        if (globalStatListener) globalStatListener();
        stopCacheCleanupSchedule();
    }
});

document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if (!email || !pass) return;
    try {
        const btn = document.getElementById('btn-login');
        if (btn) btn.textContent = "Authenticating...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        document.getElementById('btn-login').textContent = "Authenticate";
        alert("Access Denied: Invalid credentials.");
    }
});

document.getElementById('btn-logout')?.addEventListener('click', () => signOut(auth));