# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name your project (e.g., "opal-appointments")
4. Disable Google Analytics (optional for this app)
5. Click "Create project"

## Step 2: Setup Firestore Database

1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in test mode" (for now)
4. Select a location (choose one close to your users)
5. Click "Done"

## Step 3: Setup Web App

1. Click the web icon (</>) in your project overview
2. Register your app with a nickname (e.g., "OPAL Web App")
3. Check "Also set up Firebase Hosting" if you want to use Firebase hosting
4. Click "Register app"

## Step 4: Get Configuration

Copy the configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Step 5: Update Your Code

Replace the configuration in `src/firebase.js` with your actual Firebase config.

## Step 6: Test Your App

1. Run your development server: `npm run dev`
2. Open your app and try creating an appointment
3. Check the Firebase console under "Firestore Database" to see if data is saved

## Step 7: Security Rules (Important!)

In Firebase Console > Firestore Database > Rules, replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appointments/{document} {
      allow read, write: if true;
    }
  }
}
```

Note: These rules allow anyone to read/write. For production, you should add authentication.

## Step 8: Deploy to Production

1. Build your app: `npm run build`
2. Deploy to your hosting service (Netlify with your domain)
3. Your appointments will now sync between all devices!

## Troubleshooting

- If you see "Firebase not configured" errors, check that your config is correct
- If data doesn't sync, check browser console for errors
- Make sure Firestore rules allow read/write access
