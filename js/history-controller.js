import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./db-cache.js";
import { getPlainNarrative } from "./ui-controller.js";

let localCacheList = [];

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// 1. Fetch Top 10 Recent Investigations directly from Firestore ioc_cache
export async function loadRecentSearches() {
    const recentContainer = document.getElementById('recent-searches-list');
    if (!recentContainer) return;

    try {
        const q = query(collection(db, "ioc_cache"), orderBy("timestamp", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        localCacheList = [];
        let html = '';

        querySnapshot.forEach(docSnap => {
            const wrapper = docSnap.data();
            const intel = wrapper.intel_data || {};
            const timeAgo = getTimeAgo(wrapper.timestamp || wrapper.cachedAt);
            const verdict = (intel.summary && intel.summary.verdict) ? intel.summary.verdict.toUpperCase() : 'ANALYZED';
            
            let badgeClass = 'verdict-safe';
            if (verdict.includes('MALICIOUS')) badgeClass = 'verdict-malicious';
            else if (verdict.includes('SUSPICIOUS') || verdict.includes('RISK')) badgeClass = 'verdict-suspicious';

            localCacheList.push({
                cleaned: intel.cleaned || wrapper.cleaned || docSnap.id,
                verdict: verdict,
                analyst: wrapper.checkedBy || 'SOC Analyst',
                timeAgo: timeAgo,
                rawIocObject: intel
            });

            html += `
                <div class="history-row">
                    <div class="cell-ioc" title="${intel.cleaned || docSnap.id}">${intel.cleaned || docSnap.id}</div>
                    <div><span class="verdict-tag ${badgeClass}">${verdict}</span></div>
                    <div class="cell-user">${wrapper.checkedBy || 'Analyst'}</div>
                    <div class="cell-time">${timeAgo}</div>
                    <div>
                        <button class="row-copy-btn" data-ioc="${intel.cleaned || docSnap.id}" title="Copy Detailed Summary">Copy</button>
                    </div>
                </div>
            `;
        });

        recentContainer.innerHTML = html || '<div class="table-loading">No cached investigations found in Firestore.</div>';

        // Bind Copy Summary button to exact getPlainNarrative engine
        document.querySelectorAll('.row-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetIoc = e.target.getAttribute('data-ioc');
                const match = localCacheList.find(item => item.cleaned === targetIoc);
                
                if (match && match.rawIocObject) {
                    const fullNarrative = getPlainNarrative(match.rawIocObject);
                    navigator.clipboard.writeText(fullNarrative).then(() => {
                        const origText = e.target.innerText;
                        e.target.innerText = 'Copied!';
                        e.target.style.background = '#4ade80';
                        e.target.style.color = '#000';
                        setTimeout(() => { 
                            e.target.innerText = origText; 
                            e.target.style.background = '';
                            e.target.style.color = '';
                        }, 1800);
                    });
                }
            });
        });

    } catch (err) {
        console.error("Error loading Firestore cache:", err);
        recentContainer.innerHTML = '<div class="table-loading" style="color:#ef4444;">Failed to read ioc_cache.</div>';
    }
}

// 2. Fetch Top Searches from the dedicated search_counts collection
export async function loadTop24hSearches() {
    const topContainer = document.getElementById('top-iocs-list');
    if (!topContainer) return;

    try {
        // Query the new search_counts collection, order by highest count
        const q = query(collection(db, "search_counts"), orderBy("count", "desc"), limit(5));
        const querySnapshot = await getDocs(q);

        let html = '';
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            html += `
                <div class="top-row">
                    <div class="cell-ioc" title="${data.ioc}">${data.ioc}</div>
                    <div class="badge-count">${data.count}</div>
                </div>
            `;
        });

        topContainer.innerHTML = html || '<div class="table-loading">No searches recorded yet.</div>';

    } catch (err) {
        console.error("Error fetching search counts:", err);
        topContainer.innerHTML = '<div class="table-loading" style="color:#ef4444;">Failed to load search trends.</div>';
    }
}

// 3. Copy Entire Table as TSV
function copyTableAsTSV() {
    if (localCacheList.length === 0) return;

    let tsvContent = "IOC Name\tVerdict\tAnalyst\tTime\n";
    localCacheList.forEach(row => {
        tsvContent += `${row.cleaned}\t${row.verdict}\t${row.analyst}\t${row.timeAgo}\n`;
    });

    navigator.clipboard.writeText(tsvContent).then(() => {
        const btn = document.getElementById('btn-copy-recent-tsv');
        if (btn) {
            const origHTML = btn.innerHTML;
            btn.innerHTML = "✅ Copied!";
            setTimeout(() => { btn.innerHTML = origHTML; }, 2000);
        }
    });
}

export function refreshAnalytics() {
    loadRecentSearches();
    loadTop24hSearches();
}

document.addEventListener('DOMContentLoaded', () => {
    refreshAnalytics();
    document.getElementById('btn-refresh-recent')?.addEventListener('click', refreshAnalytics);
    document.getElementById('btn-copy-recent-tsv')?.addEventListener('click', copyTableAsTSV);
});