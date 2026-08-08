// ==========================================
// TCS SOC - UI CONTROLLER MODULE
// ==========================================

// 1. TACTICAL MODE (POWER SAVE) LOGIC
const powerToggle = document.getElementById('power-save-toggle');
const body = document.body;
const toggleLabel = document.querySelector('.toggle-label');
const switchElement = document.querySelector('.switch');

// Helper function to update the text and hover tooltips dynamically
function updateToggleUI(isPowerSave) {
    if (isPowerSave) {
        body.classList.add('power-save-mode');
        if (toggleLabel) toggleLabel.textContent = "⚡ POWER SAVER";
        if (switchElement) switchElement.title = "Click here to switch to Normal mode";
    } else {
        body.classList.remove('power-save-mode');
        if (toggleLabel) toggleLabel.textContent = "⚡ NORMAL MODE";
        if (switchElement) switchElement.title = "Click here to switch to Power Saver mode";
    }
}

// Check browser memory on load to see if they left it on yesterday
if (localStorage.getItem('tacticalMode') === 'true') {
    if (powerToggle) powerToggle.checked = true;
    updateToggleUI(true);
} else {
    // Set the default state text and tooltip on first load
    updateToggleUI(false);
}

if (powerToggle) {
    powerToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            updateToggleUI(true);
            localStorage.setItem('tacticalMode', 'true');
        } else {
            updateToggleUI(false);
            localStorage.setItem('tacticalMode', 'false');
        }
    });
}

// 3. UI OVERLAY NAVIGATION
window.showResultsOverlay = function() {
    const overlay = document.getElementById('results-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.animation = 'fadeIn 0.3s ease-out';
    }
    window.isAnimating = false; // Pause background physics to save CPU
};

window.hideResultsOverlay = function() {
    const overlay = document.getElementById('results-overlay');
    if (overlay) overlay.style.display = 'none';
};

// ==========================================
// TCS SOC - SECURE UI & RESULTS RENDERER (V2)
// ==========================================

// Global state to hold the latest scan for the Copy/Download buttons
let latestScanResults = [];

// 🛡️ SECURITY: Strict HTML Escaping
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(new RegExp('[&<>\'"]', 'g'), tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// 🎨 SYNTAX HIGHLIGHTER for the Telemetry Panel
function syntaxHighlightJSON(jsonObj) {
    let json = JSON.stringify(jsonObj, null, 4);
    json = json.replace(new RegExp('&', 'g'), '&amp;').replace(new RegExp('<', 'g'), '&lt;').replace(new RegExp('>', 'g'), '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// --- NEW V2 TELEMETRY EXTRACTION ENGINES ---

const abuseCategories = {
    3: "Fraud Orders", 4: "DDoS Attack", 9: "Open Proxy", 10: "Web Spam",
    11: "Email Spam", 14: "Port Scan", 15: "Hacking", 18: "Brute-Force",
    19: "Bad Web Bot", 20: "Exploited Host", 21: "Web App Attack", 22: "SSH", 23: "IoT Targeted"
};

function getRelativeTime(dateString) {
    if (!dateString) return "an unknown time";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "recently";
    
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
}

function getFormattedDate(dateString) {
    if (!dateString) return "an unknown date";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "an unknown date";
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function processAbuseIPDBReports(reports) {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return null;
    
    let categoryCounts = {};
    reports.forEach(report => {
        if(report.categories && Array.isArray(report.categories)) {
            report.categories.forEach(catId => {
                const catName = abuseCategories[catId] || `Cat-${catId}`;
                categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
            });
        }
    });

    const topCategories = Object.keys(categoryCounts)
        .sort((a, b) => categoryCounts[b] - categoryCounts[a])
        .slice(0, 4)
        .map(cat => `${cat}(${categoryCounts[cat]})`)
        .join(', ');

    const oldestReport = reports[reports.length - 1];
    const firstDate = getFormattedDate(oldestReport.reportedAt);

    return { topCategories, firstDate };
}

function processOTXPulses(pulses) {
    if (!pulses || !Array.isArray(pulses) || pulses.length === 0) return null;
    
    let tagCounts = {};
    pulses.forEach(pulse => {
        if(pulse.tags && Array.isArray(pulse.tags)) {
            pulse.tags.forEach(tag => {
                const cleanTag = tag.trim().toUpperCase();
                if(cleanTag) {
                    tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
                }
            });
        }
    });

    const topTags = Object.keys(tagCounts)
        .sort((a, b) => tagCounts[b] - tagCounts[a])
        .slice(0, 4)
        .map(tag => `${tag}(${tagCounts[tag]})`)
        .join(', ');

    return topTags;
}

// Time Calculator
function getTimeAgo(timestamp) {
    if (!timestamp) return 'unknown time';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minutes`;
    return `${Math.floor(diffMins / 60)} hours, ${diffMins % 60} minutes`;
}

// Helper: Converts 2-letter ISO codes to Full Country Names
function getFullGeo(ipinfo) {
    if (!ipinfo) return 'Unknown Geo';
    let countryName = ipinfo.country || '';
    try {
        if (countryName.length === 2) {
            countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryName);
        }
    } catch (e) {}
    
    const parts = [];
    if (ipinfo.city) parts.push(ipinfo.city);
    if (ipinfo.region && ipinfo.region !== ipinfo.city) parts.push(ipinfo.region);
    if (countryName) parts.push(countryName);
    
    return parts.length > 0 ? parts.join(', ') : 'Unknown Geo';
}

export function renderThreatResults(resultsArray) {
    latestScanResults = resultsArray;

    const summaryContainer = document.getElementById('summary-content');
    const detailsContainer = document.getElementById('details-content');
    if (summaryContainer) summaryContainer.innerHTML = '';
    if (detailsContainer) detailsContainer.innerHTML = syntaxHighlightJSON(resultsArray);

    let summaryHtml = '';

    resultsArray.forEach(ioc => {
        if (!ioc.isValid && ioc.type === 'unknown') {
            summaryHtml += createBaseCard(ioc.original, 'INVALID FORMAT', '#64748b', 'Cannot route invalid data.', ioc.type);
            return;
        }
        
        if (ioc.error) {
            summaryHtml += createBaseCard(ioc.original, 'SYSTEM ERROR', '#ef4444', ioc.error, ioc.type);
            return;
        }

        const safeTitle = escapeHTML(ioc.cleaned || ioc.original);
        const verdict = escapeHTML(ioc.summary.verdict).toUpperCase();
        const color = ioc.summary.color;
        
        let customBody = '';

        // ==========================================
        // DENSE NARRATIVE TEMPLATE: IP ADDRESS
        // ==========================================
        if (ioc.type === 'ip') {
            const ipinfo = ioc.telemetry.ipinfo || {};
            const abuse = ioc.telemetry.abuseipdb || {};
            const vt = ioc.telemetry.virustotal || {};
            const otx = ioc.telemetry.alienvault_otx || {};
            const abuseCh = ioc.telemetry.abuse_ch || {};

            // 1. Basic VT & Geo
            const safeAsn = (ipinfo.asn && !(ipinfo.isp || '').includes(ipinfo.asn)) ? `${ipinfo.asn} ` : '';
            const ispGeo = escapeHTML(`${safeAsn}${ipinfo.isp || 'Unknown ISP'}, ${getFullGeo(ipinfo)}`).trim(); const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
            const vtColor = vt.malicious > 0 ? '#ef4444' : '#4ade80';
            
            // 2. AbuseIPDB Parsing
            const abuseScore = abuse.score || 0;
            const abuseColor = abuseScore > 0 ? '#fbbf24' : '#4ade80';
            let abuseDetailsStr = '';
            
            if (abuse.totalReports > 0 && abuse.reports) {
                const reportData = processAbuseIPDBReports(abuse.reports);
                const lastRep = getRelativeTime(abuse.lastReportedAt);
                if (reportData && reportData.topCategories) {
                    abuseDetailsStr = `This IP address has been reported a total of <strong style="color:#fbbf24">${abuse.totalReports}</strong> times with the top reported categories being <strong style="color:#ef4444">[ ${escapeHTML(reportData.topCategories)} ]</strong> from <strong>${abuse.numDistinctUsers || 'multiple'}</strong> distinct sources. <strong style="color:#e2e8f0">${safeTitle}</strong> was first reported on <strong>${reportData.firstDate}</strong>, and the most recent report was <strong>${lastRep}</strong>.`;
                }
            }
            if (!abuseDetailsStr) { 
                const usageType = escapeHTML(abuse.usageType || 'Unknown Usage Type');
                abuseDetailsStr = `This IP address has <strong>${abuse.totalReports || 0}</strong> reports in AbuseIPDB with the usage category type of "<strong>${usageType}</strong>" and indicates no recent malicious community reporting.`;
            }

            // 3. OTX Parsing
            const otxCount = otx.related_pulses || 0;
            const otxColor = otxCount > 0 ? '#fbbf24' : '#94a3b8';
            let otxDetailsStr = `Intelligence correlates this IP to <strong style="color:${otxColor}">${otxCount} AlienVault OTX pulses</strong>`;
            
            if (otxCount > 0) {
                let tagsFormatted = '';
                if (otx.pulses) { 
                    tagsFormatted = processOTXPulses(otx.pulses);
                } else if (otx.tags && otx.tags.length > 0) { 
                    tagsFormatted = escapeHTML(otx.tags.slice(0, 4).join(', '));
                }
                
                if (tagsFormatted) {
                    otxDetailsStr += `. The primary threat tags associated with this infrastructure are <strong style="color:#fbbf24">[ ${escapeHTML(tagsFormatted)} ]</strong>.`;
                } else {
                    otxDetailsStr += ` with no specific threat tags identified.`;
                }
            } else {
                otxDetailsStr += `.`;
            }

            // 4. Abuse.ch Payload Parsing
            let payloadStr = `Threat feeds indicate <strong>no associated payloads</strong> in Abuse.ch.`;
            if (abuseCh.payloads && abuseCh.payloads.length > 0) {
                const pCount = abuseCh.payloads.length;
                const families = escapeHTML(abuseCh.payloads.slice(0, 3).join(', '));
                payloadStr = `Threat feeds indicate <strong style="color:#ef4444">${pCount} associated payloads</strong> in Abuse.ch, primarily linked to <strong style="color:#ef4444">[ ${families} ]</strong>.`;
            }

            // 5. VT Domains Parsing
            let domainsStr = `recently resolved to <strong style="color:#94a3b8">no known domains</strong>`;
            if (vt.last_dns_records && vt.last_dns_records.length > 0) {
                const dCount = vt.last_dns_records.length;
                const topD = escapeHTML(vt.last_dns_records.slice(0, 3).map(r => r.value).join(', '));
                domainsStr = `recently resolved to <strong>${dCount}</strong> domains including "<strong>${topD}</strong>"`;
            }
            domainsStr = `associated with the primary domain "<strong style="color:#e2e8f0">${escapeHTML(abuse.domain)}</strong>"`;
            

            // Combine into the Dense Narrative Block
            customBody = `
                <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: rgba(0,0,0,0.2); padding: 15px; border-left: 2px solid #38bdf8; border-radius: 4px;">
                    <p style="margin-top: 0; margin-bottom: 10px;">Remote IP "<strong style="color:#e2e8f0">${safeTitle}</strong>" belongs to "<strong style="color:#38bdf8">${ispGeo}</strong>" having a community score of "<strong style="color:${vtColor}">${vt.malicious || 0}/${vtTotal}</strong>" in VirusTotal, and an Abuse Score of "<strong style="color:${abuseColor}">${abuseScore}</strong>".</p>
                    
                    <p style="margin-top: 0; margin-bottom: 10px;">${abuseDetailsStr}</p>
                    
                    <p style="margin-top: 0; margin-bottom: 10px;">${otxDetailsStr}</p>
                    
                    <p style="margin-top: 0; margin-bottom: 0;">${payloadStr} Historical data shows this IP ${domainsStr}.</p>
                </div>
            `;
        } 
        
        // ==========================================
        // DENSE NARRATIVE TEMPLATE: DOMAIN
        // ==========================================
        else if (ioc.type === 'domain') {
            const vt = ioc.telemetry.virustotal || {};
            const otx = ioc.telemetry.alienvault_otx || {};
            const urlhaus = ioc.telemetry.urlhaus || {};

            const category = escapeHTML(Object.values(vt.categories || {})[0] || 'Uncategorized');
            const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
            const vtColor = vt.malicious > 0 ? '#ef4444' : '#4ade80';
            
            const otxCount = otx.related_pulses || 0;
            const otxTagsText = otx.tags && otx.tags.length > 0 ? ` (Tagged: <em>${escapeHTML(otx.tags.join(', '))}</em>)` : '';
            
            let malwareText = "no associated malicious payloads in URLhaus";
            if (urlhaus.threat || (urlhaus.payloads && urlhaus.payloads.length > 0)) {
                const threatName = urlhaus.threat || 'malware delivery';
                malwareText = `<span style="color:#ef4444">active associations with <strong>${escapeHTML(threatName)}</strong> payloads</span>`;
            }

            const resolvingIpsList = vt.last_dns_records && vt.last_dns_records.length > 0 
                ? escapeHTML(vt.last_dns_records.slice(0, 3).map(r => r.value).join(', ')) 
                : 'unknown or hidden infrastructure';

            customBody = `
                <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: rgba(0,0,0,0.2); padding: 15px; border-left: 2px solid #8b5cf6; border-radius: 4px;">
                    Domain "<strong style="color:#e2e8f0">${safeTitle}</strong>" is currently categorized as "<strong style="color:#8b5cf6">${category}</strong>" 
                    with a community threat score of "<strong style="color:${vtColor}">${vt.malicious || 0}/${vtTotal}</strong>" in VirusTotal. 
                    Intelligence correlates this domain to <strong style="color:${otxCount > 0 ? '#fbbf24' : '#94a3b8'}">${otxCount} AlienVault OTX pulses</strong>${otxTagsText} 
                    and indicates <strong>${malwareText}</strong>.
                    Historically, this domain resolves to <strong>${resolvingIpsList}</strong> and ${vt.malicious > 0 ? '<span style="color:#ef4444">is actively flagged by multiple security vendors for suspicious activity</span>' : '<span style="color:#4ade80">shows no recent associations with active phishing or malware campaigns</span>'}.
                </div>
            `;
        }

        // ==========================================
        // DENSE NARRATIVE TEMPLATES: HASH, URL, EMAIL
        // ==========================================
        else if (ioc.type === 'hash') {
            const vt = ioc.telemetry.virustotal || {};
            const mb = ioc.telemetry.malwarebazaar || {};
            const otx = ioc.telemetry.alienvault_otx || {};

            let fileName = 'Unknown File Name';
            if (vt.names && Array.isArray(vt.names) && vt.names.length > 0) fileName = vt.names[0];
            else if (typeof vt.names === 'string') fileName = vt.names;
            
            const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
            const otxCount = otx.related_pulses || 0;
            const otxTagsText = otx.tags && otx.tags.length > 0 ? ` (Tagged: <em>${escapeHTML(otx.tags.join(', '))}</em>)` : '';
            
            let sigText = "no known malware signatures in MalwareBazaar";
            if (mb.signature && mb.signature !== 'None') {
                sigText = `an active malware signature of "<strong style="color:#ef4444">${escapeHTML(mb.signature)}</strong>" in MalwareBazaar`;
            }

            let tagsText = "no associated behavioral threat tags";
            if (mb.tags && mb.tags.length > 0) {
                tagsText = `associated behavioral threat tags [<strong>${escapeHTML(mb.tags.join(', '))}</strong>]`;
            }

            customBody = `
                <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: rgba(0,0,0,0.2); padding: 15px; border-left: 2px solid #fbbf24; border-radius: 4px;">
                    File Hash "<strong style="color:#e2e8f0; word-break: break-all;">${safeTitle}</strong>" (identified in the wild as "<strong style="color:#fbbf24">${escapeHTML(fileName)}</strong>") 
                    has a community threat score of "<strong style="color:${vt.malicious > 0 ? '#ef4444' : '#4ade80'}">${vt.malicious || 0}/${vtTotal}</strong>" in VirusTotal. 
                    Intelligence correlates this hash to <strong style="color:${otxCount > 0 ? '#fbbf24' : '#94a3b8'}">${otxCount} AlienVault OTX pulses</strong>${otxTagsText} 
                    and indicates <strong>${sigText}</strong>.
                    Analysis shows <strong>${tagsText}</strong>, and the file ${vt.malicious > 0 ? '<span style="color:#ef4444">is actively flagged by multiple security vendors as a high-confidence threat payload</span>' : '<span style="color:#4ade80">is not currently linked to any active threat actor campaigns or malicious payloads</span>'}.
                </div>
            `;
        }
        else if (ioc.type === 'url') {
            const vt = ioc.telemetry.virustotal || {};
            const otx = ioc.telemetry.alienvault_otx || {};
            const uh = ioc.telemetry.urlhaus || {};

            const urlStatus = uh.status ? escapeHTML(uh.status.toLowerCase()) : 'unknown status';
            const threatType = escapeHTML(uh.threat || 'Uncategorized');
            const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
            const otxCount = otx.related_pulses || 0;
            const otxTagsText = otx.tags && otx.tags.length > 0 ? ` (Tagged: <em>${escapeHTML(otx.tags.join(', '))}</em>)` : '';
            
            let payloadText = "no known payload delivery mechanisms";
            if (uh.payloads && uh.payloads.length > 0) {
                payloadText = `direct distribution of <strong style="color:#ef4444">${escapeHTML(uh.payloads.join(', '))}</strong> payloads`;
            }

            customBody = `
                <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: rgba(0,0,0,0.2); padding: 15px; border-left: 2px solid #ec4899; border-radius: 4px;">
                    Target URL "<strong style="color:#e2e8f0; word-break: break-all;">${safeTitle}</strong>" is currently observed as "<strong style="color:${urlStatus === 'online' ? '#ef4444' : '#94a3b8'}">${urlStatus}</strong>" 
                    and categorized as "<strong style="color:#ec4899">${threatType}</strong>" with a community threat score of "<strong style="color:${vt.malicious > 0 ? '#ef4444' : '#4ade80'}">${vt.malicious || 0}/${vtTotal}</strong>" in VirusTotal. 
                    Intelligence correlates this URL to <strong style="color:${otxCount > 0 ? '#fbbf24' : '#94a3b8'}">${otxCount} AlienVault OTX pulses</strong>${otxTagsText} 
                    and indicates <strong>${payloadText}</strong>.
                    ${vt.malicious > 0 || urlStatus === 'online' ? '<span style="color:#ef4444">This endpoint is actively flagged for suspicious behavior and should be blocked at the perimeter/proxy level.</span>' : '<span style="color:#4ade80">This endpoint shows no recent malicious activity or active payload distribution.</span>'}
                </div>
            `;
        }
        else if (ioc.type === 'email') {
            const vt = ioc.telemetry.virustotal || {};
            const otx = ioc.telemetry.alienvault_otx || {};
            const rep = ioc.telemetry.emailrep || {};

            const reputation = rep.reputation ? escapeHTML(rep.reputation.toLowerCase()) : 'unknown';
            const repColor = reputation === 'high' ? '#4ade80' : (reputation === 'low' || reputation === 'none' ? '#ef4444' : '#fbbf24');
            const isBlacklisted = rep.blacklisted === true;
            const blacklistColor = isBlacklisted ? '#ef4444' : '#4ade80';
            const blacklistText = isBlacklisted ? 'actively blacklisted' : 'not blacklisted';
            const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
            const otxCount = otx.related_pulses || 0;
            const otxTagsText = otx.tags && otx.tags.length > 0 ? ` (Tagged: <em>${escapeHTML(otx.tags.join(', '))}</em>)` : '';
            
            let contextText = "shows no recent involvement in data breaches or suspicious credential leaks.";
            if (rep.suspicious || isBlacklisted || vt.malicious > 0) {
              contextText = `<span style="color:#ef4444">exhibits highly suspicious behavior and is frequently associated with phishing campaigns, spam distribution, or credential harvesting.</span>`;
            } else if (rep.credentials_leaked) {
                contextText = `<span style="color:#fbbf24">has been identified in historical data breaches and credential leaks, increasing its risk profile for account takeover (ATO).</span>`;
            }

            customBody = `
                <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: rgba(0,0,0,0.2); padding: 15px; border-left: 2px solid #14b8a6; border-radius: 4px;">
                    Target Email "<strong style="color:#e2e8f0; word-break: break-all;">${safeTitle}</strong>" maintains a "<strong style="color:${repColor}">${reputation}</strong>" sender reputation profile 
                    and is currently <strong style="color:${blacklistColor}">${blacklistText}</strong> across global threat registries.
                    Intelligence correlates this address to <strong style="color:${otxCount > 0 ? '#fbbf24' : '#94a3b8'}">${otxCount} AlienVault OTX pulses</strong>${otxTagsText} 
                    and indicates a community threat score of "<strong style="color:${vt.malicious > 0 ? '#ef4444' : '#4ade80'}">${vt.malicious || 0}/${vtTotal}</strong>" in VirusTotal. 
                    Analysis indicates this address <strong>${contextText}</strong>
                </div>
            `;
        }

        // ⚠️ GENERATE CACHE WARNING BANNER
        let cacheBannerHtml = '';
        if (ioc.isCached) {
            const timeAgo = getTimeAgo(ioc.cachedAt);
            cacheBannerHtml = `
                <div class="cache-banner">
                    <div><span style="color:#fbbf24">⚠️ CACHED:</span> Analyzed by <strong>${escapeHTML(ioc.checkedBy || 'System')}</strong> ${timeAgo} ago.</div>
                    <button class="btn-recheck" onclick="window.triggerLiveRecheck('${escapeHTML(ioc.cleaned)}', '${escapeHTML(ioc.type)}')">LIVE RECHECK</button>
                </div>
            `;
        }

        // Build the final card
        summaryHtml += `
            <div class="threat-card" style="border-left: 4px solid ${color}; margin-bottom: 15px; background: rgba(15, 23, 42, 0.6); padding: 15px; border-radius: 4px; border-top: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
                ${cacheBannerHtml}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <strong style="font-family: 'Share Tech Mono', monospace; font-size: 1.2rem; color: #e2e8f0; word-break: break-all;">${safeTitle}</strong>
                    <span style="background: ${color}20; color: ${color}; padding: 4px 10px; border-radius: 3px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${color}40; text-shadow: 0 0 5px ${color};">
                        ${verdict}
                    </span>
                </div>
                <div style="font-size: 0.75rem; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">/// TYPE: ${escapeHTML(ioc.type)}</div>
                ${customBody}
            </div>
        `;
    });

    if (summaryContainer) summaryContainer.innerHTML = summaryHtml;
}

function createBaseCard(title, verdict, color, details, type) {
    return `
        <div class="threat-card" style="border-left: 4px solid ${color}; margin-bottom: 15px; background: rgba(15, 23, 42, 0.6); padding: 15px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #e2e8f0; word-break: break-all;">${escapeHTML(title)}</strong>
                <span style="background: ${color}20; color: ${color}; padding: 3px 8px; border-radius: 3px; font-size: 0.8rem; border: 1px solid ${color}40;">${escapeHTML(verdict)}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8;">${escapeHTML(details)}</div>
        </div>
    `;
}

// Update the CSS required for the new Grid Layouts dynamically
const style = document.createElement('style');
style.innerHTML = `
    .grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; color: #cbd5e1; font-family: monospace; }
    .grid-stats .lbl { color: #64748b; margin-right: 5px; }
`;
document.head.appendChild(style);

// ==========================================
// 6. EVENT LISTENERS
// ==========================================

// "New Search" Button logic
const btnNewSearchEl = document.getElementById('btn-new-search');
if (btnNewSearchEl) {
    btnNewSearchEl.addEventListener('click', () => {
        window.hideResultsOverlay();
        const inputArea = document.getElementById('ioc-input');
        if (inputArea) inputArea.value = ''; // Clear the text area
    });
}

// Grep/Search filter for the raw telemetry text
const grepInput = document.getElementById('telemetry-search');
if (grepInput) {
    grepInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const detailsContainer = document.getElementById('details-content');
        
        if (!detailsContainer) return;

        if (searchTerm === '') {
            // Restore original if empty
            detailsContainer.innerHTML = detailsContainer.textContent; 
        } else {
            const regex = new RegExp(searchTerm, 'gi');
            const originalText = detailsContainer.textContent;
            detailsContainer.innerHTML = originalText.replace(regex, match => `<span style="background: #ef4444; color: white;">${match}</span>`);
        }
    });
}

// ==========================================
// EXPORT ENGINES (COPY & DOWNLOAD) - EXACT DENSE FORMAT
// ==========================================

// 📋 NARRATIVE GENERATOR
export function getPlainNarrative(ioc) {
    if (!ioc.isValid) return `[${ioc.original}] - INVALID FORMAT`;
    if (ioc.error) return `[${ioc.original}] - SYSTEM ERROR: ${ioc.error}`;

    const { type, telemetry } = ioc;

    if (type === 'ip') {
        const abuse = telemetry.abuseipdb || {};
        const vt = telemetry.virustotal || {};
        const otx = telemetry.alienvault_otx || {};
        const info = telemetry.ipinfo || {};
        const abuseCh = telemetry.abuse_ch || {};

        /* --- PARAGRAPH 1: Core Intel --- */
                const ispParts = [];
        const asn = info.asn || '';
        const ispOrOrg = info.isp || info.org || '';

        // 1. Only push the ASN if the ISP string doesn't already contain it
        if (asn && !ispOrOrg.includes(asn)) {
            ispParts.push(asn);
        }

        // 2. Push the ISP/Org (or a fallback if both are missing)
        if (ispOrOrg) {
            ispParts.push(ispOrOrg);
        } else if (!asn) {
            ispParts.push('Unknown ISP');
        }

        // 3. Push geographical data
        if (info.city) ispParts.push(info.city);
        if (info.country) ispParts.push(info.country);

        // 4. Use a Set to instantly filter out any exact duplicates, then join cleanly
        const ispGeo = [...new Set(ispParts)].join(', ').trim();

        // 5. Calculate VirusTotal stats and build the final paragraph
        const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
        const vtStats = `${vt.malicious || 0}/${vtTotal}`;

        const p1 = `Remote IP "${ioc.cleaned}" belongs to "${ispGeo}" having a community score of "${vtStats}" in VirusTotal, and an Abuse Score of "${abuse.score || 0}".`;
                /* --- PARAGRAPH 2: AbuseIPDB Details --- */
        let p2 = `This IP address has ${abuse.totalReports || 0} reports in AbuseIPDB and indicates no recent malicious community reporting.`;
        if (abuse.totalReports > 0 && abuse.reports) {
            const repData = processAbuseIPDBReports(abuse.reports);
            const lastRep = getRelativeTime(abuse.lastReportedAt);
            if (repData && repData.topCategories) {
                p2 = `This IP address has been reported a total of ${abuse.totalReports} times with the top reported categories being [ ${repData.topCategories} ] from ${abuse.numDistinctUsers || 'multiple'} distinct sources. ${ioc.cleaned} was first reported on ${repData.firstDate}, and the most recent report was ${lastRep}.`;
            }
        }

        /* --- PARAGRAPH 3: OTX Details --- */
        const otxCount = otx.related_pulses || 0;
        let p3 = `Intelligence correlates this IP to ${otxCount} AlienVault OTX pulses.`;
        if (otxCount > 0) {
            let tags = null;
            if (otx.pulses) {
                tags = processOTXPulses(otx.pulses);
            } else if (otx.tags && otx.tags.length > 0) {
                tags = otx.tags.slice(0, 4).join(', ');
            }

            if (tags) p3 += ` The primary threat tags associated with this infrastructure are [ ${tags} ].`;
            else p3 += ` with no specific threat tags identified.`;
        }

        /* --- PARAGRAPH 4: Payload & Domains --- */
        let payloadStr = `Threat feeds indicate no associated payloads in Abuse.ch.`;
        if (abuseCh.payloads && abuseCh.payloads.length > 0) {
            const pCount = abuseCh.payloads.length;
            const families = abuseCh.payloads.slice(0, 3).join(', ');
            payloadStr = `Threat feeds indicate ${pCount} associated payloads in Abuse.ch, primarily linked to [ ${families} ].`;
        }

        let domainsStr = `recently resolved to no known domains.`;
        if (vt.last_dns_records && vt.last_dns_records.length > 0) {
            const dCount = vt.last_dns_records.length;
            const topD = vt.last_dns_records.slice(0, 3).map(r => r.value).join(', ');
            domainsStr = `recently resolved to ${dCount} domains including "${topD}".`;
        } else if (abuse.domain) {
            domainsStr = `associated with the primary domain "${abuse.domain}".`;
        }
        
        const p4 = `${payloadStr} Historical data shows this IP ${domainsStr}`;

        // Return the 4-paragraph structure broken by single newlines
        return `${p1}\n${p2}\n${p3}\n${p4}`;
    }

    if (type === 'domain') {
        const vt = telemetry.virustotal || {};
        const otx = telemetry.alienvault_otx || {};
        const vtRes = `${vt.malicious || 0}/${(vt.malicious || 0) + (vt.harmless || 0) + 15}`;
        const cat = Object.values(vt.categories || {})[0] || 'Uncategorized';

        return `Domain "${ioc.cleaned}" is categorized as "${cat}" (VT Score: ${vtRes}).\nOTX indicates ${otx.related_pulses || 0} associated pulses.`;
    }

    if (type === 'hash') {
        const vt = telemetry.virustotal || {};
        const mb = telemetry.malwarebazaar || {};
        const vtRes = `${vt.malicious || 0}/${(vt.malicious || 0) + (vt.harmless || 0) + 15}`;
        const name = (Array.isArray(vt.names) ? vt.names[0] : vt.names) || 'Unknown File Name';

        return `Hash "${ioc.cleaned}" ("${name}") has a VT score of "${vtRes}".\nMalwareBazaar Signature: ${mb.signature || 'None detected'}.`;
    }

    if (type === 'url') {
        const uh = telemetry.urlhaus || {};
        const vt = telemetry.virustotal || {};
        const vtTotal = (vt.malicious || 0) + (vt.harmless || 0) + 15;
        return `URL "${ioc.cleaned}" is observed as "${uh.status || 'unknown'}" with a VT score of "${vt.malicious || 0}/${vtTotal}".\nThreat Type: ${uh.threat || 'Uncategorized'}.`;
    }

    if (type === 'email') {
        const rep = telemetry.emailrep || {};
        return `Email "${ioc.cleaned}" has a "${rep.reputation || 'unknown'}" reputation.\nBlacklisted: ${rep.blacklisted ? 'YES' : 'NO'}.`;
    }

    return `[${ioc.cleaned}] - ${ioc.summary.verdict.toUpperCase()}`;
}
// 💾 FULL REPORT GENERATOR
function generateFullReport() {
    if (typeof latestScanResults === 'undefined' || latestScanResults.length === 0) return "No data to export.";
    
    const analyst = sessionStorage.getItem('analyst_name') || 'SOC Analyst';
    let text = `=========================================\n`;
    text += `TCS SOC - THREAT INTELLIGENCE SUMMARY\n`;
    text += `Analyst: ${analyst}\n`;
    text += `Date: ${new Date().toLocaleString()}\n`;
    text += `=========================================\n\n`;

    latestScanResults.forEach(ioc => {
        text += `IDENTIFIER: ${ioc.cleaned} (${ioc.type.toUpperCase()})\n`;
        text += `VERDICT: ${ioc.summary.verdict.toUpperCase()}\n\n`;
        text += `NARRATIVE:\n${getPlainNarrative(ioc)}\n`;
        text += `\n-----------------------------------------\n\n`;
    });

    text += `=========================================\n`;
    text += `RAW TELEMETRY DUMP\n`;
    text += `=========================================\n`;
    text += JSON.stringify(latestScanResults, null, 4);

    text += `\n\n=========================================\n`;
    text += `Designed and Developed by Sivanjaneyulu Tungala\n`;
    text += `=========================================\n`;

    return text;
}

// 🚀 EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    const btnCopy = document.getElementById('btn-copy-summary');
    const btnDownload = document.getElementById('btn-download-txt');

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (typeof latestScanResults === 'undefined' || latestScanResults.length === 0) return;
            
            // Map the narratives and join them if multiple IOCs are scanned
            const narratives = latestScanResults.map(ioc => getPlainNarrative(ioc)).join('\n\n---\n\n');
            
            navigator.clipboard.writeText(narratives).then(() => {
                const originalText = btnCopy.textContent;
                btnCopy.textContent = "COPIED!";
                btnCopy.style.background = "#4ade80";
                btnCopy.style.color = "#000";
                setTimeout(() => {
                    btnCopy.textContent = originalText;
                    btnCopy.style.background = "";
                    btnCopy.style.color = "";
                }, 2000);
            });
        });
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            const content = generateFullReport();
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SOC_Report_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});

