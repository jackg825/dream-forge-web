# CLAUDE.md - Dream Forge Project Guide

## Project Overview

Dream Forge is a Photo-to-3D MVP application that transforms photos into printable 3D models using AI technology.

## Tech Stack

### Frontend (`app/`)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.7 | React framework with App Router |
| React | 19.2.1 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling (PostCSS config) |
| Three.js | 0.181.2 | 3D rendering |
| @react-three/fiber | 9.4.0 | React Three.js integration |
| @react-three/drei | 10.7.7 | Three.js utilities |
| Firebase | 12.6.0 | Auth, Firestore, Storage |
| Zustand | 5.0.8 | State management |
| React Query | 5.90.11 | Server state management |
| next-intl | 4.5.6 | Internationalization |
| Radix UI | Various | Accessible UI components |

### Backend (`functions/`)

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 | Runtime |
| firebase-admin | 13.6.0 | Firebase Admin SDK |
| firebase-functions | 7.0.1 | Cloud Functions |
| axios | 1.6.0 | HTTP client |
| @aws-sdk/client-s3 | 3.943.0 | S3 storage operations |
| tencentcloud-sdk-nodejs | 4.1.152 | Tencent Cloud (Hunyuan) |

### External Services

- **Rodin Gen-2 API** (Hyper3D) - Primary 3D generation
- **Tripo API** - Alternative 3D provider
- **Meshy API** - Alternative 3D provider
- **Google Gemini** - Image analysis
- **Tencent Hunyuan** - Image analysis (Chinese)
- **Firebase** - Auth, Firestore, Storage, Hosting

## Project Structure

```
dream-forge/
├── app/                          # Next.js 16 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/        # i18n routing (en/zh)
│   │   │   │   ├── (main)/      # Main app routes
│   │   │   │   ├── admin/       # Admin panel
│   │   │   │   ├── auth/        # Authentication
│   │   │   │   ├── dashboard/   # User dashboard
│   │   │   │   └── viewer/      # 3D model viewer
│   │   │   ├── globals.css      # Tailwind v4 styles
│   │   │   └── layout.tsx       # Root layout
│   │   ├── components/          # React components
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── upload/          # Image upload components
│   │   │   ├── viewer/          # 3D viewer components
│   │   │   └── ...
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities & Firebase
│   │   ├── config/              # App configuration
│   │   ├── i18n/                # i18n configuration
│   │   ├── messages/            # Translation files
│   │   └── types/               # TypeScript types
│   └── public/
├── functions/                    # Cloud Functions
│   └── src/
│       ├── handlers/            # Function handlers
│       ├── rodin/               # Rodin API client
│       ├── gemini/              # Gemini API client
│       ├── providers/           # Multi-provider support
│       ├── storage/             # Storage utilities
│       └── utils/               # Shared utilities
├── workers/                      # Cloudflare Workers
├── scripts/                      # Utility scripts
├── docs/                         # Documentation
├── firebase.json                 # Firebase config
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore indexes
└── storage.rules                # Storage security rules
```

## Development Commands

```bash
# Frontend development
cd app && npm run dev

# Build frontend
cd app && npm run build

# Functions development
cd functions && npm run build:watch

# Deploy all
firebase deploy

# Deploy specific services
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage

# View function logs
firebase functions:log
```

## Environment Variables

### Frontend (`app/.env.local`)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Functions (Firebase Secrets)

```bash
firebase functions:secrets:set RODIN_API_KEY
firebase functions:secrets:set TRIPO_API_KEY
firebase functions:secrets:set MESHY_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set HUNYUAN_SECRET_ID
firebase functions:secrets:set HUNYUAN_SECRET_KEY
```

## Key Patterns

### Internationalization (i18n)

- Uses `next-intl` with `[locale]` dynamic routing
- Supported locales: `en`, `zh`
- Translation files in `app/src/messages/`
- Use `useTranslations()` hook for client components
- Use `getTranslations()` for server components

### Component Architecture

- Uses Radix UI primitives with shadcn/ui styling
- Tailwind CSS v4 with PostCSS configuration
- Components in `app/src/components/ui/`

### State Management

- **Zustand** for client-side state
- **React Query** for server state and caching
- **Firebase onSnapshot** for real-time updates

### 3D Rendering

- Three.js via `@react-three/fiber`
- GLB/GLTF model loading with `useGLTF`
- OrbitControls for user interaction
- Environment presets from `@react-three/drei`

## Firestore Collections

- `users/{userId}` - User profiles and credits
- `jobs/{jobId}` - 3D generation jobs
- `transactions/{txId}` - Credit transactions

## Cloud Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `onUserCreate` | Auth onCreate | Initialize user with credits |
| `generateModel` | HTTPS Callable | Start 3D generation |
| `checkJobStatus` | HTTPS Callable | Poll job status |
| `analyzeImage` | HTTPS Callable | AI image analysis |

## Important Notes

- **Next.js 16** uses the new App Router exclusively
- **React 19** supports new features like `use()` hook
- **Tailwind v4** uses CSS-based configuration
- **Firebase v12** has updated modular API patterns
- Always use `'use client'` directive for client components with hooks
