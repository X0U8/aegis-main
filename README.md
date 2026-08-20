# 🛡️ Aegis Sovereign — Autonomous Decentralized Satellite Collision Avoidance Fleet

> **Track**: The Fortified Enterprise Fleet | **Built for**: Google All Things Agentic Hackathon  
> **Global NPM Package**: `npx aegis-sovereign-cli`  
> **Production Cloud Run URL**: `https://aegis-sentinel-1086776249115.us-central1.run.app`  
> **GCP Project**: `aegis-506110` (Google Cloud Run + Live Google Cloud Firestore)  
> **Tech Stack**: Gemini 3.5 / Google ADK, Google Cloud Firestore, Google Cloud Run, Google A2A Protocol, Google Cloud KMS, C++ SGP4 Physics Engine, Node.js / TypeScript, mTLS E2EE.

---

## ⚡ 1-Second Global Quick Start (Zero Installation Required)

Anyone in the world can run the interactive Aegis Operator CLI directly from NPM anywhere on Earth:

```bash
npx aegis-sovereign-cli
```

```text
 █████╗ ███████╗ ██████╗ ██╗███████╗
██╔══██╗██╔════╝██╔════╝ ██║██╔════╝
███████║█████╗  ██║  ███╗██║███████╗
██╔══██║██╔══╝  ██║   ██║██║╚════██║
██║  ██║███████╗╚██████╔╝██║███████╗
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝
                                    

               ~+
                 *       +
           '                  |
       ()    .-.,="``"=.    - o -
             '=/ _      \     |
          *   |  '=._    |
               \     `=./`,        '
            .   '=.__.=' `='      *
   +                         +
        O      *        '       .
  
 SELECT ENTRY MODE  Choose Aegis Preview or Enterprise Company Login

? Select option: (Use arrow keys)
❯ [1] Aegis Preview Login (Public Testing) 
  [2] Enterprise Company Login (Company ID & Private Key) 
  ──────────────
  [3] Exit Aegis CLI 
```

---

## 🛰️ Executive Overview

Existing satellite traffic management platforms act like **centralized traffic lights on Earth**. Both satellite competitors must upload their private fuel levels, thruster capabilities, and commercial trade secrets to a 3rd-party cloud server.

**Aegis Sovereign** acts like two autonomous self-driving satellites communicating over an **End-to-End Encrypted (E2EE) telephone call**. 

* **Zero Data Leakage**: Private fuel levels, payload values, and thruster limits **never leave the operator's self-hosted node**.
* **Blind Nash Auction**: Autonomous AI agents negotiate orbital maneuvers over Google’s Agent-to-Agent (A2A) protocol inside hardware-encrypted RAM (AMD SEV Confidential Enclaves).
* **Restricted B2B Admin Provisioning**: Enterprise profiles are provisioned by Aegis Admins (`x-admin-key` protected).
* **Public Self-Service Demo**: Hackathon reviewers can create demo profiles (`POST /api/v1/demo/company`) with a strict **1 IP per 24 hours rate limit** to prevent bot spamming.
* **Auto-Registering Sovereign Nodes**: Operator servers auto-register their live endpoint URL and public key in Google Cloud Firestore upon boot.
* **Direct NORAD-ID CelesTrak Screener**: Zero dummy data. Fetches real-time orbital telemetry directly from US Space Command radar updates via CelesTrak.
* **Immutable Audit Trail**: Final burn agreements are signed via **Google Cloud KMS** for space insurance underwriters and flight compliance.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               AEGIS SENTINEL PUBLIC CLOUD RUN REGISTRY                 │
│        https://aegis-sentinel-1086776249115.us-central1.run.app       │
│ - Admin-Vetted B2B Directory (Google Cloud Firestore + GCP IAM)        │
│ - Stores ONLY: Satellite NORAD ID ──► Node Endpoint URL & Public Key   │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ Public Lookup Request
                             │ ("Get Node URL & Public Key for NORAD 59102")
                             ▼
┌──────────────────────────┐     E2EE Tunnel      ┌──────────────────────────┐
│   GLIXAR SPACE NODE      │    (Google A2A)      │    SPACEX NODE (GCP)     │
│  - Self-Hosted Server    │◄────────────────────►│  - Self-Hosted Server    │
│  - Google ADK Agent      │    Direct mTLS Call  │  - Google ADK Agent      │
│  - C++ Nash Math Core    │    Blind Auction     │  - C++ Nash Math Core    │
└────────────┬─────────────┘                      └────────────┬─────────────┘
             │                                                 │
             ▼                                                 ▼
┌──────────────────────────┐                      ┌──────────────────────────┐
│ GCP KMS Signed Cert      │                      │ GCP KMS Signed Cert      │
│ (Zero Fuel Data Leaked)  │                      │ (Zero Fuel Data Leaked)  │
└──────────────────────────┘                      └──────────────────────────┘
```

---

## 🧪 Security & Verification Matrix

| Component | Security / Implementation Mechanism | Status |
| :--- | :--- | :--- |
| **Global Package** | Live **NPM Registry Package** (`npx aegis-sovereign-cli`) | ✅ Verified |
| **Cloud Hosting** | **Google Cloud Run** Container (`https://aegis-sentinel-1086776249115.us-central1.run.app`) | ✅ Verified |
| **Database** | Live **Google Cloud Firestore** (`aegis-506110`) | ✅ Verified |
| **Admin Security** | Admin-Only Provisioning (`x-admin-key` protected) & SHA-256 Hashed Keys | ✅ Verified |
| **Anti-Bot Rate Limit** | Public Demo Company Creation (Strict **1 Creation per IP per 24h**) | ✅ Verified |
| **Risk Screener** | Direct NORAD-ID **CelesTrak SOCRATES API** (Zero Dummy Data) | ✅ Verified |
| **Audit Log** | **Google Cloud KMS** Cryptographic Asymmetric Signatures | ✅ Verified |

---

## 📄 License

Apache 2.0 Open Source License. Built for the Google All Things Agentic Hackathon.
