import { PermissionsAndroid, Platform } from "react-native";
import {
  BleError,
  BleManager,
  Device,
  ScanMode,
  State,
  Subscription,
} from "react-native-ble-plx";
import { DeviceBluetoothState, DiscoveredDevice } from "@/types";
import {
  UNOQ_SERVICE_UUID,
  decodeCharacteristicValue,
  encodeCharacteristicValue,
  matchesUnoqAdvertisement,
  toDiscoveredDevice,
} from "./unoqProtocol";

export interface BleManagerLike {
  state(): Promise<State>;
  onStateChange(
    listener: (newState: State) => void,
    emitCurrentState?: boolean
  ): Subscription;
  startDeviceScan(
    serviceUUIDs: string[] | null,
    options: { allowDuplicates?: boolean; scanMode?: ScanMode } | null,
    listener: (error: BleError | null, device: Device | null) => void
  ): Promise<void>;
  stopDeviceScan(): Promise<void> | void;
  connectToDevice(
    deviceIdentifier: string,
    options?: { timeout?: number }
  ): Promise<Device>;
  cancelDeviceConnection(deviceIdentifier: string): Promise<Device>;
}

export interface BleConnectionLike {
  readonly id: string;
  readonly name: string | null;
  readonly localName: string | null;
  readonly rssi: number | null;
  readRSSI(): Promise<{ rssi: number | null }>;
  readText(serviceUUID: string, characteristicUUID: string): Promise<string>;
  writeTextWithResponse(
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<void>;
  monitorText(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (value: string) => void,
    errorListener: (error: BleError) => void
  ): Subscription;
  onDisconnected(listener: (error: BleError | null, device: Device) => void): Subscription;
  cancelConnection(): Promise<Device>;
  isConnected(): Promise<boolean>;
}

export class UnoqBleConnection implements BleConnectionLike {
  private currentDevice: Device;

  constructor(device: Device) {
    this.currentDevice = device;
  }

  get id(): string {
    return this.currentDevice.id;
  }

  get name(): string | null {
    return this.currentDevice.name;
  }

  get localName(): string | null {
    return this.currentDevice.localName;
  }

  get rssi(): number | null {
    return this.currentDevice.rssi;
  }

  async readRSSI(): Promise<{ rssi: number | null }> {
    this.currentDevice = await this.currentDevice.readRSSI();
    return { rssi: this.currentDevice.rssi };
  }

  async readText(
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string> {
    const characteristic = await this.currentDevice.readCharacteristicForService(
      serviceUUID,
      characteristicUUID
    );
    return decodeCharacteristicValue(characteristic.value);
  }

  async writeTextWithResponse(
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<void> {
    await this.currentDevice.writeCharacteristicWithResponseForService(
      serviceUUID,
      characteristicUUID,
      encodeCharacteristicValue(value)
    );
  }

  monitorText(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (value: string) => void,
    errorListener: (error: BleError) => void
  ): Subscription {
    return this.currentDevice.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          errorListener(error);
          return;
        }

        if (!characteristic) return;
        listener(decodeCharacteristicValue(characteristic.value));
      }
    );
  }

  onDisconnected(listener: (error: BleError | null, device: Device) => void): Subscription {
    return this.currentDevice.onDisconnected(listener);
  }

  cancelConnection(): Promise<Device> {
    return this.currentDevice.cancelConnection();
  }

  isConnected(): Promise<boolean> {
    return this.currentDevice.isConnected();
  }
}

export interface UnoqBleClientLike {
  getState(): Promise<DeviceBluetoothState>;
  observeState(listener: (state: DeviceBluetoothState) => void): Subscription;
  scanOnce(timeoutMs?: number): Promise<DiscoveredDevice[]>;
  connect(peripheralId: string): Promise<BleConnectionLike>;
  disconnect(peripheralId: string): Promise<void>;
}

export class UnoqBleClient implements UnoqBleClientLike {
  private manager: BleManagerLike | null;
  private managerInitError: Error | null;

  constructor(manager?: BleManagerLike | null) {
    this.manager = manager ?? null;
    this.managerInitError = null;
  }

  async getState(): Promise<DeviceBluetoothState> {
    const manager = this.getManagerOrNull();
    if (!manager) {
      return "Unsupported";
    }

    return (await manager.state()) as DeviceBluetoothState;
  }

  observeState(listener: (state: DeviceBluetoothState) => void): Subscription {
    const manager = this.getManagerOrNull();
    if (!manager) {
      listener("Unsupported");
      return createNoopSubscription();
    }

    return manager.onStateChange(
      (state) => listener(state as DeviceBluetoothState),
      true
    );
  }

  async scanOnce(timeoutMs = 8000): Promise<DiscoveredDevice[]> {
    const manager = this.requireManager();
    await ensureScanPermissions();

    return await new Promise<DiscoveredDevice[]>((resolve, reject) => {
      const discovered = new Map<string, DiscoveredDevice>();
      let finished = false;

      const finish = (callback: () => void) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        void manager.stopDeviceScan();
        callback();
      };

      const timer = setTimeout(() => {
        finish(() => {
          resolve(
            Array.from(discovered.values()).sort((left, right) => {
              return (right.rssi ?? -999) - (left.rssi ?? -999);
            })
          );
        });
      }, timeoutMs);

      manager
        .startDeviceScan(
          [UNOQ_SERVICE_UUID],
          {
            allowDuplicates: false,
            scanMode: Platform.OS === "android" ? ScanMode.LowLatency : undefined,
          },
          (error, device) => {
            if (error) {
              finish(() => reject(error));
              return;
            }

            if (!device || !matchesUnoqAdvertisement(device)) return;
            discovered.set(device.id, toDiscoveredDevice(device));
          }
        )
        .catch((error) => finish(() => reject(error)));
    });
  }

  async connect(peripheralId: string): Promise<UnoqBleConnection> {
    const manager = this.requireManager();
    const device = await manager.connectToDevice(peripheralId, {
      timeout: 15000,
    });
    const discovered = await device.discoverAllServicesAndCharacteristics();
    return new UnoqBleConnection(discovered);
  }

  async disconnect(peripheralId: string): Promise<void> {
    const manager = this.requireManager();
    await manager.cancelDeviceConnection(peripheralId);
  }

  private getManagerOrNull(): BleManagerLike | null {
    if (this.manager) {
      return this.manager;
    }

    if (this.managerInitError) {
      return null;
    }

    try {
      this.manager = new BleManager();
      return this.manager;
    } catch (error) {
      this.managerInitError =
        error instanceof Error
          ? error
          : new Error("The BLE native module is unavailable in this runtime.");
      return null;
    }
  }

  private requireManager(): BleManagerLike {
    const manager = this.getManagerOrNull();
    if (manager) {
      return manager;
    }

    throw createNativeModuleUnavailableError(this.managerInitError);
  }
}

function createNoopSubscription(): Subscription {
  return {
    remove() {},
  } as Subscription;
}

function createNativeModuleUnavailableError(cause?: Error | null): Error {
  const error = new Error(
    "Bluetooth requires a development build with the react-native-ble-plx native module."
  );
  Object.assign(error, {
    errorCode: 102,
    reason: cause?.message ?? "native_module_unavailable",
  });
  return error;
}

async function ensureScanPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  const version =
    typeof Platform.Version === "number"
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);

  const permissions =
    version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  const denied = Object.values(results).some(
    (result) => result !== PermissionsAndroid.RESULTS.GRANTED
  );

  if (denied) {
    throw new Error("Bluetooth permissions were denied.");
  }
}
