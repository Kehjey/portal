
Files to be added: 
    1. intro audio files -> intro1/2/3/4.mp3
    2. click.mp3 and pull.mp3



Things to be done:
    1. Add sound trigger for book a session display
    2. add material to process section
    3.

Firebase student login setup:
    1. Create a Firebase project and enable Authentication + Firestore
    2. Copy firebase-config.example.js to firebase-config.js and paste your web app config
    3. Install Firebase CLI: npm install -g firebase-tools
    4. Run: firebase login && firebase use <your-project-id>
    5. Deploy backend: firebase deploy --only functions,firestore:rules
    6. Add students to Firestore:
       - Download service account JSON to scripts/service-account.json
       - cd scripts && npm install
       - node add-student.js <studentId> <password> "<name>"
    7. Deploy site: firebase deploy --only hosting

Firestore student document shape:
    students/{studentId}
      name: string
      passwordHash: string (bcrypt)
      active: boolean


 To add new students, you run the add-student.js script from your terminal.
  Here is a quick reminder of the commands:
  ### 1. Open your terminal in the  scripts  directory
    cd D:\maths\Website\scripts

  ### 2. Run the script with your student details
  Use this syntax:
    node add-student.js <studentId> <password> "<displayName>"
  ### Examples:
  • To add student  STU002  with password  chemistry456  named  Alex :
    node add-student.js STU002 chemistry456 "Alex"
  • To add student  STU003  with password  physics789  named  Priya :
    node add-student.js STU003 physics789 "Priya"
  ──────
  ### What the script does under the hood:
  1. It registers the student credentials securely in Firebase Authentication using their ID (e.g. creating user
  stu002@portal.local ).
  2. It automatically maps their student name to their profile.
  3. It creates/updates a document in your Firestore  students  collection with their metadata.