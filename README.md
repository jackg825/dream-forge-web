# Dream Forge - Photo to 3D Model

Transform your photos into stunning 3D models using AI technology.

## Features

- **Photo Upload**: Drag-and-drop or click to upload JPG, PNG, or WEBP images
- **AI Generation**: Powered by Rodin Gen-2 for high-quality 3D model generation
- **3D Preview**: Interactive Three.js viewer with rotation, zoom, and pan
- **Multiple Formats**: Download as GLB, OBJ, FBX, or STL
- **Credit System**: 3 free credits for new users
- **User Dashboard**: Track generations and manage your models

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **3D Rendering**: Three.js, @react-three/fiber, @react-three/drei
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage
- **Auth**: Firebase Authentication (Google + Email)
- **AI**: Rodin Gen-2 API (Hyper3D)

## Project Structure

```
dream-forge/
├── app/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Firebase, utilities
│   │   ├── hooks/         # Custom hooks
│   │   └── types/         # TypeScript types
│   └── public/
├── functions/              # Cloud Functions
│   └── src/
│       ├── handlers/      # Function handlers
│       ├── rodin/         # Rodin API client
│       └── utils/         # Utilities
├── firebase.json
├── firestore.rules
└── storage.rules
```

## Setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project (Blaze plan for Cloud Functions)
- Rodin API key from Hyper3D

### 1. Clone and Install

```bash
git clone <repo-url>
cd dream-forge

# Install frontend dependencies
cd app && npm install

# Install functions dependencies
cd ../functions && npm install
```

### 2. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable services:
   - Authentication (Email/Password + Google provider)
   - Cloud Firestore
   - Cloud Storage
   - Cloud Functions
3. Create a web app and copy config values

### 3. Environment Configuration

**Frontend (app/.env.local)**:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Cloud Functions**:
```bash
firebase functions:secrets:set RODIN_API_KEY
# Enter your Rodin API key when prompted
```

### 4. Update Firebase Project ID

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### 5. Deploy Security Rules

```bash
firebase deploy --only firestore:rules,storage
```

### 6. Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 7. Run Development Server

```bash
cd app
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### Full Deployment

```bash
firebase deploy
```

### Individual Services

```bash
# Frontend only
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Security rules only
firebase deploy --only firestore:rules,storage
```

## Usage

1. **Sign Up**: Create an account with Google or email (3 free credits)
2. **Upload**: Drag and drop a photo (512-4096px, max 10MB)
3. **Select Quality**: Choose Quick, Balanced, or Premium
4. **Generate**: Click "Generate 3D Model" and wait
5. **Preview**: View your 3D model in the interactive viewer
6. **Download**: Save in your preferred format

## API Reference

### Cloud Functions

- `generateModel`: Starts a 3D generation job
- `checkJobStatus`: Polls job status and handles completion
- `onUserCreate`: Creates user document with initial credits

## License

MIT
