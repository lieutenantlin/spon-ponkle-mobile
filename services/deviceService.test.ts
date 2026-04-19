import { DeviceService, DeviceStorageLike } from "./deviceService";
import { BleConnectionLike, UnoqBleClientLike } from "./device/bleClient";

class MemoryStorage implements DeviceStorageLike {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("DeviceService", () => {
  it("claims authorization, retries notifications, and subscribes to telemetry", async () => {
    let emitMessage: ((payload: string) => void) | null = null;
    let monitorAttempts = 0;
    let deviceInfoReadCount = 0;

    const connection: BleConnectionLike = {
      id: "peripheral-1",
      name: "UNO Q Tank",
      localName: "UNO Q Tank",
      rssi: -48,
      readRSSI: jest.fn(async () => ({ rssi: -48 })),
      readText: jest.fn(async () => {
        deviceInfoReadCount += 1;
        return JSON.stringify({
          name: "UNO Q Tank Controller",
          pairing_state: deviceInfoReadCount > 1 ? "authorized" : "pairing",
          status_mode: "connected",
          telemetry_streaming: deviceInfoReadCount > 2,
        });
      }),
      writeTextWithResponse: jest.fn(async (_serviceUuid, _characteristicUuid, value) => {
        const request = JSON.parse(value) as { id: string; cmd: string };
        if (!emitMessage) return;

        if (request.cmd === "sensors.read") {
          setTimeout(() => {
            emitMessage?.(
              JSON.stringify({
                reply_to: request.id,
                ok: true,
                result: {
                  timestamp_ms: 1,
                  temp_c: 21.5,
                  light_raw: 800,
                  light_pct: 42,
                  water_raw: 900,
                  water_pct: 50,
                  temp_valid: true,
                  light_valid: true,
                  water_valid: true,
                  sensor_fault: false,
                  faults: [],
                },
              })
            );
          }, 0);
        }

        if (request.cmd === "telemetry.subscribe") {
          setTimeout(() => {
            emitMessage?.(
              JSON.stringify({
                reply_to: request.id,
                ok: true,
                result: { enabled: true },
              })
            );
          }, 0);
        }
      }),
      monitorText: jest.fn((_serviceUuid, _characteristicUuid, listener, errorListener) => {
        monitorAttempts += 1;
        if (monitorAttempts === 1) {
          errorListener({ message: "notification setup failed", errorCode: 403 } as never);
        }
        emitMessage = listener;
        return { remove: jest.fn() };
      }),
      onDisconnected: jest.fn(() => ({ remove: jest.fn() })),
      cancelConnection: jest.fn(async () => ({} as never)),
      isConnected: jest.fn(async () => true),
    };

    const client: UnoqBleClientLike = {
      getState: jest.fn(async () => "PoweredOn"),
      observeState: jest.fn(() => ({ remove: jest.fn() })),
      scanOnce: jest.fn(async () => []),
      connect: jest.fn(async () => connection),
      disconnect: jest.fn(async () => undefined),
    };

    const service = new DeviceService(client, new MemoryStorage());

    await service.initialize();
    await service.connect("peripheral-1");
    const status = await service.claimAuthorization();

    expect(status.connected).toBe(true);
    expect(status.controlReady).toBe(true);
    expect(status.telemetrySubscribed).toBe(true);
    expect(status.pairingState).toBe("authorized");
    expect(status.lastTelemetry?.temp_c).toBe(21.5);
    expect(connection.writeTextWithResponse).toHaveBeenCalledTimes(3);
    expect(monitorAttempts).toBe(2);
  });

  it("times out when the device never replies", async () => {
    jest.useFakeTimers();

    const connection: BleConnectionLike = {
      id: "peripheral-2",
      name: "UNO Q Tank",
      localName: "UNO Q Tank",
      rssi: -50,
      readRSSI: jest.fn(async () => ({ rssi: -50 })),
      readText: jest.fn(async () =>
        JSON.stringify({
          name: "UNO Q Tank Controller",
          pairing_state: "pairing",
          status_mode: "connected",
        })
      ),
      writeTextWithResponse: jest.fn(async () => undefined),
      monitorText: jest.fn((_serviceUuid, _characteristicUuid, listener) => {
        void listener;
        return { remove: jest.fn() };
      }),
      onDisconnected: jest.fn(() => ({ remove: jest.fn() })),
      cancelConnection: jest.fn(async () => ({} as never)),
      isConnected: jest.fn(async () => true),
    };

    const client: UnoqBleClientLike = {
      getState: jest.fn(async () => "PoweredOn"),
      observeState: jest.fn(() => ({ remove: jest.fn() })),
      scanOnce: jest.fn(async () => []),
      connect: jest.fn(async () => connection),
      disconnect: jest.fn(async () => undefined),
    };

    const service = new DeviceService(client, new MemoryStorage());

    await service.initialize();
    await service.connect("peripheral-2");

    const claimPromise = service.claimAuthorization();
    await jest.advanceTimersByTimeAsync(8001);
    const status = await claimPromise;

    expect(status.error?.code).toBe("reply_timeout");

    jest.useRealTimers();
  });

  it("tracks capture state from BLE events", async () => {
    let emitMessage: ((payload: string) => void) | null = null;

    const connection: BleConnectionLike = {
      id: "peripheral-3",
      name: "UNO Q Tank",
      localName: "UNO Q Tank",
      rssi: -47,
      readRSSI: jest.fn(async () => ({ rssi: -47 })),
      readText: jest.fn(async () =>
        JSON.stringify({
          name: "UNO Q Tank Controller",
          pairing_state: "authorized",
          status_mode: "connected",
          telemetry_streaming: true,
          capture: {
            active: false,
          },
        })
      ),
      writeTextWithResponse: jest.fn(async (_serviceUuid, _characteristicUuid, value) => {
        const request = JSON.parse(value) as { id: string; cmd: string };
        if (!emitMessage) return;

        if (request.cmd === "sensors.read") {
          setTimeout(() => {
            emitMessage?.(JSON.stringify({ reply_to: request.id, ok: true, result: {} }));
          }, 0);
        }

        if (request.cmd === "telemetry.subscribe") {
          setTimeout(() => {
            emitMessage?.(
              JSON.stringify({ reply_to: request.id, ok: true, result: { enabled: true } })
            );
          }, 0);
        }

        if (request.cmd === "capture.start") {
          setTimeout(() => {
            emitMessage?.(
              JSON.stringify({
                reply_to: request.id,
                ok: true,
                result: { sequence_id: "seq-1" },
              })
            );
            emitMessage?.(
              JSON.stringify({
                event: "capture.state",
                data: {
                  sequence_id: "seq-1",
                  state: "mixing",
                  step_index: 1,
                  step_count: 5,
                  progress_pct: 20,
                },
              })
            );
          }, 0);
        }
      }),
      monitorText: jest.fn((_serviceUuid, _characteristicUuid, listener) => {
        emitMessage = listener;
        return { remove: jest.fn() };
      }),
      onDisconnected: jest.fn(() => ({ remove: jest.fn() })),
      cancelConnection: jest.fn(async () => ({} as never)),
      isConnected: jest.fn(async () => true),
    };

    const client: UnoqBleClientLike = {
      getState: jest.fn(async () => "PoweredOn"),
      observeState: jest.fn(() => ({ remove: jest.fn() })),
      scanOnce: jest.fn(async () => []),
      connect: jest.fn(async () => connection),
      disconnect: jest.fn(async () => undefined),
    };

    const service = new DeviceService(client, new MemoryStorage());

    await service.initialize();
    await service.connect("peripheral-3");
    await service.claimAuthorization();
    await service.startCapture();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = service.getSnapshot();

    expect(status.captureSession?.sequenceId).toBe("seq-1");
    expect(status.captureSession?.state).toBe("mixing");
    expect(status.captureSession?.progressPct).toBe(20);
  });
});
