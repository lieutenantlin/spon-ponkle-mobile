# Limpid Mobile

Mobile application for field researchers to capture water sample images, record GPS coordinates and environmental metadata, run on-device microplastic analysis via an Arduino UNO Q edge device, and sync results to a backend for aggregation and reporting.

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
- **History**: Searchable list of all recorded samples with filter by upload status
- **Settings**: Device pairing, sync queue inspection, account management
- **BLE hardware**: Full Bluetooth Low Energy connection, authorization, and capture protocol for the Arduino UNO Q
- **Offline-first**: All data stored locally in AsyncStorage; upload when connected

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
DeviceProvider    → BLE connection status, connect/disconnect/claim
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
│   ├── PrimaryButton.tsx
│   ├── SecondaryButton.tsx
│   ├── FormInput.tsx
│   ├── StatusBadge.tsx
│   ├── ResultCard.tsx
│   ├── SampleListItem.tsx
│   ├── LoadingSpinner.tsx
│   ├── EmptyState.tsx
│   └── ScreenHeader.tsx
│
├── providers/                     # Context providers
│   ├── AuthProvider.tsx
│   ├── SamplesProvider.tsx
│   ├── DeviceProvider.tsx
│   └── ScanDraftProvider.tsx
│
├── services/                      # Business logic layer
│   ├── authService.ts            # Auth (mocked)
│   ├── sampleService.ts          # Local storage CRUD
│   ├── locationService.ts        # GPS via expo-location
│   ├── cameraService.ts          # Image capture via expo-image-picker
│   ├── deviceService.ts          # BLE connection + UNO Q protocol
│   ├── syncService.ts            # HTTP upload to backend
│   ├── apiClient.ts              # Fetch-based HTTP client
│   └── device/                   # BLE implementation modules
│       ├── bleClient.ts          # react-native-ble-plx wrapper
│       └── unoqProtocol.ts       # UNO Q message protocol
│
├── types/                        # TypeScript definitions
│   └── index.ts
│
├── constants/                    # Design tokens
│   ├── colors.ts
│   └── theme.ts
│
├── mock-data/                    # Seed data for development
│   └── samples.ts
│
├── utils/
│   └── format.ts
│
├── app.json                      # Expo config
├── package.json
└── tsconfig.json
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
  locationLabel?: string;
  microplasticEstimate: number;
  unit: "particles/L" | "particles/mL" | "mg/L";
  confidence: number;              // 0–1
  modelVersion: string;
  notes?: string;
  imageUri?: string;               // Local file URI
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
  inferenceStatus: "pending" | "unavailable" | "complete";
  deviceId?: string;
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
  peripheralId?: string;
  bluetoothState: string;
  connectionPhase: DeviceConnectionPhase;
  controlReady: boolean;
  telemetrySubscribed: boolean;
  captureSession: DeviceCaptureSession | null;
  signal?: number;                 // 0–1 strength
  lastSeenAt?: string;
  error: DeviceBleError | null;
}

interface ScanResult {
  status: "pending" | "complete";
  processedAt: string;
  summary: string;
  microplasticEstimate?: number;
  unit?: MicroplasticUnit;
  confidence?: number;
  modelVersion?: string;
}
```

## Services Overview

| Service | Responsibility | Status |
|---------|---------------|--------|
| `authService` | Login, logout, current user | Mocked (AsyncStorage) |
| `sampleService` | Local CRUD, seed data | Local only (AsyncStorage) |
| `locationService` | GPS coordinates | Real (expo-location) |
| `cameraService` | Image capture | Real (expo-image-picker) |
| `deviceService` | BLE connect, claim, capture protocol | Real (react-native-ble-plx) |
| `syncService` | Presigned image upload + sample ingest | Real HTTP (backend URL required) |
| `apiClient` | Fetch-based HTTP client | Real (set `EXPO_PUBLIC_RORK_API_BASE_URL`) |

## Mocked vs. Ready

| Area | Status | Integration Hook |
|------|--------|-----------------|
| Authentication | **Mocked** (AsyncStorage) | `services/authService.ts` → wire to `POST /auth/login`, `GET /auth/me` |
| Samples list/detail | **Local only** (seeded AsyncStorage) | `services/sampleService.ts` → `GET /samples`, `GET /samples/:id` |
| Upload/sync | **Ready** (real HTTP, needs backend URL) | Set `EXPO_PUBLIC_RORK_API_BASE_URL`; implements `POST /ingest/sample` + presigned S3 upload |
| GPS location | **Ready** | `services/locationService.ts` via `expo-location` |
| Camera capture | **Ready** | `services/cameraService.ts` via `expo-image-picker` |
| BLE device connection | **Ready** | `services/deviceService.ts` + `services/device/bleClient.ts` |
| UNO Q capture protocol | **Ready** | `services/device/unoqProtocol.ts` — scan, connect, claim, start/confirm/complete capture |
| ML inference result | **Mocked** | `deviceService.runInference()` returns a pending stub — wire to UNO Q firmware response |

## Next Integration Steps

1. **Backend API**: Set the `EXPO_PUBLIC_RORK_API_BASE_URL` environment variable. Implement the following endpoints to match what `apiClient.ts` and `syncService.ts` expect:
   - `POST /auth/login` — authenticate user, return `AuthUser`
   - `GET /auth/me` — refresh current user
   - `GET /samples` — list all samples
   - `GET /samples/:id` — get single sample
   - `POST /upload/presigned` — return `{ uploadUrl, objectKey }` for S3 image upload
   - `POST /ingest/sample` — receive sample payload with `imageObjectKey`

2. **ML Inference**: The UNO Q capture flow is fully wired. Once the firmware returns a result, update `deviceService.runInference()` to parse and return the real `ScanResult` instead of the pending stub.

3. **Authentication**: Replace the mock in `authService.ts` with a real auth flow:
   - OAuth 2.0, Magic Link email, or AWS Cognito
   - Persist token to AsyncStorage after login

4. **Background Sync**: For robust offline support:
   - Use `expo-task-manager` for background upload retries
   - The retry queue logic in `syncService.retryAllFailed()` is already wired to the Settings screen

## Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | expo-router (file-based) |
| Language | TypeScript 5.9 |
| Package manager | Bun |
| State management | TanStack Query |
| Context | @nkzw/create-context-hook |
| Local storage | @react-native-async-storage/async-storage |
| BLE | react-native-ble-plx |
| Location | expo-location |
| Camera | expo-image-picker |
| Icons | lucide-react-native |

## License

MIT License

Copyright (c) 2026 DataHacks 2026
