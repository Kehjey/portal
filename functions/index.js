const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const bcrypt = require('bcryptjs');

initializeApp();

const db = getFirestore();
const auth = getAuth();

exports.loginStudent = onCall(async (request) => {
    const studentId = String(request.data?.studentId || '').trim();
    const password = String(request.data?.password || '');

    if (!studentId || !password) {
        throw new HttpsError('invalid-argument', 'Student ID and password are required.');
    }

    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
        throw new HttpsError('permission-denied', 'Invalid Student ID or password.');
    }

    const student = studentSnap.data();

    if (student.active === false) {
        throw new HttpsError('permission-denied', 'This account is inactive.');
    }

    const passwordMatches = await bcrypt.compare(password, student.passwordHash);

    if (!passwordMatches) {
        throw new HttpsError('permission-denied', 'Invalid Student ID or password.');
    }

    const customToken = await auth.createCustomToken(studentId, {
        studentId,
        role: 'student',
    });

    return {
        token: customToken,
        name: student.name || studentId,
    };
});
