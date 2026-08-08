import os
import asyncio
import base64
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI(title="TCS SOC Threat Intelligence API")

# Enable CORS for Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to fetch environment variables dynamically from Vercel
def get_env_key(key_name: str) -> str:
    return os.environ.get(key_name, "").strip()

# --- Pydantic Request Models ---
class IOCItem(BaseModel):
    id: Optional[int] = None
    original: str
    cleaned: str
    type: str
    isValid: bool = True

class EnrichRequest(BaseModel):
    iocs: List[IOCItem]


# --- Helper: Safe Async HTTP Request ---
async def safe_fetch(
    client: httpx.AsyncClient, 
    url: str, 
    headers: Optional[Dict[str, str]] = None, 
    method: str = "GET", 
    data: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    try:
        req_headers = {k: v for k, v in (headers or {}).items() if v}
        if method.upper() == "POST":
            response = await client.post(url, headers=req_headers, data=data, timeout=12.0)
        else:
            response = await client.get(url, headers=req_headers, timeout=12.0)
            
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None


# --- Core Enrichment Engine ---
async def enrich_single_ioc(ioc: IOCItem, client: httpx.AsyncClient) -> Dict[str, Any]:
    enriched_data = {
        "id": ioc.id,
        "original": ioc.original,
        "cleaned": ioc.cleaned,
        "isValid": ioc.isValid,
        "type": ioc.type,
        "telemetry": {},
        "summary": {"score": 0, "verdict": "Unknown / Unseen", "color": "#94a3b8"}
    }

    if not ioc.isValid:
        return enriched_data

    # Fetch live Vercel keys at runtime
    vt_key = get_env_key("VIRUSTOTAL_API_KEY")
    abuse_key = get_env_key("ABUSEIPDB_API_KEY")
    ipinfo_key = get_env_key("IPINFO_API_KEY")
    otx_key = get_env_key("OTX_API_KEY")
    emailrep_key = get_env_key("EMAILREP_API_KEY")

    ioc_type = ioc.type.lower()
    cleaned = ioc.cleaned

    try:
        # ==========================================
        # 🌐 IP ADDRESS ROUTE
        # ==========================================
        if ioc_type == "ip":
            abuse_headers = {"Key": abuse_key, "Accept": "application/json"} if abuse_key else {}
            vt_headers = {"x-apikey": vt_key} if vt_key else {}
            otx_headers = {"X-OTX-API-KEY": otx_key} if otx_key else {}

            abuse_url = f"https://api.abuseipdb.com/api/v2/check?ipAddress={cleaned}&maxAgeInDays=90&verbose=true"
            ipinfo_url = f"https://ipinfo.io/{cleaned}/json" + (f"?token={ipinfo_key}" if ipinfo_key else "")
            vt_url = f"https://www.virustotal.com/api/v3/ip_addresses/{cleaned}"
            otx_url = f"https://otx.alienvault.com/api/v1/indicators/IPv4/{cleaned}/general"

            abuse_res, ipinfo_res, vt_res, otx_res = await asyncio.gather(
                safe_fetch(client, abuse_url, headers=abuse_headers),
                safe_fetch(client, ipinfo_url),
                safe_fetch(client, vt_url, headers=vt_headers),
                safe_fetch(client, otx_url, headers=otx_headers) if otx_key else asyncio.sleep(0)
            )

            abuse_data = abuse_res.get("data", {}) if abuse_res else {}
            abuse_score = abuse_data.get("abuseConfidenceScore", 0)

            vt_attr = vt_res.get("data", {}).get("attributes", {}) if vt_res else {}
            vt_stats = vt_attr.get("last_analysis_stats", {})
            vt_malicious = vt_stats.get("malicious", 0)

            otx_pulses = otx_res.get("pulse_info", {}).get("count", 0) if otx_res else 0

            enriched_data["telemetry"] = {
                "ipinfo": {
                    "isp": ipinfo_res.get("org") or ipinfo_res.get("isp"),
                    "country": ipinfo_res.get("country"),
                    "asn": ipinfo_res.get("asn", {}).get("asn") if isinstance(ipinfo_res.get("asn"), dict) else ipinfo_res.get("org"),
                    "city": ipinfo_res.get("city"),
                    "region": ipinfo_res.get("region")
                } if ipinfo_res else "No match found in IPinfo",

                "abuseipdb": {
                    "score": abuse_score,
                    "totalReports": abuse_data.get("totalReports", 0),
                    "usageType": abuse_data.get("usageType", "Unknown"),
                    "numDistinctUsers": abuse_data.get("numDistinctUsers", 0),
                    "reports": abuse_data.get("reports", []),
                    "lastReportedAt": abuse_data.get("lastReportedAt"),
                    "domain": abuse_data.get("domain")
                } if abuse_res else "No match found in AbuseIPDB",

                "virustotal": {
                    "malicious": vt_malicious,
                    "harmless": vt_stats.get("harmless", 0),
                    "last_dns_records": vt_attr.get("last_dns_records", [])
                } if vt_res else "No match found in VirusTotal",

                "alienvault_otx": {
                    "related_pulses": otx_pulses,
                    "pulses": otx_res.get("pulse_info", {}).get("pulses", [])
                } if otx_res and otx_pulses > 0 else "No match found in AlienVault OTX"
            }

            if abuse_score > 0 or vt_malicious > 0 or otx_pulses > 0:
                enriched_data["summary"] = {
                    "score": max(abuse_score, 100 if vt_malicious > 0 else 0),
                    "verdict": "Malicious / Suspicious",
                    "color": "#ef4444"
                }
            elif vt_stats.get("harmless", 0) > 10:
                enriched_data["summary"] = {
                    "score": 0,
                    "verdict": "Likely Clean / Whitelisted",
                    "color": "#4ade80"
                }

        # ==========================================
        # 🌍 DOMAIN ROUTE
        # ==========================================
        elif ioc_type == "domain":
            vt_headers = {"x-apikey": vt_key} if vt_key else {}
            otx_headers = {"X-OTX-API-KEY": otx_key} if otx_key else {}

            vt_url = f"https://www.virustotal.com/api/v3/domains/{cleaned}"
            otx_url = f"https://otx.alienvault.com/api/v1/indicators/domain/{cleaned}/general"

            vt_res, otx_res = await asyncio.gather(
                safe_fetch(client, vt_url, headers=vt_headers),
                safe_fetch(client, otx_url, headers=otx_headers) if otx_key else asyncio.sleep(0)
            )

            vt_attr = vt_res.get("data", {}).get("attributes", {}) if vt_res else {}
            vt_stats = vt_attr.get("last_analysis_stats", {})
            vt_malicious = vt_stats.get("malicious", 0)
            otx_pulses = otx_res.get("pulse_info", {}).get("count", 0) if otx_res else 0

            enriched_data["telemetry"] = {
                "virustotal": {
                    "malicious": vt_malicious,
                    "categories": vt_attr.get("categories", {})
                } if vt_res else "No match found in VirusTotal",

                "alienvault_otx": {
                    "related_pulses": otx_pulses,
                    "pulses": otx_res.get("pulse_info", {}).get("pulses", [])
                } if otx_res and otx_pulses > 0 else "No match found in AlienVault OTX"
            }

            if vt_malicious > 0 or otx_pulses > 0:
                enriched_data["summary"] = {"score": 100, "verdict": "Malicious", "color": "#ef4444"}
            elif vt_stats.get("harmless", 0) > 5:
                enriched_data["summary"] = {"score": 0, "verdict": "Known Benign", "color": "#4ade80"}

        # ==========================================
        # 🧩 HASH ROUTE (MD5/SHA)
        # ==========================================
        elif ioc_type == "hash":
            vt_headers = {"x-apikey": vt_key} if vt_key else {}
            otx_headers = {"X-OTX-API-KEY": otx_key} if otx_key else {}

            mb_data = {"query": "get_info", "hash": cleaned}
            mb_url = "https://mb-api.abuse.ch/api/v1/"
            vt_url = f"https://www.virustotal.com/api/v3/files/{cleaned}"
            otx_url = f"https://otx.alienvault.com/api/v1/indicators/file/{cleaned}/general"

            mb_res, vt_res, otx_res = await asyncio.gather(
                safe_fetch(client, mb_url, method="POST", data=mb_data),
                safe_fetch(client, vt_url, headers=vt_headers),
                safe_fetch(client, otx_url, headers=otx_headers) if otx_key else asyncio.sleep(0)
            )

            is_mb_found = mb_res.get("query_status") == "ok" if mb_res else False
            mb_item = mb_res.get("data", [{}])[0] if is_mb_found else {}

            vt_attr = vt_res.get("data", {}).get("attributes", {}) if vt_res else {}
            vt_stats = vt_attr.get("last_analysis_stats", {})
            vt_malicious = vt_stats.get("malicious", 0)
            otx_pulses = otx_res.get("pulse_info", {}).get("count", 0) if otx_res else 0

            enriched_data["telemetry"] = {
                "malwarebazaar": {
                    "signature": mb_item.get("signature"),
                    "tags": mb_item.get("tags", [])
                } if is_mb_found else "No match found in MalwareBazaar",

                "virustotal": {
                    "malicious": vt_malicious,
                    "names": vt_attr.get("meaningful_name")
                } if vt_res else "No match found in VirusTotal",

                "alienvault_otx": {
                    "related_pulses": otx_pulses,
                    "pulses": otx_res.get("pulse_info", {}).get("pulses", [])
                } if otx_res and otx_pulses > 0 else "No match found in AlienVault OTX"
            }

            if is_mb_found or vt_malicious > 0 or otx_pulses > 0:
                enriched_data["summary"] = {"score": 100, "verdict": "Malicious Payload", "color": "#ef4444"}
            elif vt_stats.get("harmless", 0) > 10:
                enriched_data["summary"] = {"score": 0, "verdict": "Known Safe File", "color": "#4ade80"}

        # ==========================================
        # 🔗 URL ROUTE
        # ==========================================
        elif ioc_type == "url":
            vt_headers = {"x-apikey": vt_key} if vt_key else {}
            b64_url = base64.b64encode(ioc.original.encode()).decode().rstrip("=")
            uh_data = {"url": ioc.original}

            uh_res, vt_res = await asyncio.gather(
                safe_fetch(client, "https://urlhaus-api.abuse.ch/v1/url/", method="POST", data=uh_data),
                safe_fetch(client, f"https://www.virustotal.com/api/v3/urls/{b64_url}", headers=vt_headers)
            )

            is_uh_found = uh_res.get("query_status") == "ok" if uh_res else False
            vt_malicious = vt_res.get("data", {}).get("attributes", {}).get("last_analysis_stats", {}).get("malicious", 0) if vt_res else 0

            enriched_data["telemetry"] = {
                "urlhaus": {
                    "status": uh_res.get("url_status"),
                    "threat": uh_res.get("threat"),
                    "payloads": uh_res.get("payloads", [])
                } if is_uh_found else "No match found in Abuse.ch URLHaus",

                "virustotal": {
                    "malicious": vt_malicious
                } if vt_res else "No match found in VirusTotal"
            }

            if is_uh_found or vt_malicious > 0:
                enriched_data["summary"] = {"score": 100, "verdict": "Malicious URL", "color": "#ef4444"}

        # ==========================================
        # 📧 EMAIL ROUTE (EmailRep)
        # ==========================================
        elif ioc_type == "email":
            emailrep_headers = {"Key": emailrep_key} if emailrep_key else {}
            email_res = await safe_fetch(client, f"https://emailrep.io/{cleaned}", headers=emailrep_headers)

            if email_res:
                reputation = email_res.get("reputation", "unknown")
                details = email_res.get("details", {})

                enriched_data["telemetry"] = {
                    "emailrep": {
                        "reputation": reputation,
                        "suspicious": email_res.get("suspicious", False),
                        "blacklisted": details.get("blacklisted", False),
                        "credentials_leaked": details.get("credentials_leaked", False)
                    }
                }

                if reputation == "low" or email_res.get("suspicious"):
                    enriched_data["summary"] = {"score": 80, "verdict": "Suspicious / Throwaway", "color": "#fbbf24"}
                elif reputation == "high":
                    enriched_data["summary"] = {"score": 0, "verdict": "High Reputation", "color": "#4ade80"}
            else:
                enriched_data["telemetry"] = {"emailrep": "No match or rate limited in EmailRep"}

    except Exception as err:
        enriched_data["error"] = f"Routing Failure: {str(err)}"

    return enriched_data


# --- Endpoint Route ---
@app.post("/api/enrich")
async def enrich_iocs(payload: EnrichRequest):
    if not payload.iocs:
        raise HTTPException(status_code=400, detail="No IOCs provided.")

    async with httpx.AsyncClient() as client:
        tasks = [enrich_single_ioc(ioc, client) for ioc in payload.iocs]
        results = await asyncio.gather(*tasks)

    return {"results": results}