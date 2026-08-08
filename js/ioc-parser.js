// ==========================================
// TCS SOC - FIREBASE INTEL ROUTER & PARSER
// ==========================================
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, getCachedIOC, saveToCache } from "./db-cache.js"; 


// ==========================================
// 🧠 CORE IOC PARSING ENGINE
// ==========================================
function parseInputBlock(rawData) {
    if (!rawData || typeof rawData !== 'string') return [];
    
    const lines = rawData.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
    const parsedIOCs = [];

    const patterns = {
        ip: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i,
        hash: /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/, 
        url: /^https?:\/\/.+/i,
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    };

    const defang = (str) => str.replace(/\[\.\]/g, '.').replace(/\[dot\]/gi, '.').replace(/hxxp/gi, 'http');

    lines.forEach((original, index) => {
        let cleaned = defang(original);
        let type = 'unknown';
        let isValid = false;

        if (patterns.ip.test(cleaned)) { type = 'ip'; isValid = true; }
        else if (patterns.hash.test(cleaned)) { type = 'hash'; isValid = true; }
        else if (patterns.email.test(cleaned)) { type = 'email'; isValid = true; }
        else if (patterns.url.test(cleaned)) { type = 'url'; isValid = true; }
        else if (patterns.domain.test(cleaned)) { type = 'domain'; isValid = true; }

        parsedIOCs.push({
            id: index + 1, original: original, cleaned: cleaned, type: type, isValid: isValid
        });
    });

    return parsedIOCs;
}

// ==========================================
// OPSEC: PRIVATE IP DETECTION
// ==========================================
const isPrivateIP = (ip) => {
    const privateIpRegex = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})$/;
    return privateIpRegex.test(ip);
};

// ==========================================
// 🚀 MAIN EXECUTION PIPELINE
// ==========================================
window.executeAnalysis = async (rawData, forceLive = false, specificIocToForce = null) => {
    const btnAnalyze = document.getElementById('btn-analyze');
    const errorText = document.getElementById('search-error');
    if (errorText) errorText.style.display = "none";

    let parsedDataRaw = parseInputBlock(rawData); 
    
    const uniqueMap = new Map();
    parsedDataRaw.forEach(ioc => {
        const uniqueKey = ioc.isValid ? ioc.cleaned : ioc.original;
        if (!uniqueMap.has(uniqueKey)) uniqueMap.set(uniqueKey, ioc);
    });
    let parsedData = Array.from(uniqueMap.values());

    if (specificIocToForce) {
        parsedData = parsedData.filter(i => i.cleaned === specificIocToForce);
    }

    const safeData = [];
    const blockedIPs = [];

    for (const ioc of parsedData) {
        if (ioc.type === 'ip' && isPrivateIP(ioc.cleaned)) {
            blockedIPs.push(ioc.cleaned);
            continue; 
        }
        safeData.push(ioc);
    }

    if (blockedIPs.length > 0) {
        alert(`🛑 OPSEC ALERT: Internal IPs Detected!\n\n${blockedIPs.join('\n')}\n\nYou are attempting to send private network addresses to external threat feeds. This violates data security policies.\n\nThese IPs have been removed from your scan queue.`);
    }

    parsedData = safeData;

    if (parsedData.length === 0 || parsedData.every(ioc => !ioc.isValid)) {
        if (blockedIPs.length === 0) alert("No valid external IOCs detected. Please check your input format.");
        return;
    }

    if (parsedData.length > 10) {
        alert(`SYSTEM ERROR: Batch limit exceeded. You submitted ${parsedData.length} unique IOCs. The maximum allowed per batch is 10 to protect API quotas.`);
        return;
    }

    if (parsedData.length === 10 && !forceLive) {
        const proceed = confirm("⚠️ QUOTA WARNING: You are about to query the maximum batch size of 10 IOCs. Proceed?");
        if (!proceed) return;
    }

    const DAILY_API_LIMIT = 30;
    const currentAnalystName = sessionStorage.getItem('analyst_name') || "SOC Analyst";
    const userEmailId = window.currentAnalystEmail || "unknown_user";
    const originalBtnHTML = btnAnalyze.innerHTML;
    btnAnalyze.disabled = true;

    try {
        let iocsToFetch = [];
        let cachedResults = [];

        // --- STEP 1: MODULAR CACHE CHECK ---
        btnAnalyze.innerHTML = `<span class="indiv-flicker">CHECKING CACHE...</span>`;
        
        for (const ioc of parsedData) {
            if (!ioc.isValid) {
                cachedResults.push({ original: ioc.original, cleaned: ioc.cleaned, type: 'unknown', isValid: false });
                continue; 
            }
            
            if (forceLive) { 
                iocsToFetch.push(ioc); 
                continue; 
            }

            const safeDocId = btoa(ioc.cleaned).replace(/=/g, ''); 
            const cachedWrapper = await getCachedIOC(safeDocId);

            if (cachedWrapper) {
                let cachedData = cachedWrapper.intel_data;
                cachedData.isCached = true;
                cachedData.checkedBy = cachedWrapper.checkedBy;
                cachedData.cachedAt = cachedWrapper.timestamp || cachedWrapper.cachedAt;
                cachedResults.push(cachedData);
            } else {
                iocsToFetch.push(ioc);
            }
        }

        let freshResults = [];
        
        // --- STEP 2: LIVE FETCH ---
        if (iocsToFetch.length > 0) {
            const analystDocRef = doc(db, "users", userEmailId);
            const analystSnap = await getDoc(analystDocRef);
            const todayString = new Date().toISOString().split('T')[0];
            let dailyChecks = 0;

            if (analystSnap.exists()) {
                const data = analystSnap.data();
                if (data.last_active_date === todayString) dailyChecks = data.daily_checks || 0;
            }

            if (dailyChecks + iocsToFetch.length > DAILY_API_LIMIT) {
                throw new Error(`QUOTA EXCEEDED: You have ${DAILY_API_LIMIT - dailyChecks} live checks remaining today.`);
            }

            for (let i = 0; i < iocsToFetch.length; i++) {
                const currentIoc = iocsToFetch[i];
                btnAnalyze.innerHTML = `<span style="color: #0c016e;">ANALYZING ${i + 1} OF ${iocsToFetch.length}...</span>`;
                
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);

                    const response = await fetch('/api/enrich', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ iocs: [currentIoc] }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        freshResults.push({ ...currentIoc, type: 'unknown', isValid: false, error: `Backend API Error (${response.status})` });
                        continue; 
                    }

                    const data = await response.json();
                    
                    if (data.results && data.results.length > 0) {
                        const res = data.results[0];
                        freshResults.push(res);

                        if (res.isValid && !res.error) {
                            const safeDocId = btoa(res.cleaned).replace(/=/g, '');
                            await saveToCache(safeDocId, res, currentAnalystName);
                        }
                    }

                    if (i < iocsToFetch.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));

                } catch (innerError) {
                    freshResults.push({ ...currentIoc, type: 'unknown', isValid: false, error: `Connection failed or timed out.` });
                }
            }

            // --- STEP 3: BATCH UPDATE DATABASE TRACKERS ---
            await setDoc(analystDocRef, {
                total_checks: increment(freshResults.length),
                daily_checks: dailyChecks + freshResults.length,
                last_active_date: todayString
            }, { merge: true });

            const statsRef = doc(db, "system", "stats");
            await updateDoc(statsRef, { total_checks: increment(freshResults.length) }).catch(async () => {
                await setDoc(statsRef, { total_checks: freshResults.length });
            });
        }

        const finalResults = [...cachedResults, ...freshResults];

        // --- STEP 4: LOG INVESTIGATIONS FOR ANALYTICS ---
        for (const res of finalResults) {
            if (res.cleaned && res.isValid !== false) {
                try {
                    await addDoc(collection(db, "searches"), {
                        ioc: res.cleaned,
                        verdict: res.summary ? res.summary.verdict : "UNKNOWN",
                        analyst: currentAnalystName,
                        timestamp: Date.now(),
                        summary: res.summary ? (res.summary.narrative || res.summary.verdict) : ""
                    });
                } catch (logErr) {
                    console.warn("Analytics logging error:", logErr);
                }
            }
        }

        // Trigger analytics table update
        import('./history-controller.js').then(m => {
            if (m && m.refreshAnalytics) m.refreshAnalytics();
        }).catch(() => {});
        
        // --- STEP 4: INCREMENT SEPARATE SEARCH COUNTERS ---
        for (const res of finalResults) {
            if (res.cleaned && res.isValid !== false) {
                try {
                    const safeDocId = btoa(res.cleaned).replace(/=/g, '');
                    const countRef = doc(db, "search_counts", safeDocId);
                    
                    // This increments the count without messing with your core ioc_cache
                    await setDoc(countRef, {
                        ioc: res.cleaned,
                        count: increment(1),
                        last_searched: Date.now()
                    }, { merge: true });
                } catch (logErr) {
                    console.warn("Analytics counter logging error:", logErr);
                }
            }
        }
        // --- STEP 5: RENDER UI ---
        btnAnalyze.innerHTML = `<span style="color: #4ade80;">RENDERING REPORT...</span>`;
        
        import('./ui-controller.js').then(module => {
            module.renderThreatResults(finalResults);
            if (window.showResultsOverlay) window.showResultsOverlay();
        }).catch(err => {
            console.error("[TRACE] UI Render Error:", err);
            alert("Failed to render the UI module. Check console for details.");
        });

    } catch (error) {
        alert(error.message);
    } finally {
        btnAnalyze.innerHTML = originalBtnHTML;
        btnAnalyze.disabled = false;
    }
};

// ==========================================
// 🎛️ EVENT BINDING & MODAL LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const oldBtn = document.getElementById('btn-analyze');
    if (oldBtn) {
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        newBtn.addEventListener('click', () => {
            const rawData = document.getElementById('ioc-input').value;
            window.executeAnalysis(rawData, false);
        });
    }
});

let pendingRecheckIoc = null;

window.triggerLiveRecheck = (ioc, type) => {
    pendingRecheckIoc = ioc;
    const modal = document.getElementById('recheck-modal');
    if (modal) modal.style.display = 'flex';
};

document.getElementById('btn-cancel-recheck')?.addEventListener('click', () => {
    const modal = document.getElementById('recheck-modal');
    if (modal) modal.style.display = 'none';
    pendingRecheckIoc = null;
});

document.getElementById('btn-confirm-recheck')?.addEventListener('click', () => {
    const modal = document.getElementById('recheck-modal');
    if (modal) modal.style.display = 'none';
    if (pendingRecheckIoc) window.executeAnalysis(pendingRecheckIoc, true, pendingRecheckIoc);
});