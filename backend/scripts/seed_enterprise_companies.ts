import { registryStore } from '../src/services/registryStore';
import { ApiKeyService } from '../src/services/apiKeyService';

async function seedEnterpriseCompanies() {
  console.log('================================================================');
  console.log('  🛡️ AEGIS ADMIN CLI — SEED ENTERPRISE SATELLITE OPERATORS      ');
  console.log('================================================================\n');

  const enterpriseCompanies = [
    { companyId: 'comp-glixar', name: 'Glixar Space', domain: 'glixar.space' },
    { companyId: 'comp-planet', name: 'Planet Labs PBC', domain: 'planet.com' },
    { companyId: 'comp-spacex', name: 'SpaceX Starlink', domain: 'spacex.com' },
    { companyId: 'comp-oneweb', name: 'OneWeb Satellites', domain: 'oneweb.net' }
  ];

  const provisionedResults: any[] = [];

  for (const c of enterpriseCompanies) {
    const { rawApiKey, apiKeyHash, apiKeyPrefix } = ApiKeyService.generateApiKey();

    const company = await registryStore.registerCompany({
      companyId: c.companyId,
      name: c.name,
      domain: c.domain,
      isVerified: true,
      apiKeyHash,
      apiKeyPrefix
    });

    provisionedResults.push({
      companyId: company.companyId,
      name: company.name,
      domain: company.domain,
      apiKeyPrefix: company.apiKeyPrefix,
      privateApiKey: rawApiKey
    });
  }

  console.log('✅ ENTERPRISE OPERATORS PROVISIONED LIVE IN GOOGLE CLOUD FIRESTORE:\n');
  
  provisionedResults.forEach((res, index) => {
    console.log(`[${index + 1}] ${res.name.toUpperCase()}`);
    console.log(`    Company ID: ${res.companyId}`);
    console.log(`    Domain: ${res.domain}`);
    console.log(`    API Key Prefix: ${res.apiKeyPrefix}`);
    console.log(`    🔑 PRIVATE API SECRET KEY:`);
    console.log(`       ${res.privateApiKey}\n`);
  });

  console.log('================================================================');
  console.log('  🎉 All enterprise companies successfully registered & ready!  ');
  console.log('================================================================');
}

seedEnterpriseCompanies().catch(console.error);
