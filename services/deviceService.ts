import AsyncStorage from "@react-native-async-storage/async-storage";
import { Subscription } from "react-native-ble-plx";
import {
  DeviceCaptureSession,
  DeviceBleError,
  DeviceConnectionPhase,
  DeviceInfo,
  DeviceStatus,
  ScanResult,
} from "@/types";
import {
  BleConnectionLike,
  UnoqBleClient,
  UnoqBleClientLike,
} from "./device/bleClient";
import {
  UNOQ_CONTROL_UUID,
  UNOQ_DEVICE_INFO_UUID,
  UNOQ_EVENTS_UUID,
  UNOQ_SERVICE_UUID,
  UnoqControlCommand,
  UnoqReply,
  buildControlRequest,
  isUnoqEvent,
  isUnoqReply,
  normalizeCaptureFinishedEvent,
  normalizeCaptureSnapshot,
  normalizeCaptureStateEvent,
  normalizeHealthEvent,
  normalizeTelemetry,
  parseDeviceInfoJson,
  parseMessageJson,
  toBleError,
  toProtocolError,
} from "./device/unoqProtocol";

const LAST_PERIPHERAL_KEY = "mp_device_last_peripheral_v1";
const LAST_DEVICE_INFO_KEY = "mp_device_last_info_v1";

type StatusListener = (status: DeviceStatus) => void;

interface PendingReply {
  resolve: (reply: UnoqReply) => void;
  reject: (error: DeviceBleError) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface DeviceStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DEFAULT_DEVICE_STATUS: DeviceStatus = {
  connected: false,
  bluetoothState: "Unknown",
  connectionPhase: "idle",
  discoveredDevices: [],
  telemetrySubscribed: false,
  controlReady: false,
  error: null,
  captureSession: null,
};

export interface DeviceServiceLike {
  initialize(): Promise<DeviceStatus>;
  getStatus(): Promise<DeviceStatus>;
  getSnapshot(): DeviceStatus;
  subscribe(listener: StatusListener): () => void;
  scan(): Promise<DeviceStatus>;
  connect(peripheralId: string): Promise<DeviceStatus>;
  claimAuthorization(): Promise<DeviceStatus>;
  disconnect(): Promise<DeviceStatus>;
  refreshDeviceInfo(): Promise<DeviceStatus>;
  restoreConnection(): Promise<DeviceStatus>;
  startCapture(): Promise<DeviceStatus>;
  confirmPhonePositioned(sequenceId: string): Promise<DeviceStatus>;
  confirmCameraReady(sequenceId: string): Promise<DeviceStatus>;
  completeCapture(
    sequenceId: string,
    outcome?: "success",
    metadata?: Record<string, unknown>
  ): Promise<DeviceStatus>;
  cancelCapture(sequenceId: string, reason?: string): Promise<DeviceStatus>;
  runInference(imageUri: string): Promise<ScanResult>;
}

export class DeviceService implements DeviceServiceLike {
  private client: UnoqBleClientLike;
  private storage: DeviceStorageLike;
  private status: DeviceStatus = { ...DEFAULT_DEVICE_STATUS };
  private listeners = new Set<StatusListener>();
  private pendingReplies = new Map<string, PendingReply>();
  private stateSubscription: Subscription | null = null;
  private eventsSubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private connection: BleConnectionLike | null = null;
  private initialized = false;
  private restoreInFlight: Promise<DeviceStatus> | null = null;
  private eventsReady = false;

  constructor(
    client: UnoqBleClientLike = new UnoqBleClient(),
    storage: DeviceStorageLike = AsyncStorage
  ) {
    this.client = client;
    this.storage = storage;
  }

  async initialize(): Promise<DeviceStatus> {
    if (this.initialized) {
      return this.getSnapshot();
    }

    this.initialized = true;

    const [lastPeripheralId, rawDeviceInfo, bluetoothState] = await Promise.all([
      this.storage.getItem(LAST_PERIPHERAL_KEY),
      this.storage.getItem(LAST_DEVICE_INFO_KEY),
      this.client.getState().catch(() => "Unknown" as const),
    ]);

    let deviceInfo: DeviceInfo | undefined;
    if (rawDeviceInfo) {
      try {
        deviceInfo = JSON.parse(rawDeviceInfo) as DeviceInfo;
      } catch {
        deviceInfo = undefined;
      }
    }

    this.applyDeviceInfo(deviceInfo);
    this.patchStatus({
      bluetoothState,
      lastPeripheralId: lastPeripheralId ?? undefined,
      deviceName: deviceInfo?.name ?? this.status.deviceName,
      error: null,
    });

    this.stateSubscription = this.client.observeState((state) => {
      this.patchStatus({ bluetoothState: state });
      if (state !== "PoweredOn" && this.status.connected) {
        this.finishDisconnect(
          toBleError(new Error("Bluetooth is no longer powered on."), "disconnected")
        );
      }
    });

    return this.getSnapshot();
  }

  async getStatus(): Promise<DeviceStatus> {
    await this.initialize();
    return this.getSnapshot();
  }

  getSnapshot(): DeviceStatus {
    return cloneStatus(this.status);
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async scan(): Promise<DeviceStatus> {
    await this.initialize();
    this.patchStatus({
      connectionPhase: "scanning",
      error: null,
      discoveredDevices: [],
    });

    try {
      const discoveredDevices = await this.client.scanOnce();
      this.patchStatus({
        connectionPhase: this.status.connected ? "connected" : "idle",
        discoveredDevices,
      });
      return this.getSnapshot();
    } catch (error) {
      this.failWithError(toBleError(error, "scan_failed"));
      return this.getSnapshot();
    }
  }

  async connect(peripheralId: string): Promise<DeviceStatus> {
    await this.initialize();
    return this.connectInternal(peripheralId, false);
  }

  async claimAuthorization(): Promise<DeviceStatus> {
    await this.initialize();

    if (!this.connection) {
      this.failWithError({
        code: "device_not_found",
        message: "Connect to a UNO Q device before claiming it.",
        reason: null,
        nativeCode: null,
      });
      return this.getSnapshot();
    }

    this.patchStatus({
      connectionPhase: "claiming",
      error: null,
    });

    try {
      if (!this.eventsReady) {
        await this.writeWithoutReply("sensors.read");
        this.startEventsMonitoring();

        if (!this.eventsReady) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (!this.eventsReady) {
        throw {
          message: "Encrypted notifications are not active yet.",
          errorCode: 403,
        };
      }

      const sensorReply = await this.sendCommand("sensors.read");
      if (!sensorReply.ok) {
        throw toProtocolError(sensorReply.error);
      }

      const telemetry = normalizeTelemetry(sensorReply.result);
      if (telemetry) {
        this.patchStatus({
          lastTelemetry: telemetry,
          lastSeenAt: new Date().toISOString(),
        });
      }

      await this.refreshDeviceInfo();

      const telemetryReply = await this.sendCommand("telemetry.subscribe");
      if (!telemetryReply.ok) {
        throw toProtocolError(telemetryReply.error);
      }

      this.patchStatus({
        controlReady: true,
        telemetrySubscribed: Boolean(telemetryReply.result?.enabled),
        connectionPhase: "connected",
        lastSeenAt: new Date().toISOString(),
        error: null,
      });

      await this.refreshDeviceInfo();
      return this.getSnapshot();
    } catch (error) {
      this.failWithError(asDeviceBleError(error, "write_failed"));
      return this.getSnapshot();
    }
  }

  async disconnect(): Promise<DeviceStatus> {
    await this.initialize();

    if (!this.connection) {
      this.patchStatus({
        connected: false,
        connectionPhase: "idle",
        controlReady: false,
        telemetrySubscribed: false,
      });
      return this.getSnapshot();
    }

    this.patchStatus({
      connectionPhase: "disconnecting",
      error: null,
    });

    try {
      if (this.status.controlReady && this.eventsReady) {
        await this.sendCommand("telemetry.unsubscribe", {}, 3000).catch(() => undefined);
      }
      await this.connection.cancelConnection();
    } catch {
      // Ignore; final state is handled below.
    }

    this.finishDisconnect(null);
    return this.getSnapshot();
  }

  async refreshDeviceInfo(): Promise<DeviceStatus> {
    await this.initialize();

    if (!this.connection) {
      return this.getSnapshot();
    }

    this.setPhase("reading_device_info");

    try {
      const rawInfo = await this.connection.readText(
        UNOQ_SERVICE_UUID,
        UNOQ_DEVICE_INFO_UUID
      );
      const deviceInfo = parseDeviceInfoJson(rawInfo);
      this.applyDeviceInfo(deviceInfo);
      await this.storage.setItem(LAST_DEVICE_INFO_KEY, JSON.stringify(deviceInfo));
      this.patchStatus({
        connectionPhase: "connected",
        error: null,
      });
      return this.getSnapshot();
    } catch (error) {
      this.failWithError(toBleError(error, "read_failed"));
      return this.getSnapshot();
    }
  }

  async restoreConnection(): Promise<DeviceStatus> {
    await this.initialize();

    if (this.restoreInFlight) {
      return this.restoreInFlight;
    }

    if (
      this.status.connected ||
      !this.status.lastPeripheralId ||
      this.status.bluetoothState !== "PoweredOn"
    ) {
      return this.getSnapshot();
    }

    this.restoreInFlight = this.connectInternal(this.status.lastPeripheralId, true).finally(
      () => {
        this.restoreInFlight = null;
      }
    );

    return this.restoreInFlight;
  }

  async startCapture(): Promise<DeviceStatus> {
    return this.sendCaptureCommand("capture.start");
  }

  async confirmPhonePositioned(sequenceId: string): Promise<DeviceStatus> {
    return this.sendCaptureCommand("capture.phone_positioned", { sequence_id: sequenceId });
  }

  async confirmCameraReady(sequenceId: string): Promise<DeviceStatus> {
    return this.sendCaptureCommand("capture.camera_ready", { sequence_id: sequenceId });
  }

  async completeCapture(
    sequenceId: string,
    outcome: "success" = "success",
    metadata: Record<string, unknown> = {}
  ): Promise<DeviceStatus> {
    return this.sendCaptureCommand("capture.complete", {
      sequence_id: sequenceId,
      outcome,
      ...metadata,
    });
  }

  async cancelCapture(sequenceId: string, reason = "user_cancelled"): Promise<DeviceStatus> {
    return this.sendCaptureCommand("capture.cancel", {
      sequence_id: sequenceId,
      reason,
    });
  }

  async runInference(imageUri: string): Promise<ScanResult> {
    console.log("[deviceService] runInference (mock)", imageUri);
    await new Promise((resolve) => setTimeout(resolve, imageUri ? 1200 : 600));
    return {
      status: "pending",
      processedAt: new Date().toISOString(),
      summary:
        "Capture packaging complete. Local sample saved and awaiting the microplastic analysis model.",
    };
  }

  private async connectInternal(
    peripheralId: string,
    authorizeAfterConnect: boolean
  ): Promise<DeviceStatus> {
    if (this.connection && this.status.peripheralId === peripheralId) {
      if (authorizeAfterConnect) {
        return this.claimAuthorization();
      }
      return this.getSnapshot();
    }

    if (this.connection && this.status.peripheralId !== peripheralId) {
      await this.disconnect();
    }

    this.patchStatus({
      connectionPhase: authorizeAfterConnect ? "restoring" : "connecting",
      error: null,
      controlReady: false,
      telemetrySubscribed: false,
      peripheralId,
    });

    try {
      const connection = await this.client.connect(peripheralId);
      this.connection = connection;
      await this.storage.setItem(LAST_PERIPHERAL_KEY, peripheralId);
      this.patchStatus({
        connected: true,
        peripheralId,
        lastPeripheralId: peripheralId,
        deviceName: connection.localName ?? connection.name ?? this.status.deviceName,
        signal: this.status.signal,
        error: null,
      });

      await this.attachDisconnectListener(connection);
      this.setPhase("discovering");

      const rssi = await connection.readRSSI().catch(() => ({ rssi: connection.rssi }));
      this.patchStatus({
        signal:
          typeof rssi.rssi === "number"
            ? Math.max(0, Math.min(1, (rssi.rssi + 100) / 60))
            : this.status.signal,
      });

      this.setPhase("subscribing");
      this.startEventsMonitoring();

      await this.refreshDeviceInfo();
      this.patchStatus({
        connectionPhase: authorizeAfterConnect ? "claiming" : "connected",
      });

      if (authorizeAfterConnect) {
        return this.claimAuthorization();
      }

      this.patchStatus({
        connectionPhase: "connected",
      });
      return this.getSnapshot();
    } catch (error) {
      this.failWithError(toBleError(error, "connect_failed"));
      return this.getSnapshot();
    }
  }

  private async attachDisconnectListener(connection: BleConnectionLike): Promise<void> {
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = connection.onDisconnected((error) => {
      this.finishDisconnect(error ? toBleError(error, "disconnected") : null);
    });
  }

  private startEventsMonitoring(): void {
    if (!this.connection) {
      return;
    }

    this.eventsSubscription?.remove();
    let monitorFailed = false;

    try {
      this.eventsSubscription = this.connection.monitorText(
        UNOQ_SERVICE_UUID,
        UNOQ_EVENTS_UUID,
        (payload) => this.handleIncomingPayload(payload),
        (error) => {
          monitorFailed = true;
          this.eventsReady = false;
          this.patchStatus({
            error: toBleError(error, "notify_failed"),
          });
        }
      );
      this.eventsReady = !monitorFailed;
    } catch (error) {
      this.eventsReady = false;
      this.patchStatus({
        error: toBleError(error, "notify_failed"),
      });
    }
  }

  private async writeWithoutReply(
    command: UnoqControlCommand,
    args: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("No BLE connection is active.");
    }

    const request = buildControlRequest(command, args);
    await this.connection.writeTextWithResponse(
      UNOQ_SERVICE_UUID,
      UNOQ_CONTROL_UUID,
      JSON.stringify(request)
    );
  }

  private async sendCommand(
    command: UnoqControlCommand,
    args: Record<string, unknown> = {},
    timeoutMs = 8000
  ): Promise<UnoqReply> {
    if (!this.connection) {
      throw {
        message: "No BLE connection is active.",
      };
    }

    const request = buildControlRequest(command, args);

    const replyPromise = new Promise<UnoqReply>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(request.id);
        reject({
          code: "reply_timeout",
          message: "The UNO Q device did not reply in time.",
          reason: null,
          nativeCode: null,
        } satisfies DeviceBleError);
      }, timeoutMs);

      this.pendingReplies.set(request.id, {
        resolve,
        reject,
        timeout,
      });
    });

    try {
      await this.connection.writeTextWithResponse(
        UNOQ_SERVICE_UUID,
        UNOQ_CONTROL_UUID,
        JSON.stringify(request)
      );
    } catch (error) {
      this.clearPendingReply(request.id);
      throw toBleError(error, "write_failed");
    }

    return replyPromise;
  }

  private handleIncomingPayload(rawPayload: string): void {
    try {
      const message = parseMessageJson(rawPayload);

      if (isUnoqReply(message)) {
        const pending = this.pendingReplies.get(message.reply_to);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pendingReplies.delete(message.reply_to);
        pending.resolve(message);
        return;
      }

      if (!isUnoqEvent(message)) return;

      const now = new Date().toISOString();
      if (message.event === "sensor.update") {
        const telemetry = normalizeTelemetry(message.data);
        if (telemetry) {
          this.patchStatus({
            lastTelemetry: telemetry,
            lastSeenAt: now,
          });
        }
        return;
      }

      if (message.event === "capture.state") {
        const captureSession = normalizeCaptureStateEvent(message.data);
        if (captureSession) {
          this.patchStatus({
            captureSession,
            lastSeenAt: now,
          });
        }
        return;
      }

      if (message.event === "capture.finished") {
        const finished = normalizeCaptureFinishedEvent(message.data);
        if (finished) {
          this.patchStatus({
            captureSession: {
              ...(this.status.captureSession ?? { active: false, state: "idle" }),
              ...finished,
            } as DeviceCaptureSession,
            lastSeenAt: now,
          });
        }
        return;
      }

      if (message.event === "system.health") {
        const lastHealthEvent = normalizeHealthEvent(message.data);
        if (lastHealthEvent) {
          this.patchStatus({
            lastHealthEvent,
            lastSeenAt: now,
          });
        }
        return;
      }

      if (message.event === "transport.disconnected") {
        this.patchStatus({
          controlReady: false,
          telemetrySubscribed: false,
          error: {
            code: "disconnected",
            message: "The device transport reported a disconnect.",
            reason: null,
            nativeCode: null,
          },
        });
      }
    } catch (error) {
      this.patchStatus({
        error: toBleError(error, "protocol_error"),
      });
    }
  }

  private applyDeviceInfo(deviceInfo?: DeviceInfo): void {
    if (!deviceInfo) return;

    const lastHealthEvent =
      normalizeHealthEvent(deviceInfo.last_health_event ?? deviceInfo.lastHealthEvent) ??
      this.status.lastHealthEvent;
    const captureSnapshot = normalizeCaptureSnapshot(deviceInfo.capture);
    const captureSession =
      captureSnapshot && captureSnapshot.active
        ? {
            active: captureSnapshot.active,
            sequenceId: captureSnapshot.sequenceId,
            state: captureSnapshot.state ?? "idle",
            progressPct: captureSnapshot.progressPct,
            stepIndex: captureSnapshot.stepIndex,
            stepCount: captureSnapshot.stepCount,
            outcome: captureSnapshot.lastOutcome,
          }
        : this.status.captureSession;

    this.patchStatus({
      deviceInfo,
      deviceName: deviceInfo.name ?? this.status.deviceName,
      pairingState:
        deviceInfo.pairing_state ??
        deviceInfo.pairingState ??
        this.status.pairingState ??
        "unknown",
      statusMode:
        deviceInfo.status_mode ??
        deviceInfo.statusMode ??
        this.status.statusMode ??
        "unknown",
      telemetrySubscribed:
        this.status.controlReady || deviceInfo.telemetry_streaming
          ? Boolean(deviceInfo.telemetry_streaming)
          : this.status.telemetrySubscribed,
      lastHealthEvent,
      captureSession,
    });
  }

  private finishDisconnect(error: DeviceBleError | null): void {
    this.eventsReady = false;
    this.eventsSubscription?.remove();
    this.disconnectSubscription?.remove();
    this.eventsSubscription = null;
    this.disconnectSubscription = null;
    this.connection = null;
    this.rejectPendingReplies(error);

    this.patchStatus({
      connected: false,
      isConnected: false,
      signal: undefined,
      controlReady: false,
      telemetrySubscribed: false,
      connectionPhase: "idle",
      captureSession:
        this.status.captureSession?.active
          ? {
              ...this.status.captureSession,
              active: false,
              state: "failed",
              outcome: "failed",
              reason: error?.message ?? "transport_disconnected",
            }
          : this.status.captureSession,
      error,
    });
  }

  private rejectPendingReplies(error: DeviceBleError | null): void {
    for (const [requestId, pending] of this.pendingReplies.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(
        error ?? {
          code: "disconnected",
          message: "The BLE connection was disconnected.",
          reason: null,
          nativeCode: null,
        }
      );
      this.pendingReplies.delete(requestId);
    }
  }

  private clearPendingReply(requestId: string): void {
    const pending = this.pendingReplies.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingReplies.delete(requestId);
  }

  private async sendCaptureCommand(
    command: UnoqControlCommand,
    args: Record<string, unknown> = {}
  ): Promise<DeviceStatus> {
    await this.initialize();

    if (!this.connection || !this.status.controlReady) {
      this.failWithError({
        code: "unauthorized",
        message: "Claim the device before starting the capture sequence.",
        reason: null,
        nativeCode: null,
      });
      return this.getSnapshot();
    }

    try {
      const reply = await this.sendCommand(command, args);
      if (!reply.ok) {
        throw toProtocolError(reply.error);
      }

      if (command === "capture.start") {
        const sequenceId =
          typeof reply.result?.sequence_id === "string"
            ? reply.result.sequence_id
            : this.status.captureSession?.sequenceId;
        const currentSession = this.status.captureSession;
        if (!currentSession || currentSession.sequenceId !== sequenceId) {
          this.patchStatus({
            captureSession: {
              active: true,
              sequenceId,
              state: "preflight",
            },
          });
        }
      }

      return this.getSnapshot();
    } catch (error) {
      this.failWithError(asDeviceBleError(error, "write_failed"));
      return this.getSnapshot();
    }
  }

  private setPhase(connectionPhase: DeviceConnectionPhase): void {
    this.patchStatus({ connectionPhase });
  }

  private failWithError(error: DeviceBleError): void {
    this.patchStatus({
      error,
      connectionPhase: "error",
      controlReady: false,
      telemetrySubscribed: false,
    });
  }

  private patchStatus(patch: Partial<DeviceStatus>): void {
    this.status = {
      ...this.status,
      ...patch,
      isConnected: patch.connected ?? this.status.connected,
    };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function asDeviceBleError(
  error: unknown,
  fallbackCode: DeviceBleError["code"]
): DeviceBleError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as DeviceBleError).message === "string"
  ) {
    return error as DeviceBleError;
  }

  return toBleError(error, fallbackCode);
}

function cloneStatus(status: DeviceStatus): DeviceStatus {
  return {
    ...status,
    discoveredDevices: status.discoveredDevices.map((device) => ({ ...device })),
    deviceInfo: status.deviceInfo ? { ...status.deviceInfo } : undefined,
    lastTelemetry: status.lastTelemetry
      ? {
          ...status.lastTelemetry,
          faults: [...(status.lastTelemetry.faults ?? [])],
        }
      : undefined,
    lastHealthEvent: status.lastHealthEvent
      ? {
          ...status.lastHealthEvent,
          checks: status.lastHealthEvent.checks
            ? { ...status.lastHealthEvent.checks }
            : undefined,
        }
      : undefined,
    captureSession: status.captureSession ? { ...status.captureSession } : null,
    error: status.error ? { ...status.error } : null,
  };
}

export const deviceService = new DeviceService();
