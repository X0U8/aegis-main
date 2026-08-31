# Aegis

![Aegis Logo](https://ik.imagekit.io/my6lpmrjp/logo.png)

> **Global CLI Runner**: `npx aegis-sovereign-cli@latest`  
> **Production Sentinel Gateway**: `https://aegis-sentinel-1086776249115.us-central1.run.app`  
> **Security Enclave Architecture**: Hardware Trusted Execution Environment (TEE)  
> **Multi-Agent Judicial System**: 2 Sovereign Advocates + 3 AI Supreme Judges + 5 Democratic Jurors + Summary AI + Inspector AI  

---

## Architecture & Visual Overview

![Backend Architecture](https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-31%20at%209.29.04%E2%80%AFPM.png)

| Aegis Web Application Dashboard | Aegis CLI |
| :--- | :--- |
| ![Aegis Web App](https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-30%20at%203.35.55%E2%80%AFPM.png?updatedAt=1788084362758) | ![Aegis CLI](https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-31%20at%201.47.47%E2%80%AFPM.png?updatedAt=1788164277348) |

---

## Step-by-Step Testing & Quickstart Guide

Follow this step-by-step workflow to test local node initialization, telemetry ingestion, satellite registration, and multi-agent AI judicial arbitration:

### 1. Install CLI & Log In
Launch the Aegis Sovereign Operator CLI in your terminal:
```bash
npx aegis-sovereign-cli@latest
```
Select Option `[1] Preview Login` to initialize a sandbox company profile and receive your Private Secret Key.

### 2. Launch Sovereign Node Server
In the Aegis CLI main menu, select Option `[4] Launch Sovereign Server` on port `4001`.
The CLI automatically spawns a dedicated node process that starts listening locally and provisions a live HTTPS webhook tunnel URL (`https://xxx.loca.lt/webhook`).

### 3. Register Satellite Asset (Paper Registration)
Select Option `[2] Register Satellite under Company Profile` in the Aegis CLI menu.
Input your satellite asset name, bind the live webhook URL from Step 2, and complete the 5-step cryptographic ownership verification to register your satellite in the Database Registry.

### 4. Deploy Virtual Satellite in Web Application
Open the Aegis Web Application and sign in using the same account / Company ID used during CLI setup.
Select your registered satellite from the fleet catalog, pick an orbital model category, and click **Deploy Satellite** to place your asset onto the 3D globe visualization.

### 5. Start Company Flight Ops Simulator
Since external testers do not have physical satellite ground station hardware, copy the pre-filled Flight Ops command from the web app and select CLI Option `[12] Execute Copied Flight Ops Command` to launch the simulator.
This simulator continuously streams flight position vectors, battery status, thruster state, and AOCS health to your Sovereign Node every 300 seconds.

### 6. Simulate Conjunction Risk & Run AI Judicial Arbitration
To evaluate autonomous collision avoidance:
1. Open a second terminal window and launch a second Sovereign Node on port `4002` (one Sovereign Node process per satellite).
2. Register Satellite #2 under your company profile.
3. Open the Web Application, select Satellite #2, and click **Deploy with Collision Risk**. This configures orbital vectors so a predicted conjunction occurs within 2 hours.
4. Central Sentinel Cloud detects the conjunction risk and dispatches real-time HTTP alert webhooks to both Sovereign Nodes simultaneously.
5. Both Sovereign Nodes establish secure communication inside a Hardware Trusted Execution Environment (TEE).
6. Each node submits its complete 60-parameter physical telemetry record (120 parameters total).
7. The AI Judicial Bench (3 AI Supreme Judges & 5 Democratic Jurors) arbitrates right-of-way, determines the evasive burn vector ($\Delta v = 0.45\text{ m/s}$), verifies spatial trajectory clearance ($>25\text{ km}$), and returns cryptographically signed verdict summaries to both nodes.

### 7. Inspector AI Compliance Daemon
An automated Inspector AI daemon runs continuously in the background to audit all judicial arbitration reports stored in the Database Registry. It tracks company yield rates, monitors downtime claim ratios, and verifies that verdicts remain strictly neutral and compliant with orbital physics.

---

## Detailed Documentation

For full architectural specifications, API endpoints, and CLI command references, please navigate to the **Documentation** section on the Aegis Web Application.

---

## Google Technologies & Infrastructure Stack

| Google Technology / Tool | Implementation Location & Role in Aegis |
| :--- | :--- |
| **Google Confidential Space** | **Hardware TEE Enclave**: Memory-encrypted environment (AMD SEV-SNP) hosting the Sentinel arbitration gateway (`sentinelServer.ts`) with immutable code attestation. |
| **Google GenAI SDK (`@google/genai`)** | **Multi-Agent Judicial Engine**: Powers Gemma Sovereign Advocates A & B, 3 AI Supreme Judges, 5 Democratic Jurors, and Summary AI in `supremeCourtEngine.ts`. |
| **Google Vertex AI (`@google-cloud/vertexai`)** | **Enterprise Model Gateway**: Serves Gemini 3.6 Flash / 2.5 Flash models for right-of-way trajectory reasoning and Nash bargaining calculations. |
| **Google Cloud Run** | **Production Sentinel Deployment**: Hosts the live public container instance (`https://aegis-sentinel-1086776249115.us-central1.run.app`) serving 100% of production traffic. |
| **Google Cloud Firestore (`@google-cloud/firestore`)** | **Database Registry**: Manages persistent storage in `registryStore.ts` for satellite records, conjunction events, AI verdicts, and audit logs. |
| **Google Cloud KMS (Key Management)** | **Hardware Security Module**: HSM key ring producing asymmetric ECDSA-P256 hardware digital signatures for judicial verdicts (`kmsSigningService.ts`). |
| **Google Model Armor** | **AI Safety & Threat Protection**: Input prompt threat sanitization and output physics/neutrality auditing middleware in `modelArmorService.ts`. |
| **Google Inspector AI Agent** | **Autonomous Compliance Audit**: Background daemon in `inspectorAiService.ts` auditing Firestore verdict logs for bias prevention and yield analytics. |
| **Google Firebase Authentication** | **Identity & Access Management**: Authenticates operator accounts via Google Sign-In and manages multi-tenant browser sessions (`web/src/lib/firebase.ts`). |
| **Google Antigravity IDE & CLI** | **Agentic Architecture & Deployment**: Orchestrated system design, code generation, testing, and production Cloud Run deployment. |

---

## License

Apache 2.0 Open Source License. Built for the Google All Things Agentic Hackathon.