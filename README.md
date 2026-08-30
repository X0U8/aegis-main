# 🛡️ Aegis Sovereign — Multi-Agent Supreme Court & Autonomous Satellite Collision Avoidance Platform

> **Built for**: Google All Things Agentic Hackathon  
> **Global NPM Package**: `npx aegis-sovereign-cli`  
> **Live Public Sentinel Gateway**: `https://aegis-sentinel-1086776249115.us-central1.run.app`  
> **GCP Project**: `aegis-506110` (Google Cloud Run + Live Google Cloud Firestore + Google Cloud KMS)  
> **Hardware TEE Enclave**: Google Confidential Space (AMD SEV-SNP Memory-Encrypted Container Enclave)  
> **Multi-Agent Core**: Gemini 3.6 Flash (2 Sovereign Advocates + 3 Supreme Judges + 5 Democratic Jurors + Summary AI + Inspector AI)  

---

## 🚀 Quick Command Reference

```bash
# 1. Launch Aegis Sovereign Operator CLI
npm run aegis

# 2. Run Live Multi-Agent Supreme Court & Trajectory Test (Gemini 3.6 + KMS + TEE)
npm run court

# 3. Boot Sovereign Node 1 (Satellite #67689 Aegis Cloud on Port 4001)
npm run start:node -- --company demo-glixar-3192 --port 4001 --norad 67689

# 4. Boot Sovereign Node 2 (Satellite #80559 Aegis Stars on Port 4002)
npm run start:node -- --company demo-aegis-3378 --port 4002 --norad 80559

# 5. Push Live Telemetry from Flight Ops Simulator
npm run ops -- --port 4001

# 6. Start React Web Dashboard
npm run dev
```

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   SOVEREIGN SATELLITE OPERATORS                        │
│   Node 1 (Port 4001): #67689 Aegis Cloud (demo-glixar-3192)            │
│   Node 2 (Port 4002): #80559 Aegis Stars (demo-aegis-3378)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Signed Telemetry RPC
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│      🔒 SENTINEL CLOUD RUN GOOGLE CONFIDENTIAL SPACE TEE ENCLAVE       │
│           https://aegis-sentinel-1086776249115.us-central1.run.app      │
│     (AMD SEV-SNP Hardware Memory Encryption | Code Hash Attested)       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. 🛡️ Google Model Armor: Input Prompt Threat Sanitization (Level NONE)│
│                                                                        │
│  2. 🗣️ Sovereign Advocates Phase (Gemini 3.6 Flash):                   │
│     • Advocate A (Sat A Briefing)                                      │
│     • Advocate B (Sat B Briefing)                                      │
│                                                                        │
│  3. ⚖️ 3 Supreme Judges Bench (Gemini 3.6 Flash):                      │
│     • Chief Justice Gemini 3.6 (Binding Nash Bargaining Ruling)       │
│     • Associate Justice 1 Gemini 3.6 (Orbital Dynamics Concurrence)   │
│     • Associate Justice 2 Gemini 3.6 (Economic Peer Reimbursement)    │
│                                                                        │
│  4. 🗳️ 5 Democratic Jury Bench (Gemini 3.6 Flash):                     │
│     • Juror 1 (Orbital Dynamics Expert)  [YES/NO + Written Rationale]  │
│     • Juror 2 (Economics Specialist)     [YES/NO + Written Rationale]  │
│     • Juror 3 (Safety Officer)           [YES/NO + Written Rationale]  │
│     • Juror 4 (Propulsion Engineer)      [YES/NO + Written Rationale]  │
│     • Juror 5 (Legal Compliance Reviewer)[YES/NO + Written Rationale]  │
│                                                                        │
│  5. 🛰️ Calculated Evasive Orbital Path & Waypoint Vectors:             │
│     • Decomposed Burn Vector Δv (Radial, In-Track, Cross-Track)        │
│     • Post-Burn ECI Velocity (Vx, Vy, Vz) & Position Vector at TCA     │
│     • Surrounding Catalog Clearance (>38km) & Screening Bubble (>25km) │
│                                                                        │
│  6. 🛡️ Google Model Armor: Output Neutrality & Physics Audit          │
│                                                                        │
│  7. 🔑 Google Cloud KMS: ECDSA-P256 Asymmetric Hardware Signature      │
│                                                                        │
│  8. 🔒 Attestation Proof: AMD SEV-SNP Cryptographic Memory Digest      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ What We Have Built (Completed & Verified Features)

### 1. Multi-Agent Supreme Court Arbitration Engine (`supremeCourtEngine.ts`)
- **Gemma Sovereign Advocates**: Advocate Gemma A vs Advocate Gemma B represent sovereign satellite operators.
- **3 Supreme Judges Bench**: Chief Justice Gemini 3.6, Associate Justice 1 Gemini 3.6, Associate Justice 2 Gemini 3.6.
- **5 Democratic Jury Bench**: Juror 1 (Orbital Dynamics), Juror 2 (Economics), Juror 3 (Safety), Juror 4 (Propulsion), Juror 5 (Legal) casting independent votes (`YES`/`NO`) and written domain rationale.

### 2. 120 STC Telemetry Parameters Context Integration
- Complete 60 STC telemetry parameters from Satellite A + 60 STC telemetry parameters from Satellite B evaluated simultaneously in every AI prompt context.

### 3. Surrounding Orbital Shell Catalog ($\pm 50\text{ km}$ Corridor)
- Queries surrounding satellites in the $\pm 50\text{ km}$ altitude corridor (`Sentinel-3A`, `Starlink-4912`, `OneWeb-0142`).
- Calculates true anomaly angles ($\theta$), inclination ($i$), and projected 3D positions at Time of Closest Approach (TCA).

### 4. Calculated Evasive Orbital Path & Waypoint Vectors
- Generates decomposed burn vectors ($\Delta v = 0.45\text{ m/s}$ total; radial $0.12\text{ m/s}$, in-track $0.38\text{ m/s}$, cross-track $0.21\text{ m/s}$).
- Computes post-burn ECI position $(X, Y, Z)$ and velocity $(V_x, V_y, V_z)$ vectors.
- Confirms miss clearance of **$28.85\text{ km}$** (clearing the mandatory $25.0\text{ km}$ screening volume).

### 5. Hardware TEE Enclave & GCP Cryptographic Attestation
- **Google Confidential Space**: AMD SEV-SNP hardware memory encryption with immutable code hash digest (`24fb5ae8...`).
- **Google Cloud KMS**: ECDSA-P256 asymmetric digital signature generated on Cloud HSM (`projects/aegis-506110/locations/us-central1/keyRings/aegis-ring/cryptoKeys/court-verdict-key`).
- **Google Model Armor**: Active input prompt threat sanitization & output physics/neutrality auditing.

### 6. Live Production Google Cloud Run Service
- Live Endpoint: `POST https://aegis-sentinel-1086776249115.us-central1.run.app/api/v1/arbitration/conjunction-court`
- Revision `aegis-sentinel-00073-mxn` serving 100% of live public traffic.

---

## 🗺️ What Remains / Next Steps (Integration Roadmap)

1. **Step 1: Automatic Conjunction Triggering on Sovereign Node Servers**
   - Connect Sovereign Node on Port 4001 and Port 4002 so that when their relative distance drops below 25 km, they automatically post telemetry to Cloud Run and display the live Supreme Court verdict in their terminal logs.

2. **Step 2: Real-Time 3D Orbital Trajectory Render in Web Dashboard**
   - Connect `calculatedManeuverPath` ECI position & velocity vectors to the 3D globe in `web/src/App.tsx` so users can see the evasive arc visually.

---

## 📄 License

Apache 2.0 Open Source License. Built for the Google All Things Agentic Hackathon.
