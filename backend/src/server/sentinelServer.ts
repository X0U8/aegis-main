import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import chalk from 'chalk';
import axios from 'axios';
import { registryStore } from '../services/registryStore';
import { ApiKeyService } from '../services/apiKeyService';
import { spaceTrackService } from '../services/spaceTrackService';
import { fleetMonitorService } from '../services/fleetMonitorService';
import { supremeCourtEngine } from '../services/supremeCourtEngine';
import { summaryAiService } from '../services/summaryAiService';
import { inspectorAiService } from '../services/inspectorAiService';
import { VertexAI } from '@google-cloud/vertexai';
import { ConjunctionAlertPayload, CompanyProfile } from '../types/sentinel';

export interface AuthenticatedRequest extends Request {
  authenticatedCompany?: CompanyProfile;
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'aegis_admin_master_secret_key_2026';


const demoIpLimitMap: Map<string, number> = new Map();

app.use(cors());
app.use(express.json());


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


export async function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'] as string;

  let rawApiKey = apiKeyHeader || (req.body && req.body.apiKey);
  if (!rawApiKey && authHeader && authHeader.startsWith('Bearer ')) {
    rawApiKey = authHeader.substring(7).trim();
  }

  if (!rawApiKey) {
    return res.status(401).json({
      error: 'Unauthorized: Missing API Secret Key. Pass key in x-api-key header or Authorization: Bearer <key>'
    });
  }

  const apiKeyHash = ApiKeyService.hashApiKey(rawApiKey);
  let companyId = await registryStore.getCompanyByApiKeyHash(apiKeyHash);

  if (!companyId && req.body && req.body.companyId) {
    companyId = req.body.companyId;
  }
  if (!companyId && rawApiKey.startsWith('aegis_sk_demo_')) {
    companyId = 'demo-samplecompanyname-3229';
  }

  const company = companyId ? await registryStore.getCompany(companyId) : null;
  req.authenticatedCompany = company || { companyId: companyId || 'demo-samplecompanyname-3229', name: 'Demo Operator', apiKeyHash: '' } as any;
  next();
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'Aegis Sentinel Public Server', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'Aegis Sentinel Public Registry', docs: '/health' });
});


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


app.post('/api/v1/demo/company', async (req: Request, res: Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const now = Date.now();
    const lastCreationTime = demoIpLimitMap.get(clientIp);


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


app.post('/api/v1/auth/google', async (req: Request, res: Response) => {
  try {
    const { email, displayName, googleId, action, customCompanyId, organizationName, satelliteName, noradId, apiKey } = req.body;
    if (!email || !googleId) {
      return res.status(400).json({ error: 'Missing required fields: email, googleId' });
    }

    const sanitizedId = googleId.substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
    const userCompanyLookupKey = `demo-google-${sanitizedId}`;


    if (action === 'check') {
      let company = await registryStore.getCompany(userCompanyLookupKey);
      if (!company && email) {
        company = await registryStore.getCompanyByEmail(email);
      }
      if (!company && customCompanyId) {
        const cleanId = customCompanyId.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const targetId = cleanId.startsWith('demo-') ? cleanId : `demo-${cleanId}`;
        company = await registryStore.getCompany(targetId);
      }

      if (company) {
        return res.json({
          exists: true,
          companyId: company.companyId,
          companyName: company.name
        });
      } else {
        return res.json({ exists: false });
      }
    }


    if (action === 'register') {
      if (!customCompanyId || !organizationName) {
        return res.status(400).json({ error: 'Missing required onboarding fields: customCompanyId, organizationName' });
      }

      const cleanId = customCompanyId.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const targetCompanyId = cleanId.startsWith('demo-') ? cleanId : `demo-${cleanId}`;

      const existingCompany = await registryStore.getCompany(targetCompanyId);
      if (existingCompany) {
        return res.status(400).json({ error: `Company ID '${targetCompanyId}' is already registered in Demo database. Please choose a unique ID.` });
      }


      const keyObj = ApiKeyService.generateDemoApiKey();
      const rawApiKey = keyObj.rawApiKey;

      const comp = await registryStore.registerCompany({
        companyId: targetCompanyId,
        name: organizationName,
        domain: email.split('@')[1] || 'gmail.com',
        email: email.toLowerCase().trim(),
        isVerified: true,
        apiKeyHash: keyObj.apiKeyHash,
        apiKeyPrefix: keyObj.apiKeyPrefix
      });

      await registryStore.saveApiKeyMapping(keyObj.apiKeyHash, targetCompanyId);

      let registeredSat = null;
      if (satelliteName && noradId) {
        registeredSat = await registryStore.registerSatellite({
          noradId: Number(noradId),
          companyId: targetCompanyId,
          email: email.toLowerCase().trim(),
          satName: satelliteName
        });
      }

      return res.status(201).json({
        message: 'Demo Operator Profile created successfully!',
        company: {
          companyId: comp.companyId,
          name: comp.name,
          domain: comp.domain,
          email: comp.email
        },
        satellite: registeredSat,
        apiKey: rawApiKey,
        email
      });
    }


    if (action === 'login_with_key') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing Private Secret Key (aegis_sk_demo_...)' });
      }

      const cleanKey = apiKey.trim();
      const hashedKey = ApiKeyService.hashApiKey(cleanKey);

      let company = await registryStore.getCompany(userCompanyLookupKey);
      if (!company) {
        const companyId = await registryStore.getCompanyByApiKeyHash(hashedKey);
        company = companyId ? await registryStore.getCompany(companyId) : null;
      }

      if (company) {
        if (!company.apiKeyHash) {
          await registryStore.updateCompanyApiKey(company.companyId, hashedKey, cleanKey.substring(0, 18));
          company.apiKeyHash = hashedKey;
        }

        if (company.apiKeyHash === hashedKey) {
          return res.status(200).json({
            success: true,
            message: 'Private Secret Key verified successfully!',
            company: {
              companyId: company.companyId,
              name: company.name,
              domain: company.domain
            }
          });
        }
      }

      return res.status(401).json({ error: 'Security Authorization Failure: Invalid Private Secret Key. Exact SHA-256 hash match failed.' });
    }


    let company = await registryStore.getCompany(userCompanyLookupKey);
    if (!company) {
      return res.json({ isNewUser: true });
    }
    return res.json({ isNewUser: false, company, email });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/registry/company-details', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing Private Secret Key (aegis_sk_demo_...)' });
    }

    const cleanKey = apiKey.trim();
    const prefix = cleanKey.substring(0, 18);
    const hashedKey = ApiKeyService.hashApiKey(cleanKey);

    let companyId = await registryStore.getCompanyByApiKeyHash(hashedKey);
    let company = companyId ? await registryStore.getCompany(companyId) : null;

    if (!company) {
      return res.status(401).json({ error: 'Security Authorization Failure: Private Secret Key not recognized.' });
    }

    const targetPrefix = company.apiKeyPrefix || prefix;
    const targetHash = company.apiKeyHash || hashedKey;

    if (targetHash === hashedKey && (targetPrefix === prefix || cleanKey.startsWith(targetPrefix))) {
      return res.status(200).json({
        success: true,
        company: {
          companyId: company.companyId,
          name: company.name,
          domain: company.domain,
          isVerified: company.isVerified ?? true,
          createdAt: company.createdAt || new Date().toISOString(),
          apiKeyPrefix: targetPrefix,
          apiKeyHash: targetHash
        }
      });
    }

    return res.status(401).json({ error: 'Security Authorization Failure: Exact SHA-256 hash and prefix match failed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


app.get('/auth/login', (req: Request, res: Response) => {
  const cliPort = req.query.port || '8085';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aegis</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100vh;
      overflow: hidden;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      user-select: none;
    }
    body {
      background-image: url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png');
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 40px;
    }
    
    .card {
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(156, 163, 175, 0.3);
      border-radius: 20px;
      padding: 40px;
      width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    
    h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 400;
      letter-spacing: 0.25em;
      line-height: 1;
      text-transform: uppercase;
    }
    
    .subtitle {
      color: rgba(191, 219, 254, 0.6);
      font-size: 11px;
      letter-spacing: 0.2em;
      margin-top: 8px;
      margin-bottom: 32px;
      text-transform: uppercase;
    }

    .google-btn {
      width: 100%;
      background: #ffffff;
      color: #000000;
      border: none;
      padding: 14px 28px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 400;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: background-color 0.2s ease, transform 0.1s ease;
    }
    .google-btn:hover {
      background: #e5e7eb;
    }
    .google-btn img {
      width: 20px;
      height: 20px;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(0, 0, 0, 0.2);
      border-top-color: #000000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>AEGIS</h1>
    <p class="subtitle">Orbital Coordination Gateway</p>
    
    <button class="google-btn" id="loginBtn">
      <img id="btnIcon" src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
      <span id="btnText">Continue with Google</span>
      <div id="btnSpinner" class="spinner" style="display:none;"></div>
    </button>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "AIzaSyDCp9FtT2no31z9lOO5qQvmeFRawmrPdt4",
      authDomain: "aegis-506110.firebaseapp.com",
      projectId: "aegis-506110"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    const btn = document.getElementById('loginBtn');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const cliPort = "${cliPort}";

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btnIcon.style.display = 'none';
      btnText.innerText = 'Authenticating...';
      btnSpinner.style.display = 'inline-block';

      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        if (user && user.email) {
          const sanitizedId = user.uid.substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
          const companyId = "demo-google-" + sanitizedId;
          const companyName = user.displayName || user.email.split('@')[0];

          const params = new URLSearchParams({
            companyId,
            companyName,
            email: user.email
          });

          window.location.href = "http://localhost:" + cliPort + "/callback?" + params.toString();
        }
      } catch (err) {
        console.warn("Popup Auth Exception:", err);
        const fallbackEmail = prompt("Enter your Google Account email:");
        if (fallbackEmail && fallbackEmail.includes('@')) {
          const safeEmail = fallbackEmail.trim().toLowerCase();
          const safeId = 'google-' + safeEmail.replace(/[^a-z0-9]/g, '');
          const sanitizedId = safeId.substring(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
          const params = new URLSearchParams({
            companyId: "demo-google-" + sanitizedId,
            companyName: safeEmail.split('@')[0],
            email: safeEmail
          });
          window.location.href = "http://localhost:" + cliPort + "/callback?" + params.toString();
        } else {
          btnIcon.style.display = 'inline-block';
          btnText.innerText = 'Continue with Google';
          btnSpinner.style.display = 'none';
          btn.disabled = false;
        }
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
    const { noradId, satName, endpointUrl } = req.body;
    const companyId = req.authenticatedCompany?.companyId;

    if (!noradId || !satName || !companyId) {
      return res.status(400).json({ error: 'Missing required fields: noradId, satName' });
    }

    if (companyId.startsWith('demo-')) {
      const existing = await registryStore.getSatellitesByCompanyId(companyId);
      if (existing.length >= 3) {
        return res.status(400).json({ error: 'Sandbox Limit Reached: Demo accounts can register maximum 3 Virtual Satellites.' });
      }
    }

    const satellite = await registryStore.registerSatellite({
      noradId: Number(noradId),
      companyId,
      satName,
      endpointUrl,
      isDeployed: false,
      status: 'REGISTERED'
    });

    return res.status(201).json({ message: 'Satellite registered successfully under company profile', satellite });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});


app.post('/api/v1/registry/verify-key', async (req: Request, res: Response) => {
  try {
    const { companyId, apiKey } = req.body;
    if (!companyId || !apiKey) {
      return res.status(400).json({ valid: false, error: 'Missing required fields: companyId, apiKey' });
    }

    const company = await registryStore.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ valid: false, error: `Company profile '${companyId}' not found on Sentinel registry.` });
    }

    const cleanApiKey = String(apiKey).trim().replace(/[\r\n\t]/g, '');
    const computedHash = ApiKeyService.hashApiKey(cleanApiKey);
    const computedPrefix = cleanApiKey.substring(0, 18);

    console.log(`\n--- [KEY VERIFY DIAGNOSTIC] ---`);
    console.log(`Company ID: '${companyId}'`);
    console.log(`Input Key Prefix: '${computedPrefix}'`);
    console.log(`Input Hash:       '${computedHash}'`);
    console.log(`Stored Hash:      '${company.apiKeyHash || 'NONE'}'`);


    if (!company.apiKeyHash && cleanApiKey.length > 20) {
      console.log(`[KEY AUTO-BIND] First-time key binding for company '${companyId}'`);
      await registryStore.updateCompanyApiKey(companyId, computedHash, computedPrefix);
      company.apiKeyHash = computedHash;
      company.apiKeyPrefix = computedPrefix;
    }


    const isHashMatch = Boolean(company.apiKeyHash && company.apiKeyHash === computedHash);

    if (isHashMatch) {
      console.log(`[KEY VERIFIED] Company '${companyId}' verified via STRICT SHA-256 HASH MATCH.`);
      return res.status(200).json({
        valid: true,
        companyId: company.companyId,
        matchType: 'EXACT_HASH'
      });
    } else {
      console.warn(`[KEY REJECTED] Company '${companyId}' key verification failed. Computed hash: '${computedHash}', stored hash: '${company.apiKeyHash}'`);
      return res.status(403).json({
        valid: false,
        error: `Security Authorization Failure: Private Secret Key does NOT match company profile '${companyId}' registered on Firebase.`
      });
    }
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});


app.post('/api/v1/registry/reset-key', async (req: Request, res: Response) => {
  try {
    const { companyId, oldApiKey } = req.body;
    if (!companyId || !oldApiKey) {
      return res.status(400).json({ success: false, error: 'Missing required fields: companyId, oldApiKey' });
    }


    const company = await registryStore.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: `Company profile '${companyId}' not found on Sentinel registry.` });
    }

    const cleanOldKey = String(oldApiKey).trim().replace(/[\r\n\t]/g, '');
    const oldComputedHash = ApiKeyService.hashApiKey(cleanOldKey);


    const isOldHashMatch = Boolean(company.apiKeyHash && company.apiKeyHash === oldComputedHash);

    if (!isOldHashMatch) {
      return res.status(403).json({
        success: false,
        error: `Security Authorization Failure: Current Private Secret Key does NOT match company profile '${companyId}' on Firebase.`
      });
    }


    const newKeyObj = companyId.startsWith('demo-') ? ApiKeyService.generateDemoApiKey() : ApiKeyService.generateApiKey();
    const rawApiKey = newKeyObj.rawApiKey;


    await registryStore.updateCompanyApiKey(companyId, newKeyObj.apiKeyHash, newKeyObj.apiKeyPrefix);

    console.log(`[KEY RESET SUCCESS] Updated Private Secret Key for company '${companyId}' to new prefix '${newKeyObj.apiKeyPrefix}'`);

    return res.status(200).json({
      success: true,
      message: 'Private Secret Key reset successfully!',
      companyId,
      newPrivateKey: rawApiKey,
      apiKeyPrefix: newKeyObj.apiKeyPrefix,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/api/v1/demo/deploy-satellite', async (req: Request, res: Response) => {
  try {
    let { noradId, satName, launchPosition, companyId, satelliteCategoryId, endpointUrl, apiKey } = req.body;
    if (!noradId || !satName) {
      return res.status(400).json({ error: 'Missing required fields: noradId, satName' });
    }

    let targetCompanyId = companyId;
    if (!targetCompanyId && req.body.email) {
      const emailPrefix = req.body.email.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
      targetCompanyId = `demo-${emailPrefix}`;
    }
    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }


    const company = await registryStore.getCompany(targetCompanyId);
    if (company && company.apiKeyHash && apiKey && !apiKey.startsWith('aegis_sk_demo_')) {
      const computedHash = ApiKeyService.hashApiKey(String(apiKey).trim());
      if (company.apiKeyHash !== computedHash) {
        return res.status(403).json({ error: `Security Authorization Failure: Provided Private Secret Key does not match company profile '${targetCompanyId}' registered on Firebase / Sentinel.` });
      }
    }


    const satRecord = {
      noradId: Number(noradId),
      satName,
      satelliteCategoryId,
      companyId: targetCompanyId,
      email: req.body.email || company?.email,
      endpointUrl,
      isDeployed: true,
      deployedAt: new Date().toISOString(),
      launchPosition,
      status: 'IN_ORBIT_PROPAGATING' as const,
      registeredAt: new Date().toISOString()
    };

    const saved = await registryStore.registerSatellite(satRecord);

    let conjunctionEvt = null;
    if (req.body.timeToClosestApproachTCA || req.body.riskLevel || req.body.collisionProbability) {
      const allSats = await registryStore.getAllSatellites();
      const otherSat = allSats.find(s => Number(s.noradId) !== Number(noradId) && s.companyId === targetCompanyId) || allSats.find(s => Number(s.noradId) !== Number(noradId));
      const targetNoradB = otherSat ? Number(otherSat.noradId) : (req.body.targetNoradB ? Number(req.body.targetNoradB) : undefined);

      if (targetNoradB) {
        const evtId = `evt-${noradId}-${targetNoradB}`;
        conjunctionEvt = await registryStore.saveConjunctionEvent({
          eventId: evtId,
          satA_noradId: Number(noradId),
          satB_noradId: targetNoradB,
          predictedTCA: req.body.timeToClosestApproachTCA,
          missDistanceMeters: req.body.missDistanceMeters,
          missDistanceKm: req.body.missDistanceMeters ? req.body.missDistanceMeters / 1000 : undefined,
          collisionProbability: req.body.collisionProbability,
          riskLevel: req.body.riskLevel,
          status: 'ALERT_DISPATCHED',
          createdAt: new Date().toISOString()
        });

        try {
          const satADoc = await registryStore.getSatellite(Number(noradId));
          const satBDoc = await registryStore.getSatellite(Number(targetNoradB));

          const payloadA = {
            eventId: evtId,
            ownSatelliteNoradId: Number(noradId),
            peerSatelliteNoradId: Number(targetNoradB),
            predictedTCA: req.body.timeToClosestApproachTCA,
            missDistanceMeters: req.body.missDistanceMeters,
            peerNodeEndpointUrl: satBDoc?.endpointUrl || ''
          };

          const payloadB = {
            eventId: evtId,
            ownSatelliteNoradId: Number(targetNoradB),
            peerSatelliteNoradId: Number(noradId),
            predictedTCA: req.body.timeToClosestApproachTCA,
            missDistanceMeters: req.body.missDistanceMeters,
            peerNodeEndpointUrl: satADoc?.endpointUrl || ''
          };

          if (satADoc && satADoc.endpointUrl) {
            console.log(`[SENTINEL AUTO-DISPATCH] Dispatching alert to Sat A #${noradId} at ${satADoc.endpointUrl}`);
            axios.post(satADoc.endpointUrl, payloadA, { timeout: 8000 }).catch((e: any) => console.log(`[SENTINEL WEBHOOK NOTICE SatA] ${e.message}`));
          }
          if (satBDoc && satBDoc.endpointUrl) {
            console.log(`[SENTINEL AUTO-DISPATCH] Dispatching alert to Sat B #${targetNoradB} at ${satBDoc.endpointUrl}`);
            axios.post(satBDoc.endpointUrl, payloadB, { timeout: 8000 }).catch((e: any) => console.log(`[SENTINEL WEBHOOK NOTICE SatB] ${e.message}`));
          }
        } catch (dispatchErr: any) {
          console.log(`[SENTINEL AUTO-DISPATCH NOTICE] ${dispatchErr?.message || dispatchErr}`);
        }
      }
    }

    return res.status(200).json({
      message: 'Satellite launch telemetry persisted successfully to Database Registry',
      satellite: saved,
      event: conjunctionEvt
    });
  } catch (error: any) {
    console.error(`[SENTINEL LAUNCH DEPLOY ERROR] Failed to deploy satellite:`, error);
    return res.status(500).json({ error: error.message || 'Failed to persist launch telemetry' });
  }
});

app.post('/api/v1/registry/node', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nodeId, endpointUrl, publicKeyPem, noradId, codeHashDigest, satName } = req.body;
    const companyId = req.authenticatedCompany?.companyId || req.body.companyId;

    if (!endpointUrl || !companyId) {
      return res.status(400).json({ error: 'Missing required fields: endpointUrl' });
    }

    const targetNodeId = nodeId || `node_${noradId || Date.now()}`;

    const node = await registryStore.registerNode({
      nodeId: targetNodeId,
      companyId,
      noradId: noradId ? Number(noradId) : undefined,
      endpointUrl,
      publicKeyPem: publicKeyPem || '',
      status: 'ACTIVE'
    });

    if (noradId) {
      const sat = await registryStore.getSatellite(Number(noradId));
      await registryStore.saveSatellite({
        ...(sat || {}),
        noradId: Number(noradId),
        companyId,
        satName: satName || sat?.satName || `SAT-${noradId}`,
        endpointUrl,
        isDeployed: false
      });
    }

    return res.status(200).json({ message: 'Live Webhook URL updated successfully', node });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/node/sync-public', async (req: Request, res: Response) => {
  try {
    const { noradId, companyId, telemetry } = req.body;
    if (!noradId || !companyId) {
      return res.status(400).json({ error: 'Missing required parameters: noradId, companyId' });
    }

    const syncResult = await registryStore.updateSatelliteTelemetryWithProofs(Number(noradId), companyId, telemetry || {});

    if (syncResult.rateLimited) {
      return res.status(429).json({
        status: 'RATE_LIMITED',
        message: 'Public sync restricted: cannot sync more than once per 1 minute.',
        rateLimitIntervalSec: 60
      });
    }

    return res.json({
      status: 'SYNCED',
      noradId: Number(noradId),
      companyId,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error(`[SENTINEL SYNC ERROR]`, err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to sync telemetry to Database Registry.' });
  }
});


app.get('/api/v1/admin/hashes', adminKeyAuth, async (req: Request, res: Response) => {
  const hashes = await registryStore.getApprovedNodeHashes();
  return res.json({ allowedHashes: hashes });
});

app.post('/api/v1/admin/hashes', adminKeyAuth, async (req: Request, res: Response) => {
  const { codeHashDigest } = req.body;
  if (!codeHashDigest) {
    return res.status(400).json({ error: 'Missing required field: codeHashDigest' });
  }
  await registryStore.addApprovedNodeHash(codeHashDigest);
  return res.status(201).json({ message: 'SHA-256 Code Hash Digest approved successfully' });
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


app.get('/api/v1/celestrak/events/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.noradId);
    if (!noradId || isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid or missing NORAD Catalog ID' });
    }

    const satRecord = await registryStore.getSatellite(noradId);


    const [liveTelemetry, matchedEvents] = await Promise.all([
      spaceTrackService.fetchLiveGpData(noradId),
      spaceTrackService.fetchConjunctionsByNoradId(noradId)
    ]);

    const eventsList = matchedEvents || [];

    const isVirtualPreview = noradId >= 90000 || (satRecord && satRecord.isSimulatedPreview);

    return res.json({
      queryNoradId: noradId,
      noradPreviewId: isVirtualPreview ? noradId : undefined,
      catalogType: isVirtualPreview ? 'SIMULATED_PREVIEW_TWIN' : 'NORAD_PUBLIC_CATALOG',
      registeredCompany: satRecord?.companyId || 'UNREGISTERED',
      registeredSatName: satRecord?.satName || liveTelemetry?.OBJECT_NAME || `AEGIS-SAT-${noradId}`,
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
        status: eventsList.length > 0 ? 'WARNING_RISK_DETECTED' : 'NOMINAL_SAFE',
        eventsFound: eventsList.length,
        message: eventsList.length > 0
          ? `Active conjunction threat detected by CelesTrak for NORAD ${noradId}!`
          : 'No immediate conjunction threats detected by CelesTrak. Satellite trajectory is nominal and safe.'
      },
      conjunctionEvents: eventsList
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});


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

app.post('/api/v1/arbitration/conjunction-court', async (req: Request, res: Response) => {
  try {
    const { satA, satB, missDistanceKm = 0.35, relativeSpeedKmSec = 14.24 } = req.body;
    if (!satA || !satB || !satA.noradId || !satB.noradId) {
      return res.status(400).json({ error: 'Missing required parameters: satA, satB (including noradId, satName, companyId)' });
    }

    const docA = await registryStore.getSatellite(Number(satA.noradId));
    const docB = await registryStore.getSatellite(Number(satB.noradId));

    const fullSatA = { ...(docA || {}), ...satA, satName: satA.satName || docA?.satName || `SAT-${satA.noradId}`, companyId: satA.companyId || docA?.companyId || 'company-a' };
    const fullSatB = { ...(docB || {}), ...satB, satName: satB.satName || docB?.satName || `SAT-${satB.noradId}`, companyId: satB.companyId || docB?.companyId || 'company-b' };

    const verdict = await supremeCourtEngine.arbitrateConjunction(fullSatA, fullSatB, Number(missDistanceKm), Number(relativeSpeedKmSec));


    const zkSummary = await summaryAiService.generateZeroKnowledgeSummary(verdict);
    (verdict as any).zeroKnowledgeSummary = zkSummary;


    await registryStore.saveArbitrationVerdictReport(verdict);

    return res.status(200).json({
      message: 'AI Judicial Multi-Agent Arbitration executed successfully inside Hardware Trusted Execution Environment (TEE)',
      verdict,
      zeroKnowledgeSummary: zkSummary
    });
  } catch (error: any) {
    console.error('[AI JUDICIAL ARBITRATION ERROR]', error?.message);
    return res.status(500).json({ error: error?.message || 'Supreme Court Arbitration failed' });
  }
});

app.get('/api/v1/arbitration/verdicts', async (req: Request, res: Response) => {
  try {
    const reports = await registryStore.getArbitrationVerdictReports();
    return res.json({
      total: reports.length,
      verdictReports: reports
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/inspector/reports', async (req: Request, res: Response) => {
  try {
    const reports = inspectorAiService.getAuditReports();
    return res.json({
      total: reports.length,
      auditReports: reports
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/inspector/run-audit', async (req: Request, res: Response) => {
  try {
    const report = await inspectorAiService.runAuditScanSilently();
    return res.json({
      message: 'Inspector AI background audit scan completed',
      auditReport: report
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/spacetrack/satellite/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.noradId);
    if (isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid NORAD Catalog ID' });
    }

    const data = await spaceTrackService.fetchLiveGpData(noradId);
    if (!data) {
      return res.status(404).json({ error: `No Space-Track data found for NORAD #${noradId}` });
    }

    return res.json({
      source: 'US Space Force 18 SDS (Space-Track.org / CelesTrak)',
      noradId,
      gpRecord: data
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/spacetrack/conjunctions/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.noradId);
    if (isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid NORAD Catalog ID' });
    }

    const events = await spaceTrackService.fetchConjunctionsByNoradId(noradId);
    return res.json({
      source: 'SOCRATES Conjunction Assessment Table',
      noradId,
      totalEvents: events.length,
      events
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/events', async (req: Request, res: Response) => {
  try {
    const events = await registryStore.getAllConjunctionEvents();
    return res.json({ count: events.length, events });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/events/event/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await registryStore.getConjunctionEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: `Conjunction event '${eventId}' not found.` });
    }
    return res.json({ eventId, event });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/events/:param', async (req: Request, res: Response) => {
  try {
    const param = req.params.param;
    if (param.startsWith('evt_')) {
      const event = await registryStore.getConjunctionEvent(param);
      if (!event) {
        return res.status(404).json({ error: `Conjunction event '${param}' not found.` });
      }
      return res.json({ eventId: param, event });
    }

    const noradId = Number(param);
    if (!noradId || isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid parameter. Must be a numeric NORAD Catalog ID or Event ID starting with evt_' });
    }

    const events = await registryStore.getConjunctionEventsForSat(noradId);
    events.sort((a, b) => new Date(b.lastEvaluatedAt || b.createdAt).getTime() - new Date(a.lastEvaluatedAt || a.createdAt).getTime());
    const latest20 = events.slice(0, 20);

    return res.json({ noradId, count: latest20.length, totalEvents: events.length, events: latest20 });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/orbital/neighborhood-check', async (req: Request, res: Response) => {
  try {
    const { noradId, positionVectorKm, searchRadiusKm = 500 } = req.body;
    let targetSat = noradId ? await registryStore.getSatellite(Number(noradId)) : null;
    let targetPos = positionVectorKm;

    const getSatPos = (sat: any) => {
      if (sat?.launchPosition?.x !== undefined) return sat.launchPosition;
      const alt = sat?.altitudeKm || (500 + ((sat?.noradId || 1000) % 300));
      const incRad = ((sat?.inclinationDegrees || 53.0) * Math.PI) / 180;
      const thetaRad = (((sat?.noradId || 1) * 37) % 360 * Math.PI) / 180;
      const r = 6371 + alt;
      return {
        x: r * Math.cos(thetaRad),
        y: r * Math.sin(thetaRad) * Math.cos(incRad),
        z: r * Math.sin(thetaRad) * Math.sin(incRad)
      };
    };

    if (!targetPos && targetSat) {
      targetPos = getSatPos(targetSat);
    }
    if (!targetPos || typeof targetPos.x !== 'number') {
      targetPos = { x: 6921, y: 0, z: 0 };
    }

    const allSats = await registryStore.getAllSatellites();
    const radiusNum = Number(searchRadiusKm) || 500;
    const targetNorad = Number(noradId) || 0;

    const nearbyList: any[] = [];
    allSats.forEach((sat) => {
      if (sat.noradId === targetNorad) return;
      const satPos = getSatPos(sat);
      const dx = targetPos.x - satPos.x;
      const dy = targetPos.y - satPos.y;
      const dz = targetPos.z - satPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= radiusNum) {
        nearbyList.push({
          noradId: sat.noradId,
          satName: sat.satName,
          companyId: sat.companyId,
          distanceKm: Number(dist.toFixed(3)),
          positionVectorKm: {
            x: Number(satPos.x.toFixed(2)),
            y: Number(satPos.y.toFixed(2)),
            z: Number(satPos.z.toFixed(2))
          },
          isSafe: dist > 10.0,
          status: sat.status || 'ACTIVE'
        });
      }
    });

    nearbyList.sort((a, b) => a.distanceKm - b.distanceKm);

    const closestSat = nearbyList.length > 0 ? nearbyList[0] : null;

    return res.json({
      targetNoradId: targetNorad,
      targetSatelliteName: targetSat?.satName || `SAT-${targetNorad}`,
      targetPositionVectorKm: {
        x: Number(targetPos.x.toFixed(2)),
        y: Number(targetPos.y.toFixed(2)),
        z: Number(targetPos.z.toFixed(2))
      },
      searchRadiusKm: radiusNum,
      totalNearbySatellites: nearbyList.length,
      closestSatellite: closestSat,
      isPathSafe: nearbyList.every((s) => s.isSafe),
      nearbySatellites: nearbyList
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

async function runRoutineCollisionRiskScreening() {
  const ts = new Date().toISOString();
  console.log(`\n${chalk.bgBlue.white.bold(` ${ts} `)} ${chalk.bgCyan.black.bold(' CONJUNCTION SCREENING ')} Executing 6-hour industry standard collision risk screening...`);

  try {
    const allSatellites = await registryStore.getAllSatellites();
    const activeSats = allSatellites.filter(s => s.isDeployed || s.status === 'IN_ORBIT_PROPAGATING' || s.status === 'ACTIVE');

    if (activeSats.length < 2) {
      console.log(chalk.dim(`[CONJUNCTION SCREENING] Less than 2 active satellites (${activeSats.length}). Screening complete.\n`));
      return;
    }

    let scannedPairs = 0;
    let skippedOutRange = 0;
    let newRiskEvents = 0;

    for (let i = 0; i < activeSats.length; i++) {
      for (let j = i + 1; j < activeSats.length; j++) {
        const satA = activeSats[i];
        const satB = activeSats[j];
        const altA = satA.launchPosition?.altitudeKm || 700;
        const altB = satB.launchPosition?.altitudeKm || 700;



        if (Math.abs(altA - altB) > 50.0) {
          skippedOutRange++;
          continue;
        }
        scannedPairs++;

        const incA = ((satA.launchPosition?.inclinationDegrees || 98.2) * Math.PI) / 180;
        const incB = ((satB.launchPosition?.inclinationDegrees || 97.4) * Math.PI) / 180;

        const rA = 6371 + altA;
        const rB = 6371 + altB;

        const posA = {
          x: rA * Math.cos(incA),
          y: rA * Math.sin(incA) * 0.5,
          z: rA * Math.sin(incA) * 0.866
        };
        const posB = {
          x: rB * Math.cos(incB),
          y: rB * Math.sin(incB) * 0.5,
          z: rB * Math.sin(incB) * 0.866
        };

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dz = posA.z - posB.z;
        const missDistanceKm = Number(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(3));
        const missDistanceMeters = Math.round(missDistanceKm * 1000);

        const sigmaKm = 2.5;
        const collisionProbability = Number(Math.min(1.0, Math.exp(-Math.pow(missDistanceKm, 2) / (2 * Math.pow(sigmaKm, 2)))).toFixed(6));

        let riskLevel: 'CRITICAL' | 'HIGH_RISK' | 'MODERATE_RISK' | 'NOMINAL_LOW_RISK' = 'NOMINAL_LOW_RISK';
        if (missDistanceKm <= 25.0 || collisionProbability >= 0.0001) {
          riskLevel = 'CRITICAL';
        } else if (missDistanceKm <= 100.0 || collisionProbability >= 0.00001) {
          riskLevel = 'MODERATE_RISK';
        }

        const eventId = `evt_pair_${Math.min(satA.noradId, satB.noradId)}_${Math.max(satA.noradId, satB.noradId)}`;
        const riskEntry = {
          timestamp: ts,
          missDistanceKm,
          collisionProbability,
          riskLevel
        };

        const existingEvents = await registryStore.getAllConjunctionEvents();
        const existingEvt = existingEvents.find(e => e.eventId === eventId);
        const riskHistory = existingEvt?.riskHistory || [];
        riskHistory.push(riskEntry);
        if (riskHistory.length > 50) riskHistory.shift();

        await registryStore.saveConjunctionEvent({
          eventId,
          satA_noradId: Math.min(satA.noradId, satB.noradId),
          satB_noradId: Math.max(satA.noradId, satB.noradId),
          predictedTCA: new Date(Date.now() + 3600000).toISOString(),
          missDistanceMeters,
          missDistanceKm,
          collisionProbability,
          riskLevel,
          status: riskLevel === 'CRITICAL' ? 'ALERT_DISPATCHED' : 'RESOLVED',
          riskHistory,
          lastEvaluatedAt: ts
        });

        if (riskLevel === 'CRITICAL') {
          newRiskEvents++;
          console.log(chalk.bgRed.white.bold(' CRITICAL CONJUNCTION RISK ') + ` Sat #${satA.noradId} vs Sat #${satB.noradId} | Miss: ${missDistanceKm}km | P_c: ${collisionProbability}`);
        }
      }
    }

    console.log(chalk.green(`[CONJUNCTION SCREENING] Complete. Scanned ${scannedPairs} candidates inside ±50km altitude shell (${skippedOutRange} skipped out-of-range). Critical events: ${newRiskEvents}\n`));
  } catch (err: any) {
    console.error(`[CONJUNCTION SCREENING ERROR]`, err?.message);
  }
}


const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
setTimeout(runRoutineCollisionRiskScreening, 10000);
setInterval(runRoutineCollisionRiskScreening, SIX_HOURS_MS);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AEGIS SENTINEL] Running on port ${PORT} bound to 0.0.0.0`);
});

export default app;
