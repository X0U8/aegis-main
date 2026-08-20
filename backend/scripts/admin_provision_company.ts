import { registryStore } from '../src/services/registryStore';
import { ApiKeyService } from '../src/services/apiKeyService';

async function provisionEnterpriseCompany() {
  const args = process.argv.slice(2);
  const companyId = args[0] || 'comp-planet-enterprise';
  const name = args[1] || 'Planet Labs PBC';
  const domain = args[2] || 'planet.com';

  console.log('================================================================');
  console.log('  🛡️ AEGIS ADMIN CLI — PROVISION ENTERPRISE SATELLITE OPERATOR ');
  console.log('================================================================\n');

  const { rawApiKey, apiKeyHash, apiKeyPrefix } = ApiKeyService.generateApiKey();

  const company = await registryStore.registerCompany({
    companyId,
    name,
    domain,
    isVerified: true,
    apiKeyHash,
    apiKeyPrefix
  });

  console.log('✅ COMPANY PROVISIONED SUCCESSFULLY IN GOOGLE CLOUD FIRESTORE:');
  console.log('   Company ID:', company.companyId);
  console.log('   Company Name:', company.name);
  console.log('   Domain:', company.domain);
  console.log('   API Key Prefix:', company.apiKeyPrefix);
  console.log('   Verification Status: VERIFIED & RESTRICTED');
  console.log('\n🔑 PRIVATE API SECRET KEY (Provide securely to Operator):');
  console.log(`   ${rawApiKey}`);
  console.log('\n================================================================');
}

provisionEnterpriseCompany().catch(console.error);
