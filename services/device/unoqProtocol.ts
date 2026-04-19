import { decode as decodeBase64, encode as encodeBase64 } from "base-64";
import {
  DeviceCaptureSession,
  DeviceCaptureSnapshot,
  DeviceBleError,
  DeviceBleErrorCode,
  DeviceHealthEvent,
  DeviceInfo,
  DeviceTelemetry,
  DiscoveredDevice,
} from "@/types";

export const UNOQ_LOCAL_NAME = "UNO Q Tank";
export const UNOQ_SERVICE_UUID = "f0f0f6b2-b318-4f02-b52e-62dfbbdd88d0";
export const UNOQ_CONTROL_UUID = "f0f0f6b2-b318-4f02-b52e-62dfbbdd88d1";
export const UNOQ_EVENTS_UUID = "f0f0f6b2-b318-4f02-b52e-62dfbbdd88d2";
export const UNOQ_DEVICE_INFO_UUID = "f0f0f6b2-b318-4f02-b52e-62dfbbdd88d3";

export type UnoqControlCommand =
  | "sensors.read"
  | "capture.start"
  | "capture.phone_positioned"
  | "capture.camera_ready"
  | "capture.complete"
  | "capture.cancel"
  | "telemetry.subscribe"
  | "telemetry.unsubscribe";

export interface UnoqControlRequest {
  id: string;
  cmd: UnoqControlCommand;
  args: Record<string, unknown>;
}

export interface UnoqReply {
  reply_to: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
  device?: string;
}

export interface UnoqEvent {
  event: string;
  data?: unknown;
}

let requestCounter = 0;

export function nextRequestId(): string {
  requestCounter += 1;
  return `unoq-${Date.now()}-${requestCounter}`;
}

export function buildControlRequest(
  cmd: UnoqControlCommand,
  args: Record<string, unknown> = {}
): UnoqControlRequest {
  return {
    id: nextRequestId(),
    cmd,
    args,
  };
}

export function encodeCharacteristicValue(value: string): string {
  return encodeBase64(value);
}

export function decodeCharacteristicValue(value: string | null | undefined): string {
  if (!value) return "";
  return decodeBase64(value);
}

export function parseMessageJson(raw: string): UnoqReply | UnoqEvent {
  const parsed = parseJsonObject(raw);

  if (typeof parsed.reply_to === "string") {
    return {
      reply_to: parsed.reply_to,
      ok: Boolean(parsed.ok),
      result: isRecord(parsed.result) ? parsed.result : undefined,
      error: isRecord(parsed.error)
        ? {
            code:
              typeof parsed.error.code === "string" ? parsed.error.code : undefined,
            message:
              typeof parsed.error.message === "string"
                ? parsed.error.message
                : undefined,
          }
        : undefined,
      device: typeof parsed.device === "string" ? parsed.device : undefined,
    };
  }

  if (typeof parsed.event === "string") {
    return {
      event: parsed.event,
      data: parsed.data,
    };
  }

  throw new Error("BLE payload is neither a reply nor an event.");
}

export function parseDeviceInfoJson(raw: string): DeviceInfo {
  const parsed = parseJsonObject(raw);
  return parsed as DeviceInfo;
}

export function normalizeTelemetry(payload: unknown): DeviceTelemetry | undefined {
  if (!isRecord(payload)) return undefined;

  const faults = Array.isArray(payload.faults)
    ? payload.faults.map((value) => String(value))
    : [];

  return {
    timestamp_ms: toNumber(payload.timestamp_ms),
    temp_c: toNumber(payload.temp_c),
    light_raw: toNumber(payload.light_raw),
    light_pct: toNumber(payload.light_pct),
    water_raw: toNumber(payload.water_raw),
    water_pct: toNumber(payload.water_pct),
    temp_valid: Boolean(payload.temp_valid),
    light_valid: Boolean(payload.light_valid),
    water_valid: Boolean(payload.water_valid),
    sensor_fault: Boolean(payload.sensor_fault),
    faults,
  };
}

export function normalizeHealthEvent(payload: unknown): DeviceHealthEvent | undefined {
  if (!isRecord(payload)) return undefined;

  const checks =
    isRecord(payload.checks)
      ? Object.fromEntries(
          Object.entries(payload.checks).map(([key, value]) => [
            key,
            isPrimitiveHealthValue(value) ? value : String(value),
          ])
        )
      : undefined;

  return {
    ...payload,
    source: typeof payload.source === "string" ? payload.source : undefined,
    status: typeof payload.status === "string" ? payload.status : undefined,
    checks,
  };
}

export function normalizeCaptureSnapshot(
  payload: unknown
): DeviceCaptureSnapshot | undefined {
  if (!isRecord(payload)) return undefined;

  return {
    active: Boolean(payload.active),
    sequenceId:
      typeof payload.sequence_id === "string"
        ? payload.sequence_id
        : typeof payload.sequenceId === "string"
        ? payload.sequenceId
        : undefined,
    state:
      typeof payload.state === "string"
        ? (payload.state as DeviceCaptureSession["state"])
        : undefined,
    progressPct: optionalNumber(payload.progress_pct ?? payload.progressPct),
    stepIndex: optionalNumber(payload.step_index ?? payload.stepIndex),
    stepCount: optionalNumber(payload.step_count ?? payload.stepCount),
    lastOutcome:
      typeof payload.last_outcome === "string"
        ? (payload.last_outcome as DeviceCaptureSnapshot["lastOutcome"])
        : typeof payload.lastOutcome === "string"
        ? (payload.lastOutcome as DeviceCaptureSnapshot["lastOutcome"])
        : undefined,
  };
}

export function normalizeCaptureStateEvent(
  payload: unknown
): DeviceCaptureSession | undefined {
  if (!isRecord(payload)) return undefined;

  return {
    active: !isTerminalCaptureState(payload.state),
    sequenceId:
      typeof payload.sequence_id === "string" ? payload.sequence_id : undefined,
    state:
      typeof payload.state === "string"
        ? (payload.state as DeviceCaptureSession["state"])
        : "idle",
    stepIndex: optionalNumber(payload.step_index),
    stepCount: optionalNumber(payload.step_count),
    progressPct: optionalNumber(payload.progress_pct),
    status: typeof payload.status === "string" ? payload.status : undefined,
    instruction:
      typeof payload.instruction === "string" ? payload.instruction : undefined,
    remainingMs: optionalNumber(payload.remaining_ms),
    lightOn:
      typeof payload.light_on === "boolean" ? payload.light_on : undefined,
    stepperActive:
      typeof payload.stepper_active === "boolean"
        ? payload.stepper_active
        : undefined,
    healthStatus:
      typeof payload.health_status === "string"
        ? payload.health_status
        : undefined,
  };
}

export function normalizeCaptureFinishedEvent(
  payload: unknown
): Partial<DeviceCaptureSession> | undefined {
  if (!isRecord(payload)) return undefined;

  return {
    active: false,
    sequenceId:
      typeof payload.sequence_id === "string" ? payload.sequence_id : undefined,
    state:
      typeof payload.outcome === "string"
        ? (payload.outcome as DeviceCaptureSession["state"])
        : "failed",
    outcome:
      typeof payload.outcome === "string"
        ? (payload.outcome as DeviceCaptureSession["outcome"])
        : undefined,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    captureCount: optionalNumber(payload.capture_count),
    startedAtMs: optionalNumber(payload.started_at_ms),
    endedAtMs: optionalNumber(payload.ended_at_ms),
  };
}

export function isUnoqReply(message: UnoqReply | UnoqEvent): message is UnoqReply {
  return "reply_to" in message;
}

export function isUnoqEvent(message: UnoqReply | UnoqEvent): message is UnoqEvent {
  return "event" in message;
}

export function matchesUnoqAdvertisement(device: {
  name?: string | null;
  localName?: string | null;
  serviceUUIDs?: string[] | null;
}): boolean {
  const names = [device.localName, device.name]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim());

  if (names.includes(UNOQ_LOCAL_NAME)) {
    return true;
  }

  return (device.serviceUUIDs ?? []).some(
    (uuid) => uuid.toLowerCase() === UNOQ_SERVICE_UUID
  );
}

export function normalizeSignal(rssi?: number | null): number | undefined {
  if (typeof rssi !== "number" || Number.isNaN(rssi)) return undefined;
  return Math.max(0, Math.min(1, (rssi + 100) / 60));
}

export function toDiscoveredDevice(device: {
  id: string;
  name?: string | null;
  localName?: string | null;
  rssi?: number | null;
  serviceUUIDs?: string[] | null;
  isConnectable?: boolean | null;
}): DiscoveredDevice {
  return {
    peripheralId: device.id,
    name: device.name ?? undefined,
    localName: device.localName ?? undefined,
    rssi: device.rssi ?? undefined,
    signal: normalizeSignal(device.rssi),
    serviceUUIDs: device.serviceUUIDs ?? null,
    isConnectable: device.isConnectable ?? null,
  };
}

export function toBleError(
  error: unknown,
  fallbackCode: DeviceBleErrorCode = "unknown"
): DeviceBleError {
  if (isRecord(error)) {
    const errorCode = typeof error.errorCode === "number" ? error.errorCode : undefined;
    const nativeCode =
      typeof error.androidErrorCode === "number"
        ? error.androidErrorCode
        : typeof error.iosErrorCode === "number"
        ? error.iosErrorCode
        : errorCode ?? null;

    return {
      code: mapNativeBleError(errorCode, fallbackCode),
      message:
        typeof error.message === "string" && error.message.length
          ? error.message
          : defaultErrorMessage(fallbackCode),
      reason: typeof error.reason === "string" ? error.reason : null,
      nativeCode,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || defaultErrorMessage(fallbackCode),
      reason: null,
      nativeCode: null,
    };
  }

  return {
    code: fallbackCode,
    message: defaultErrorMessage(fallbackCode),
    reason: null,
    nativeCode: null,
  };
}

export function toProtocolError(payload: UnoqReply["error"]): DeviceBleError {
  const code = payload?.code;
  const mapped: DeviceBleErrorCode =
    code === "unauthorized"
      ? "unauthorized"
      : code === "bad_command"
      ? "bad_command"
      : code === "internal_error"
      ? "internal_error"
      : "protocol_error";

  return {
    code: mapped,
    message: payload?.message || defaultErrorMessage(mapped),
    reason: null,
    nativeCode: code ?? null,
  };
}

function parseJsonObject(raw: string): Record<string, any> {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("BLE JSON payload must be an object.");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function optionalNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function isTerminalCaptureState(value: unknown): boolean {
  return value === "completed" || value === "failed" || value === "cancelled";
}

function isPrimitiveHealthValue(
  value: unknown
): value is boolean | string | number | null {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  );
}

function mapNativeBleError(
  errorCode: number | undefined,
  fallbackCode: DeviceBleErrorCode
): DeviceBleErrorCode {
  switch (errorCode) {
    case 100:
      return "bluetooth_unsupported";
    case 101:
      return "bluetooth_unauthorized";
    case 102:
      return "bluetooth_powered_off";
    case 104:
      return "bluetooth_resetting";
    case 200:
    case 203:
    case 204:
    case 205:
      return "connect_failed";
    case 201:
      return "disconnected";
    case 401:
      return "write_failed";
    case 402:
      return "read_failed";
    case 403:
      return "notify_failed";
    default:
      return fallbackCode;
  }
}

function defaultErrorMessage(code: DeviceBleErrorCode): string {
  switch (code) {
    case "bluetooth_unsupported":
      return "Bluetooth LE is not supported on this device.";
    case "bluetooth_unauthorized":
      return "Bluetooth permission is not granted.";
    case "bluetooth_powered_off":
      return "Bluetooth is powered off.";
    case "bluetooth_resetting":
      return "Bluetooth is resetting.";
    case "scan_failed":
      return "Scanning for UNO Q failed.";
    case "device_not_found":
      return "The selected UNO Q device could not be found.";
    case "connect_failed":
      return "Connecting to UNO Q failed.";
    case "disconnected":
      return "The BLE connection was disconnected.";
    case "notify_failed":
      return "Subscribing to device events failed.";
    case "read_failed":
      return "Reading from the device failed.";
    case "write_failed":
      return "Writing to the device failed.";
    case "reply_timeout":
      return "The device did not reply in time.";
    case "protocol_error":
      return "The device returned an unexpected response.";
    case "unauthorized":
      return "This phone is not authorized to control the board.";
    case "bad_command":
      return "The device rejected the command payload.";
    case "internal_error":
      return "The device reported an internal error.";
    default:
      return "An unknown Bluetooth error occurred.";
  }
}
