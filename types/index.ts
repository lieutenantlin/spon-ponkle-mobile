export type MicroplasticUnit = "particles/L" | "mg/L";
export type UploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "synced"
  | "failed";
export type InferenceStatus = "pending" | "mocked" | "unavailable";

export type DeviceBluetoothState =
  | "Unknown"
  | "Resetting"
  | "Unsupported"
  | "Unauthorized"
  | "PoweredOff"
  | "PoweredOn";

export type BluetoothState = Lowercase<DeviceBluetoothState>;

export type DeviceConnectionPhase =
  | "idle"
  | "scanning"
  | "connecting"
  | "disconnecting"
  | "discovering"
  | "reading_device_info"
  | "subscribing"
  | "claiming"
  | "restoring"
  | "connected"
  | "error";

export type ConnectionPhase = DeviceConnectionPhase;

export type DevicePairingState = "unknown" | "unpaired" | "pairing" | "authorized";
export type DeviceStatusMode =
  | "unknown"
  | "booting"
  | "idle"
  | "pairing"
  | "connected"
  | "busy"
  | "error";

export type DeviceCapturePhase =
  | "idle"
  | "preflight"
  | "mixing"
  | "awaiting_phone_placement"
  | "awaiting_camera_ready"
  | "capturing"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export type DeviceCaptureOutcome = "completed" | "failed" | "cancelled";

export type DeviceBleErrorCode =
  | "bluetooth_unsupported"
  | "bluetooth_unauthorized"
  | "bluetooth_powered_off"
  | "bluetooth_resetting"
  | "bluetooth_unavailable"
  | "permissions_denied"
  | "device_not_found"
  | "scan_failed"
  | "connect_failed"
  | "notify_failed"
  | "notification_setup_failed"
  | "request_timeout"
  | "reply_timeout"
  | "write_failed"
  | "read_failed"
  | "disconnected"
  | "unauthorized"
  | "bad_command"
  | "internal_error"
  | "protocol_error"
  | "native_module_unavailable"
  | "unknown";

export type BleErrorCode = DeviceBleErrorCode;

export interface DeviceBleError {
  code: DeviceBleErrorCode;
  message: string;
  reason?: string | null;
  nativeCode?: string | number | null;
  recoverable?: boolean;
}

export interface DeviceError extends DeviceBleError {}

export interface DiscoveredDevice {
  peripheralId: string;
  name?: string;
  localName?: string;
  rssi?: number;
  signal?: number;
  serviceUUIDs?: string[] | null;
  isConnectable?: boolean | null;
}

export interface DeviceTelemetry {
  timestamp_ms?: number;
  temp_c?: number;
  light_raw?: number;
  light_pct?: number;
  water_raw?: number;
  water_pct?: number;
  temp_valid?: boolean;
  light_valid?: boolean;
  water_valid?: boolean;
  sensor_fault?: boolean;
  faults?: string[];
  batteryPct?: number;
  temperatureC?: number;
  turbidityNtu?: number;
  timestamp?: string;
  [key: string]: unknown;
}

export interface DeviceHealthEvent {
  source?: string;
  status?: string;
  message?: string;
  code?: string;
  timestamp?: string;
  checks?: Record<string, string | number | boolean | null>;
  [key: string]: unknown;
}

export interface DeviceCaptureSnapshot {
  active: boolean;
  sequenceId?: string;
  state?: DeviceCapturePhase;
  progressPct?: number;
  stepIndex?: number;
  stepCount?: number;
  lastOutcome?: DeviceCaptureOutcome;
}

export interface DeviceCaptureSession {
  active: boolean;
  sequenceId?: string;
  state: DeviceCapturePhase;
  stepIndex?: number;
  stepCount?: number;
  progressPct?: number;
  status?: string;
  instruction?: string;
  remainingMs?: number;
  lightOn?: boolean;
  stepperActive?: boolean;
  healthStatus?: string;
  outcome?: DeviceCaptureOutcome;
  reason?: string;
  captureCount?: number;
  startedAtMs?: number;
  endedAtMs?: number;
}

export interface DeviceInfo {
  name?: string;
  appVersion?: string;
  app_version?: string;
  firmwareVersion?: string;
  firmware_version?: string;
  hardwareRevision?: string;
  hardware_revision?: string;
  serialNumber?: string;
  serial_number?: string;
  pairingState?: DevicePairingState;
  pairing_state?: DevicePairingState;
  statusMode?: DeviceStatusMode;
  status_mode?: DeviceStatusMode;
  pairingWindowOpen?: boolean;
  pairing_window_open?: boolean;
  authorizedDeviceConnected?: boolean;
  authorized_device_connected?: boolean;
  telemetry_streaming?: boolean;
  lastHealthEvent?: DeviceHealthEvent | null;
  last_health_event?: DeviceHealthEvent | null;
  capture?: DeviceCaptureSnapshot | null;
  [key: string]: unknown;
}

export type WaterSourceType = "ocean" | "bay" | "river" | "lake" | "tap" | "other";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  locationLabel?: string;
  timestamp?: string | number;
}

export interface SampleMetadataDraft {
  notes?: string;
  waterSource?: WaterSourceType;
  temperatureC?: number;
  phLevel?: number;
}

export interface DeviceStatus {
  connected: boolean;
  isConnected?: boolean;
  deviceName?: string;
  deviceId?: string;
  lastSeenAt?: string;
  lastSeen?: string;
  batteryLevel?: number;
  peripheralId?: string;
  lastPeripheralId?: string;
  connectionPhase: DeviceConnectionPhase;
  bluetoothState: DeviceBluetoothState;
  pairingState?: DevicePairingState;
  statusMode?: DeviceStatusMode;
  deviceInfo?: DeviceInfo;
  lastTelemetry?: DeviceTelemetry;
  lastHealthEvent?: DeviceHealthEvent;
  captureSession?: DeviceCaptureSession | null;
  discoveredDevices: DiscoveredDevice[];
  signal?: number;
  telemetrySubscribed: boolean;
  controlReady: boolean;
  error: DeviceBleError | null;
}

export interface WaterSample {
  id: string;
  sampleId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  imageUri: string;
  imageUris?: string[];
  microplasticEstimate?: number;
  unit?: MicroplasticUnit;
  confidence?: number;
  modelVersion?: string;
  inferenceStatus: InferenceStatus;
  inferenceSummary?: string;
  uploadStatus: UploadStatus;
  notes?: string;
  deviceId?: string;
  peripheralId?: string;
  sequenceId?: string;
  captureOutcome?: DeviceCaptureOutcome;
  captureReason?: string;
  telemetrySnapshot?: DeviceTelemetry | null;
  healthSnapshot?: DeviceHealthEvent | null;
  deviceInfoSnapshot?: DeviceInfo | null;
  waterSource?: WaterSourceType;
  temperatureC?: number;
  phLevel?: number;
}

export interface ScanResult {
  status: InferenceStatus;
  processedAt: string;
  summary?: string;
  microplasticEstimate?: number;
  estimatedCount?: number;
  unit?: MicroplasticUnit;
  confidence?: number;
  modelVersion?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  organization?: string;
}

export interface User extends AuthUser {}
