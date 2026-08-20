import { Firestore } from '@google-cloud/firestore';

async function listCompanies() {
  const firestore = new Firestore({ projectId: 'wachsen-9313a' });
  const snapshot = await firestore.collection('companies').get();

  console.log('========================================================================');
  console.log('  🔥 FIRESTORE DATABASE (wachsen-9313a) - COMPANIES COLLECTION  ');
  console.log('========================================================================\n');

  if (snapshot.empty) {
    console.log('No documents found in companies collection.');
    return;
  }

  snapshot.forEach((doc) => {
    console.log(`Document ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log('------------------------------------------------------------------------');
  });
}

listCompanies().catch(console.error);
