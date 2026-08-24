# 🛡️ Aegis Sovereign — Autonomous Decentralized Satellite Collision Avoidance Fleet

> **Track**: The Fortified Enterprise Fleet | **Built for**: Google All Things Agentic Hackathon  
> **Global NPM Package**: `npx aegis-sovereign-cli`  
> **Production Cloud Run URL**: `https://aegis-sentinel-1086776249115.us-central1.run.app`  
> **GCP Project**: `aegis-506110` (Google Cloud Run + Live Google Cloud Firestore)  
> **Tech Stack**: Gemini 3.5 / Google ADK, Google Cloud Firestore, Google Cloud Run, Google A2A Protocol, Google Cloud KMS, C++ SGP4 Physics Engine, Node.js / TypeScript, mTLS E2EE.

---

## ⚡ Quick Command Reference Guide

### 💻 1. Aegis Operator Interactive Dashboard
Launch the operator CLI to manage satellites, ping servers, and dispatch risk alerts:

```bash
npm run aegis
# OR globally anywhere:
npx aegis-sovereign-cli
```

**Main Menu Options**:
* **`[1] Register Satellite under Company Profile`**: Deploys satellite asset and executes the live 3-step security handshake (*Liveness Probe* $\rightarrow$ *SHA-256 Code Integrity* $\rightarrow$ *Password Ownership Attestation*).
* **`[2] View Company Satellites`**: Displays an isolated catalog of your company's registered satellites.
* **`[3] Ping Sovereign Node Server`**: Runs a 3-point diagnostic report on any running node server (Liveness latency, SHA-256 binary verification, password attestation).
* **`[4] Trigger Risk Alert Dispatch`**: Simulates an orbital collision threat and dispatches webhook alerts to Sovereign Nodes.
* **`[5] Logout / Switch Account`**: Clears local session cache.

---

### 🛰️ 2. Launch a Sovereign Node Server
Boots a self-hosted Sovereign Node server on your private infrastructure:

```bash
# Launch Node on Port 4001 for company demo-glixar-3192:
npm run start:node -- --company demo-glixar-3192 --port 4001 --key YOUR_PRIVATE_KEY --secret glixarpass123

# Launch Node on Port 4002 for company demo-areo-9984:
npm run start:node -- --company demo-areo-9984 --port 4002 --key YOUR_PRIVATE_KEY --secret areopass123
```

**CLI Flags**:
* `--company` / `-c`: Company ID slug (e.g. `demo-glixar-3192`).
* `--port` / `-p`: Local listening port (e.g. `4001`).
* `--key` / `-k`: Private API Secret Key (`aegis_sk_demo_...`).
* `--secret` / `--password`: Node Security Password for server ownership verification.

---

### 📡 3. Company Flight Operations Telemetry Simulator
Simulates a company's internal Flight Operations Ground Station pushing live mission & propulsion telemetry to its Sovereign Node server every 10 seconds:

```bash
# Push telemetry to Node on Port 4001 every 10 seconds:
npm run ops -- --port 4001 --interval 10

# Push telemetry to Node on Port 4002 every 10 seconds:
npm run ops -- --port 4002 --interval 10
```

---

## 📊 3-Tier Space Traffic Management (STM) Parameter Taxonomy

```text
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 Space Traffic Management (STM) API                     │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
│  1. Static Asset Profile  ││ 2. Dynamic Telemetry State││ 3. Automated Calculated   │
│(Registered Once on Launch)││ (Pushed Live Every Push) ││  (Calculated by Platform) │
├───────────────────────────┤├───────────────────────────┤├───────────────────────────┤
│ • noradId                 ││ • daysActiveInOrbit       ││ • solarFluxIndexF107      │
│ • satName                 ││ • missionPriorityLevel    ││ • geomagneticIndexAp      │
│ • companyId               ││ • nominalOrbitStatus      ││ • conjunctionId           │
│ • projectName             ││ • operatorWorkloadLevel   ││ • timeToClosestApproachTCA│
│ • missionDurationDays     ││ • fuelReservePercent      ││ • relativeVelocityKmSec   │
│ • licensingJurisdiction   ││ • fuelMassKg              ││ • collisionGeometryAngle..│
│ • emergencyContactEndpoint││ • batteryStateOfCharge..  ││ • covarianceUncertaintyKm │
│ • satelliteMassKg         ││ • aocsHealthStatus        ││ • secondaryConjunction... │
│ • crossSectionalAreaM2    ││ • sensorPayloadSensitivity││ • inSunlight              │
│ • ballisticCoefficient    ││ • positionVectorKm        ││ • missDistanceKm          │
│ • thrusterType            ││ • velocityVectorKmSec     ││ • counterpartyObjectType  │
│ • specificImpulseIspSec   ││ • covarianceMatrixRIC     ││ • isChainedConjunction    │
│ • maxThrustNewton         ││ • nextContactWindowUTC    ││ • arbitrationTieBreaker...│
│ • maneuverSlewTimeSec     ││ • operatorFreezeCutoff    ││ • screeningVolumeRadiusKm │
│ • propulsionWarmupTimeSec ││ • autonomousManeuver..    ││                           │
│ • maximumDeltaVCapacity   ││ • constellationPlaneId    ││                           │
│ • dutyCyclePercent        ││ • numberOfCoOrbitingAssets││                           │
│ • payloadDowntimeCostPerHr││ • isChaserInActiveRendez..││                           │
│ • groundStationRecovery.. ││ • sharedDataPrivacyLevel  ││                           │
│ • insuranceLiabilityCapUSD││ • telemetrySource         ││                           │
│ • acceptableCollisionTh...││ • dataStalenessTolerance..││                           │
│ • interOperatorCoordination││ • gnssFixQuality          ││                           │
│                           ││ • lastTelemetryUpdateAt   ││                           │
│                           ││ • cryptographicSignature  ││                           │
└───────────────────────────┘└───────────────────────────┘└───────────────────────────┘
```

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               AEGIS SENTINEL PUBLIC CLOUD RUN REGISTRY                 │
│        https://aegis-sentinel-1086776249115.us-central1.run.app        │
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
| **3-Step Security** | Live Liveness Probe, SHA-256 Code Hash & Password Ownership Attestation | ✅ Verified |
| **Data Privacy** | Zero-Knowledge Local Telemetry Storage (Fuel/Costs Never Leave Node) | ✅ Verified |
| **Audit Log** | **Google Cloud KMS** Cryptographic Asymmetric Signatures | ✅ Verified |

---

## 📄 License

Apache 2.0 Open Source License. Built for the Google All Things Agentic Hackathon.
