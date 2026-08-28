import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { PlatformConfig } from '../types/satellite';


async function getCryptoKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('aegis_orbital_salt_2026'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}


export async function encryptPayload(data: object, passphrase = 'aegis_secret_key'): Promise<{ ciphertext: string; iv: string }> {
  const key = await getCryptoKey(passphrase);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}


export async function generateSignature(data: string, secret = 'aegis_hmac_secret'): Promise<string> {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}


export async function saveEncryptedSatelliteToFirestore(
  satelliteId: string,
  config: PlatformConfig,
  userId = 'sandbox_user',
  userEmail = ''
): Promise<string> {
  try {
    const { ciphertext, iv } = await encryptPayload(config);
    const signatureToken = await generateSignature(ciphertext);
    const noradId = Math.floor(10000 + Math.random() * 89999);

    const docId = String(noradId);
    const satelliteDocRef = doc(db, 'satellites', docId);
    await setDoc(satelliteDocRef, {
      noradId,
      satelliteId,
      satName: config.name,
      companyId: 'demo-glixar-3192',
      endpointUrl: 'http://localhost:4001/webhook',
      encryptedPayload: ciphertext,
      iv,
      signatureToken,
      ownerUid: userId,
      ownerEmail: userEmail,
      createdAt: serverTimestamp(),
      publicMeta: {
        name: config.name,
        material: config.material,
        status: 'IN_ORBIT_PROPAGATING',
        encryptedAtRest: true,
      },
    }, { merge: true });

    return satelliteDocRef.id;
  } catch (error) {
    console.warn('Firestore write warning (Sandbox mode active):', error);
    return satelliteId;
  }
}
