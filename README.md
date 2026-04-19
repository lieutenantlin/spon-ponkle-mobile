# Microplastics Water Quality Scanner

Mobile application for field researchers to capture water sample images, record GPS coordinates and environmental metadata, run on-device microplastic analysis via an Arduino UNO Q edge device, and sync results to a backend for aggregation and reporting.

**This is an MVP scaffold**. Core mobile functionality (navigation, forms, camera capture, GPS, local storage) is implemented. ML inference, hardware communication, and backend sync are mocked and ready for integration.

## Quick Start

```bash
# Install dependencies
bun install

# Run with Metro for simulator/dev client
bun run start

# Run in web browser (development preview)
bun run start-web
```

## Running On A Physical Phone

There are two different native app modes in this project:

- `bun run start` starts a development server. Any debug/dev-client build installed on your phone expects this server to be running.
- A release build embeds the JavaScript bundle into the app, so it launches on the phone without Metro.

If you install the app to a phone and see a bare wrapper or a `No development server found` message, you installed a debug/dev-client build.

Use one of these flows instead:

```bash
# Dev client on a phone: keep Metro running, then open the installed app
bun run start
bun run ios:device

# Self-contained iPhone build: embeds the JS bundle
bun run ios:device:release

# Self-contained Android build: embeds the JS bundle
bun run android:release
```

For Bluetooth testing on a real device, prefer the release-device build unless you specifically need live reload and are willing to keep Metro running.

## Features

- **Scan workflow**: Capture sample image → record GPS + metadata → send to edge device → view microplastic estimate → save locally or upload to backend
- **Dashboard**: Device connection status, scan statistics, recent samples, quick actions
- **History**: Searchable list of all recorded samples with filter by water source
- **Settings**: Device pairing, sync configuration, account management
- **Offline-first**: All data stored locally in AsyncStorage; sync when connected

## Architecture

### Navigation Structure

```
app/
├── _layout.tsx              # Root: providers, auth gate, stack navigator
├── login.tsx                # Auth placeholder
├── +not-found.tsx           # 404 fallback
│
├── (tabs)/                  # Bottom tab navigator
│   ├── _layout.tsx          # Tab bar: Home, History, New Scan, Settings
│   ├── (home)/             # Home stack
│   │   ├── _layout.tsx
│   │   └── index.tsx       # Dashboard
│   ├── history.tsx          # Sample list
│   ├── new-scan.tsx        # Workflow intro / CTA
│   └── settings.tsx         # Device, sync, account
│
├── scan/                    # Root stack: scan workflow (overlays tabs)
│   ├── _layout.tsx
│   ├── capture.tsx         # Camera capture
│   ├── metadata.tsx         # GPS + form
│   ├── processing.tsx      # Analysis loading
│   └── result.tsx         # Results + save/upload
│
└── sample/
    └── [id].tsx           # Sample detail view
```

### State Management

| Layer | Technology | Purpose |
|-------|------------|---------|
| Query cache | TanStack Query | Samples list, CRUD mutations, sync status |
| Global context | `@nkzw/create-context-hook` | Auth user, device status, scan draft |
| Persistence | AsyncStorage | Local-first storage for samples, auth token |

### Provider Hierarchy

```
AuthProvider      → current user, login/logout
    ↓
DeviceProvider    → connection status, connect/disconnect
    ↓
SamplesProvider   → sample CRUD, sync mutations, retry logic
    ↓
ScanDraftProvider → in-progress scan state (image, location, metadata, result)
```

### Color Palette

Defined in `constants/colors.ts`. Uses a deep ocean / teal / aqua palette:

| Token | Hex | Usage |
|-------|-----|-------|
| deepOcean | #0B3C49 | Primary text, headers |
| ocean | #0B6E7F | Interactive elements, links |
| teal | #169873 | Success states, confirmations |
| aqua | #6FD6C6 | Accents, highlights |
| coral | #E26D5A | Alerts, destructive actions |
| cream | #F6F8F7 | Background |

## Project Structure

```
mobile-app/
├── app/                           # Expo Router screens
│   ├── _layout.tsx                # Root layout, providers, auth gate
│   ├── login.tsx                   # Auth screen (mocked)
│   ├── +not-found.tsx             # 404
│   ├── (tabs)/                    # Bottom tab navigator
│   │   ├── _layout.tsx            # Tab bar config
│   │   ├── (home)/               # Home stack
│   │   │   ├── _layout.tsx
│   │   │   └── index.tsx         # Dashboard
│   │   ├── history.tsx            # Sample list
│   │   ├── new-scan.tsx          # New scan CTA
│   │   └── settings.tsx          # Settings
│   ├── scan/                      # Scan workflow stack
│   │   ├── _layout.tsx
│   │   ├── capture.tsx           # Camera capture
│   │   ├── metadata.tsx          # GPS + metadata form
│   │   ├── processing.tsx        # Analysis loading
│   │   └── result.tsx            # Results display
│   └── sample/
│       └── [id].tsx              # Sample detail
│
├── components/                    # Reusable UI components
│   ├── PrimaryButton.tsx          # Main CTA button
│   ├── SecondaryButton.tsx       # Secondary actions
│   ├── FormInput.tsx              # Text input field
│   ├── StatusBadge.tsx            # Upload status indicator
│   ├── ResultCard.tsx             # Microplastic result display
│   ├── SampleListItem.tsx       # List row for history
│   ├── LoadingSpinner.tsx       # Loading state
│   ├── EmptyState.tsx           # Empty list fallback
│   └── ScreenHeader.tsx         # Screen title header
│
├── providers/                     # Context providers
│   ├── AuthProvider.tsx          # Auth user state
│   ├── SamplesProvider.tsx      # Sample CRUD + sync
│   ├── DeviceProvider.tsx       # Edge device status
│   └── ScanDraftProvider.tsx    # In-progress scan
│
├── services/                      # Business logic layer
│   ├── authService.ts           # Auth (mocked)
│   ├── sampleService.ts         # Local storage CRUD
│   ├── locationService.ts       # GPS (real via expo-location)
│   ├── cameraService.ts          # Image capture (real)
│   ├── deviceService.ts          # Arduino inference (mocked)
│   ├── syncService.ts           # Upload to backend (mocked)
│   └── apiClient.ts            # HTTP client (mocked)
│
├── types/                        # TypeScript definitions
│   └── index.ts                # All shared types
│
├── constants/                   # Design tokens
│   ├── colors.ts               # Color palette
│   └── theme.ts               # Spacing, typography
│
├── mock-data/                   # Seed data for development
│   └── samples.ts             # Coastal SoCal samples
│
├── utils/                       # Helper functions
│   └── format.ts              # Date, number formatters
│
├── app.json                    # Expo config
├── package.json               # Dependencies
└── tsconfig.json            # TypeScript config
```

## Data Model

### Core Types

```typescript
// types/index.ts

interface WaterSample {
  id: string;
  sampleId: string;
  capturedAt: string;              // ISO timestamp
  latitude: number;
  longitude: number;
  locationLabel?: string;         // User-friendly name
  microplasticEstimate: number;   // Calculated count
  unit: "particles/L" | "particles/mL" | "mg/L";
  confidence: number;             // 0-1 probability
  modelVersion: string;           // ML model identifier
  notes?: string;
  imageUri?: string;             // Local file URI
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
  deviceId?: string;             // Edge device serial
  waterSource?: WaterSourceType;
  temperatureC?: number;
  phLevel?: number;
}

type WaterSourceType = "ocean" | "bay" | "river" | "lake" | "tap" | "other";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  organization?: string;
}

interface DeviceStatus {
  connected: boolean;
  deviceId?: string;
  deviceName?: string;
  signal?: number;              // 0-1 strength
  lastSeenAt?: string;
}

interface ScanResult {
  microplasticEstimate: number;
  unit: MicroplasticUnit;
  confidence: number;
  modelVersion: string;
  processedAt: string;
}
```

## Services Overview

| Service | Responsibility | Status |
|---------|---------------|--------|
| `authService` | Login, logout, current user | Mocked (AsyncStorage) |
| `sampleService` | Local CRUD, seed data | Local only |
| `locationService` | GPS coordinates | Real (expo-location) |
| `cameraService` | Image capture | Real (expo-image-picker) |
| `deviceService` | Edge device connection + inference | Mocked |
| `syncService` | Upload to backend | Mocked |
| `apiClient` | HTTP client | Mocked (no-op) |

## Mocked vs. Ready

| Area | Status | Integration Hook |
|-----|--------|------------------|
| Authentication | **Mocked** (AsyncStorage) | `services/authService.ts` → wire to `POST /auth/login`, `GET /auth/me` |
| Samples list/detail | **Local only** (AsyncStorage, seeded) | `services/sampleService.ts` → `GET /samples`, `GET /samples/:id` |
| Upload/sync | **Mocked** (no-op apiClient) | `services/syncService.ts` + `services/apiClient.ts` → `POST /ingest/sample` |
| GPS location | **Ready** | `services/locationService.ts` via `expo-location` |
| Camera capture | **Ready** | `services/cameraService.ts` via `expo-image-picker` |
| Arduino UNO Q inference | **Mocked** | `services/deviceService.ts` → implement BLE or Wi-Fi/HTTP |
| ML model | Runs on edge device | n/a |

## Next Integration Steps

1. **Backend API**: Replace `apiClient.ts` with real fetch client. Base URL already read from `EXPO_PUBLIC_RORK_API_BASE_URL` environment variable. Implement endpoints:
   - `POST /auth/login` — authenticate user
   - `GET /auth/me` — refresh current user
   - `GET /samples` — list all samples
   - `GET /samples/:id` — get single sample
   - `POST /ingest/sample` — upload sample with metadata

2. **Arduino UNO Q Communication**: Choose transport layer:
   - **BLE**: Use `react-native-ble-plx` for direct Bluetooth connection
   - **Wi-Fi/HTTP**: Arduino exposes local HTTP endpoint; app connects to local network
   - Implement `deviceService.connect`, `disconnect`, `runInference` with chosen transport

3. **AWS Storage**: Upload sample images to S3:
   - Request presigned URL from backend
   - Upload `imageUri` to S3
   - Pass S3 URL to `POST /ingest/sample`

4. **Background Sync**: Handle offline scenarios:
   - Use `expo-task-manager` for background processing
   - Implement retry queue for failed uploads
   - Persist pending uploads across app restarts

5. **Authentication**: Replace mock with production auth:
   - OAuth 2.0 flow with backend
   - Or email Magic Link
   - Or AWS Cognito integration

## Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | expo-router (file-based) |
| Language | TypeScript 5.9 |
| Package manager | Bun |
| State management | TanStack Query + Zustand |
| Context | @nkzw/create-context-hook |
| Local storage | @react-native-async-storage/async-storage |
| Location | expo-location |
| Camera | expo-image-picker |
| UI | StyleSheet, lucide-react-native icons |
| Testing | (reserved) |

## License

MIT License

Copyright (c) 2026 SoCal Coastal Research

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
