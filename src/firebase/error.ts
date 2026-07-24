import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const rawMessage = error instanceof Error ? error.message : String(error);
  
  // Create a user-friendly message based on common Firebase errors
  let friendlyMessage = 'Terjadi kesalahan koneksi ke server. Silakan coba lagi.';
  
  if (rawMessage.includes('requires an index') || rawMessage.includes('index')) {
    friendlyMessage = 'Kueri Firestore membutuhkan indeks komposit.';
  } else if (rawMessage.includes('offline')) {
    friendlyMessage = 'Koneksi internet terganggu atau server tidak dapat dijangkau. Pastikan sinyal Anda stabil.';
  } else if (rawMessage.includes('permission-denied')) {
    friendlyMessage = 'Akses ditolak. Mohon hubungi admin jika masalah berlanjut.';
  } else if (rawMessage.includes('not-found')) {
    friendlyMessage = 'Data tidak ditemukan.';
  } else if (rawMessage.includes('already-exists')) {
    friendlyMessage = 'Data sudah terdaftar di sistem.';
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  
  console.error('Firestore Operation Failed:', JSON.stringify(errInfo, null, 2));
  
  // Throw the friendly message but keep the tech details in a property if needed
  const enhancedError = new Error(friendlyMessage);
  (enhancedError as any).details = errInfo;
  throw enhancedError;
}
