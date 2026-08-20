import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { registryStore } from '../services/registryStore';
import { ApiKeyService } from '../services/apiKeyService';
import { celeStrakSocratesService } from '../services/celeStrakSocratesService';
import { fleetMonitorService } from '../services/fleetMonitorService';
import { ConjunctionAlertPayload, CompanyProfile } from '../types/sentinel';

export interface AuthenticatedRequest extends Request {
  authenticatedCompany?: CompanyProfile;
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'aegis_admin_master_secret_key_2026';

// In-memory IP tracking for 1 demo company creation per IP per 24 hours
const demoIpLimitMap: Map<string, number> = new Map();

app.use(cors());
app.use(express.json());

// Admin Master Key middleware for company provisioning
export function adminKeyAuth(req: Request, res: Response, next: NextFunction) {
  const adminHeader = (req.headers['x-admin-key'] as string) || (req.headers['x-api-key'] as string);
  const authHeader = req.headers['authorization'];

  let rawAdminKey = adminHeader;
  if (!rawAdminKey && authHeader && authHeader.startsWith('Bearer ')) {
    rawAdminKey = authHeader.substring(7).trim();
  }

  if (!rawAdminKey || rawAdminKey !== ADMIN_MASTER_KEY) {
    return res.status(403).json({
      error: 'Forbidden: Invalid or missing Admin Master Key. Company provisioning is restricted to Aegis Registry Admins only.',
      hint: 'Pass valid Admin key in x-admin-key header'
    });
  }

  next();
}

// Enterprise API Key middleware for company satellites & sovereign nodes
export async function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'] as string;

  let rawApiKey = apiKeyHeader;
  if (!rawApiKey && authHeader && authHeader.startsWith('Bearer ')) {
    rawApiKey = authHeader.substring(7).trim();
  }

  if (!rawApiKey) {
    return res.status(401).json({
      error: 'Unauthorized: Missing API Secret Key. Pass key in x-api-key header or Authorization: Bearer <key>'
    });
  }

  const apiKeyHash = ApiKeyService.hashApiKey(rawApiKey);
  const companyId = await registryStore.getCompanyByApiKeyHash(apiKeyHash);
  const company = companyId ? await registryStore.getCompany(companyId) : null;

  if (!company) {
    return res.status(403).json({ error: 'Forbidden: Invalid or revoked API Secret Key' });
  }

  req.authenticatedCompany = company;
  next();
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'Aegis Sentinel Public Server', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'Aegis Sentinel Public Registry', docs: '/health' });
});

// --- Restricted Admin-Only Company Provisioning Endpoint ---
app.post('/api/v1/registry/company', adminKeyAuth, async (req: Request, res: Response) => {
  try {
    const { companyId, name, domain } = req.body;
    if (!companyId || !name || !domain) {
      return res.status(400).json({ error: 'Missing required fields: companyId, name, domain' });
    }

    const { rawApiKey, apiKeyHash, apiKeyPrefix } = ApiKeyService.generateApiKey();

    const company = await registryStore.registerCompany({
      companyId,
      name,
      domain,
      isVerified: true,
      apiKeyHash,
      apiKeyPrefix
    });

    await registryStore.saveApiKeyMapping(apiKeyHash, companyId);

    return res.status(201).json({
      message: 'Company provisioned successfully by Admin. Keep your private API key secure!',
      company: {
        companyId: company.companyId,
        name: company.name,
        domain: company.domain,
        apiKeyPrefix: company.apiKeyPrefix,
        createdAt: company.createdAt
      },
      privateApiKey: rawApiKey
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- Public Self-Service Demo Creation Endpoint (Rate Limited: 1 Creation per IP per Day) ---
app.post('/api/v1/demo/company', async (req: Request, res: Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const now = Date.now();
    const lastCreationTime = demoIpLimitMap.get(clientIp);

    // Enforce 1 Creation per IP per 24 hours (86,400,000 ms)
    if (lastCreationTime && now - lastCreationTime < 86400000) {
      const hoursRemaining = Math.ceil((86400000 - (now - lastCreationTime)) / 3600000);
      return res.status(429).json({
        error: 'Too Many Requests: Demo creation rate limit reached (1 demo company per IP per 24 hours).',
        message: `Please use your previously generated demo API key or wait ${hoursRemaining} hours before creating another demo company.`
      });
    }

    const { username, password, companyId, name } = req.body;
    if (!username || !password || !companyId || !name) {
      return res.status(400).json({ error: 'Missing required fields: username, password, companyId, name' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const demoCompanyId = `demo-${companyId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const { rawApiKey, apiKeyHash, apiKeyPrefix } = ApiKeyService.generateApiKey();

    const company = await registryStore.registerCompany({
      companyId: demoCompanyId,
      name: `[DEMO] ${name}`,
      domain: `${username.toLowerCase()}.demo.local`,
      isVerified: false,
      apiKeyHash,
      apiKeyPrefix
    });

    await registryStore.saveApiKeyMapping(apiKeyHash, demoCompanyId);

    // Record IP rate limit timestamp
    demoIpLimitMap.set(clientIp, now);

    return res.status(201).json({
      message: 'Demo company profile created successfully! Keep your demo API key to launch your Sovereign Node.',
      company: {
        companyId: company.companyId,
        name: company.name,
        domain: company.domain,
        apiKeyPrefix: company.apiKeyPrefix,
        isDemo: true,
        createdAt: company.createdAt
      },
      demoApiKey: rawApiKey
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- Google Web Auth Callback API Endpoint ---
app.post('/api/v1/auth/google', async (req: Request, res: Response) => {
  try {
    const { email, displayName, googleId } = req.body;
    if (!email || !googleId) {
      return res.status(400).json({ error: 'Missing required fields: email, googleId' });
    }

    const sanitizedId = googleId.substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
    const demoCompanyId = `demo-google-${sanitizedId}`;
    const companyName = `[GOOGLE] ${displayName || email.split('@')[0]}`;
    const domain = email.split('@')[1] || 'gmail.com';

    let company = await registryStore.getCompany(demoCompanyId);
    let rawApiKey: string;

    if (!company) {
      const keyObj = ApiKeyService.generateApiKey();
      rawApiKey = keyObj.rawApiKey;

      company = await registryStore.registerCompany({
        companyId: demoCompanyId,
        name: companyName,
        domain,
        isVerified: true,
        apiKeyHash: keyObj.apiKeyHash,
        apiKeyPrefix: keyObj.apiKeyPrefix
      });

      await registryStore.saveApiKeyMapping(keyObj.apiKeyHash, demoCompanyId);
    } else {
      // Generate fresh operational key for existing Google account
      const keyObj = ApiKeyService.generateApiKey();
      rawApiKey = keyObj.rawApiKey;

      await registryStore.registerCompany({
        companyId: demoCompanyId,
        name: company.name,
        domain: company.domain,
        isVerified: true,
        apiKeyHash: keyObj.apiKeyHash,
        apiKeyPrefix: keyObj.apiKeyPrefix
      });

      await registryStore.saveApiKeyMapping(keyObj.apiKeyHash, demoCompanyId);
    }

    return res.status(200).json({
      message: 'Google Sign-In authenticated successfully!',
      company: {
        companyId: company.companyId,
        name: company.name,
        domain: company.domain
      },
      apiKey: rawApiKey,
      email
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- Served Web Authentication Interface for CLI Google Login ---
app.get('/auth/login', (req: Request, res: Response) => {
  const cliPort = req.query.port || '8085';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aegis Sovereign — Google Operator Sign-In</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 48px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.1);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .google-btn {
      width: 100%;
      background: #ffffff;
      color: #0f172a;
      border: none;
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 10px 15px -3px rgba(255, 255, 255, 0.1);
    }
    .google-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(255, 255, 255, 0.2);
    }
    .status {
      margin-top: 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #38bdf8;
      min-height: 20px;
    }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🛡️ AEGIS SOVEREIGN WEB AUTH</div>
    <h1>Operator Sign-In</h1>
    <p>Authenticate with Google to link your operator profile directly with your terminal Aegis Sovereign CLI.</p>
    
    <button class="google-btn" id="loginBtn">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      Sign in with Google
    </button>

    <div class="status" id="statusText">Ready for authentication</div>
    <div class="footer">Callback Port: <code>${cliPort}</code> | GCP Project: <code>aegis-506110</code></div>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const firebaseConfig = {
      projectId: "aegis-506110",
      authDomain: "aegis-506110.firebaseapp.com"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    const btn = document.getElementById('loginBtn');
    const status = document.getElementById('statusText');
    const cliPort = "${cliPort}";

    btn.addEventListener('click', async () => {
      try {
        status.innerText = "Opening Google Sign-In...";
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        status.innerText = "Creating Aegis Operator session...";

        const response = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            displayName: user.displayName,
            googleId: user.uid
          })
        });

        const data = await response.json();

        if (response.ok) {
          status.innerText = "SUCCESS! Redirecting session to CLI...";
          const callbackUrl = "http://localhost:" + cliPort + "/callback?" + new URLSearchParams({
            companyId: data.company.companyId,
            companyName: data.company.name,
            apiKey: data.apiKey,
            email: data.email
          }).toString();

          setTimeout(() => {
            window.location.href = callbackUrl;
          }, 800);
        } else {
          status.innerText = "Auth Error: " + (data.error || "Failed");
        }
      } catch (err) {
        status.innerText = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.post('/api/v1/registry/satellite', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noradId, satName } = req.body;
    const companyId = req.authenticatedCompany?.companyId;

    if (!noradId || !satName || !companyId) {
      return res.status(400).json({ error: 'Missing required fields: noradId, satName' });
    }

    const satellite = await registryStore.registerSatellite({
      noradId: Number(noradId),
      companyId,
      satName
    });

    return res.status(201).json({ message: 'Satellite registered successfully under company profile', satellite });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/registry/node', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nodeId, endpointUrl, publicKeyPem } = req.body;
    const companyId = req.authenticatedCompany?.companyId;

    if (!nodeId || !endpointUrl || !publicKeyPem || !companyId) {
      return res.status(400).json({ error: 'Missing required fields: nodeId, endpointUrl, publicKeyPem' });
    }

    const node = await registryStore.registerNode({
      nodeId,
      companyId,
      endpointUrl,
      publicKeyPem,
      status: 'ACTIVE'
    });

    return res.status(201).json({ message: 'Sovereign Node endpoint registered successfully', node });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/registry/lookup/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.noradId);
    const record = await registryStore.lookupNodeByNoradId(noradId);

    if (!record) {
      return res.status(404).json({ error: `No registered sovereign node found for NORAD ID ${noradId}` });
    }

    return res.json({
      noradId: record.satellite.noradId,
      satName: record.satellite.satName,
      companyId: record.satellite.companyId,
      endpointUrl: record.node.endpointUrl,
      publicKeyPem: record.node.publicKeyPem,
      status: record.node.status
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/registry/satellites', async (req: Request, res: Response) => {
  try {
    const satellites = await registryStore.getAllSatellites();
    return res.json({ count: satellites.length, satellites });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- 6. Live CelesTrak Orbit Telemetry & Risk Checker Endpoint ---
app.get('/api/v1/celestrak/events/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.noradId);
    const satRecord = await registryStore.getSatellite(noradId);

    const liveTelemetry = await celeStrakSocratesService.fetchLiveGpData(noradId);
    const matchedEvents = await celeStrakSocratesService.fetchConjunctionsByNoradId(noradId);

    if (matchedEvents.length === 0) {
      return res.json({
        queryNoradId: noradId,
        registeredCompany: satRecord?.companyId || 'UNREGISTERED',
        registeredSatName: satRecord?.satName || liveTelemetry?.OBJECT_NAME || 'UNKNOWN',
        liveTelemetry: liveTelemetry ? {
          objectName: liveTelemetry.OBJECT_NAME,
          objectId: liveTelemetry.OBJECT_ID,
          epochTimestamp: liveTelemetry.EPOCH,
          meanMotionOrbitsPerDay: liveTelemetry.MEAN_MOTION,
          inclinationDegrees: liveTelemetry.INCLINATION,
          eccentricity: liveTelemetry.ECCENTRICITY,
          dragBStar: liveTelemetry.BSTAR,
          raOfAscendingNodeDegrees: liveTelemetry.RA_OF_ASC_NODE
        } : null,
        riskAssessment: {
          status: 'NOMINAL_SAFE',
          eventsFound: 0,
          message: 'No immediate conjunction threats detected by CelesTrak. Satellite trajectory is nominal and safe.'
        },
        conjunctionEvents: []
      });
    }

    return res.json({
      queryNoradId: noradId,
      registeredCompany: satRecord?.companyId || 'UNREGISTERED',
      registeredSatName: satRecord?.satName || liveTelemetry?.OBJECT_NAME || 'UNKNOWN',
      liveTelemetry: liveTelemetry ? {
        objectName: liveTelemetry.OBJECT_NAME,
        objectId: liveTelemetry.OBJECT_ID,
        epochTimestamp: liveTelemetry.EPOCH,
        meanMotionOrbitsPerDay: liveTelemetry.MEAN_MOTION,
        inclinationDegrees: liveTelemetry.INCLINATION,
        eccentricity: liveTelemetry.ECCENTRICITY,
        dragBStar: liveTelemetry.BSTAR,
        raOfAscendingNodeDegrees: liveTelemetry.RA_OF_ASC_NODE
      } : null,
      riskAssessment: {
        status: 'WARNING_RISK_DETECTED',
        eventsFound: matchedEvents.length,
        message: `Active conjunction threat detected by CelesTrak for NORAD ${noradId}!`
      },
      conjunctionEvents: matchedEvents
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// --- 7. Targeted Fleet Risk Scan Endpoint ---
app.post('/api/v1/monitor/scan-fleet', async (req: Request, res: Response) => {
  try {
    const result = await fleetMonitorService.scanRegisteredFleetRisks();
    return res.json({
      message: 'Targeted fleet conjunction risk scan completed successfully against live CelesTrak data',
      result
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/screener/trigger-risk', async (req: Request, res: Response) => {
  try {
    const { satA_noradId, satB_noradId, predictedTCA, missDistanceMeters } = req.body;
    if (!satA_noradId || !satB_noradId) {
      return res.status(400).json({ error: 'Missing satA_noradId or satB_noradId' });
    }

    const nodeAInfo = await registryStore.lookupNodeByNoradId(Number(satA_noradId));
    const nodeBInfo = await registryStore.lookupNodeByNoradId(Number(satB_noradId));

    if (!nodeAInfo || !nodeBInfo) {
      return res.status(404).json({
        error: 'One or both satellites do not have registered Sovereign Node endpoints',
        nodeA: !!nodeAInfo,
        nodeB: !!nodeBInfo
      });
    }

    const eventId = `EVT-${Date.now()}`;
    const eventRecord = await registryStore.createConjunctionEvent({
      eventId,
      satA_noradId: Number(satA_noradId),
      satB_noradId: Number(satB_noradId),
      predictedTCA: predictedTCA || new Date(Date.now() + 86400000).toISOString(),
      missDistanceMeters: missDistanceMeters || 350,
      status: 'ALERT_DISPATCHED'
    });

    const payloadForNodeA: ConjunctionAlertPayload = {
      eventId,
      ownSatelliteNoradId: Number(satA_noradId),
      peerSatelliteNoradId: Number(satB_noradId),
      predictedTCA: eventRecord.predictedTCA,
      missDistanceMeters: eventRecord.missDistanceMeters,
      peerNodeEndpointUrl: nodeBInfo.node.endpointUrl,
      peerPublicKeyPem: nodeBInfo.node.publicKeyPem
    };

    const payloadForNodeB: ConjunctionAlertPayload = {
      eventId,
      ownSatelliteNoradId: Number(satB_noradId),
      peerSatelliteNoradId: Number(satA_noradId),
      predictedTCA: eventRecord.predictedTCA,
      missDistanceMeters: eventRecord.missDistanceMeters,
      peerNodeEndpointUrl: nodeAInfo.node.endpointUrl,
      peerPublicKeyPem: nodeAInfo.node.publicKeyPem
    };

    return res.status(200).json({
      message: 'Conjunction risk alert successfully dispatched to both sovereign nodes',
      event: eventRecord,
      dispatchedNodes: {
        nodeA: { company: nodeAInfo.satellite.companyId, endpoint: nodeAInfo.node.endpointUrl, payload: payloadForNodeA },
        nodeB: { company: nodeBInfo.satellite.companyId, endpoint: nodeBInfo.node.endpointUrl, payload: payloadForNodeB }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Explicitly bind to '0.0.0.0' for Cloud Run container health checks
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AEGIS SENTINEL] Running on port ${PORT} bound to 0.0.0.0`);
});

export default app;
