/**
 * Add a student to Firebase Auth + Firestore.
 *
 * Setup:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save the JSON file as scripts/service-account.json
 *   3. cd scripts && npm install
 *   4. node add-student.js <studentId> <password> [displayName]
 *
 * Example:
 *   node add-student.js STU001 algebra123 "Alex Kumar"
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Missing scripts/service-account.json');
    console.error('Download it from Firebase Console → Project settings → Service accounts.');
    process.exit(1);
}

const [, , studentId, password, displayName] = process.argv;

if (!studentId || !password) {
    console.error('Usage: node add-student.js <studentId> <password> [displayName]');
    process.exit(1);
}

initializeApp({
    credential: cert(require('./service-account.json')),
});

const db = getFirestore('default');
const auth = getAuth();

async function addStudent() {
    // Generate a secure virtual email for this student ID to authenticate via Email/Password Auth.
    const email = `${studentId.toLowerCase()}@portal.local`;
    
    let userRecord;
    try {
        // Check if user already exists
        userRecord = await auth.getUser(studentId);
        // If exists, update credentials
        await auth.updateUser(studentId, {
            email,
            password,
            displayName: displayName || studentId,
            disabled: false // Make sure the user is enabled
        });
        console.log(`Updated Auth credentials for student "${studentId}".`);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            // Create a new user with studentId as the UID
            userRecord = await auth.createUser({
                uid: studentId,
                email,
                password,
                displayName: displayName || studentId,
            });
            console.log(`Created Auth user for student "${studentId}".`);
        } else {
            throw error;
        }
    }

    // Save additional profile details in Firestore
    await db.collection('students').doc(studentId).set({
        name: displayName || studentId,
        email,
        active: true,
        createdAt: new Date().toISOString(),
    });

    console.log(`Student profile for "${studentId}" successfully configured in Firestore.`);
}

addStudent().catch((error) => {
    console.error(error);
    process.exit(1);
});
