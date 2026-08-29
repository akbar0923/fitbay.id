const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAILS = ['muhbar@fitbay.id', 'nessa@fitbay.id', 'akbar@fitbay.id', 'nesa@fitbay.id', 'admin@admin.id'];

/**
 * Helper: Cek apakah pemanggil adalah Admin
 */
async function verifyIsAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Permintaan harus menyertakan autentikasi login.'
    );
  }

  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (ADMIN_EMAILS.includes(callerEmail)) {
    return true;
  }

  // Cek role di Firestore
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Hanya Super Admin yang diizinkan melakukan operasi ini.'
    );
  }

  return true;
}

/**
 * Cloud Function: Tambah User Baru oleh Super Admin
 */
exports.createUserByAdmin = functions.https.onCall(async (data, context) => {
  await verifyIsAdmin(context);

  const { name, username, password, role, title } = data;
  const cleanUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  
  if (!cleanUsername) {
    throw new functions.https.HttpsError('invalid-argument', 'Username wajib diisi.');
  }

  if (!password || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password minimal 6 karakter.');
  }

  const emailDomain = process.env.VITE_AUTH_EMAIL_DOMAIN || 'fitbay.id';
  const email = `${cleanUsername}@${emailDomain}`;

  try {
    // 1. Buat user di Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name || cleanUsername,
    });

    // 2. Buat dokumen profil di Firestore
    const userProfile = {
      name: name.trim(),
      username: cleanUsername,
      email: email,
      role: role === 'admin' ? 'admin' : 'staff',
      title: title?.trim() || (role === 'admin' ? 'Admin' : 'Staff Fitbay'),
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: context.auth.token.email || 'superadmin',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userRecord.uid).set(userProfile);

    return {
      success: true,
      uid: userRecord.uid,
      user: userProfile,
    };
  } catch (error) {
    console.error('Error creating user by admin:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Reset Password User oleh Super Admin
 */
exports.resetPasswordByAdmin = functions.https.onCall(async (data, context) => {
  await verifyIsAdmin(context);

  const { uid, newPassword } = data;

  if (!uid || !newPassword || newPassword.length < 6) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID dan password baru (min. 6 karakter) wajib disertakan.'
    );
  }

  try {
    await auth.updateUser(uid, {
      password: newPassword,
    });

    await db.collection('users').doc(uid).update({
      passwordUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: 'Password user berhasil diubah.' };
  } catch (error) {
    console.error('Error resetting user password:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Hapus User oleh Super Admin
 */
exports.deleteUserByAdmin = functions.https.onCall(async (data, context) => {
  await verifyIsAdmin(context);

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID wajib disertakan.');
  }

  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Super Admin tidak dapat menghapus akunnya sendiri.'
    );
  }

  try {
    // Hapus dari Auth
    try {
      await auth.deleteUser(uid);
    } catch (authErr) {
      console.warn('Auth user not found or already deleted:', authErr);
    }

    // Hapus dari Firestore
    await db.collection('users').doc(uid).delete();

    return { success: true, message: 'Akun pengguna berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Set Status User (Aktif / Nonaktif)
 */
exports.setUserStatusByAdmin = functions.https.onCall(async (data, context) => {
  await verifyIsAdmin(context);

  const { uid, status } = data;
  if (!uid || !['active', 'inactive'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Status harus "active" atau "inactive".');
  }

  try {
    // Nonaktifkan di Firebase Auth juga
    await auth.updateUser(uid, {
      disabled: status === 'inactive',
    });

    await db.collection('users').doc(uid).update({
      status: status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, status };
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
