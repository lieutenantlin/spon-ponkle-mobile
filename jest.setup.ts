jest.mock("react-native-ble-plx", () => {
  class BleManager {
    state = jest.fn(async () => "PoweredOff");
    onStateChange = jest.fn((_listener, _emitCurrentState) => ({
      remove: jest.fn(),
    }));
    startDeviceScan = jest.fn(async () => undefined);
    stopDeviceScan = jest.fn(async () => undefined);
    connectToDevice = jest.fn(async () => {
      throw new Error("connectToDevice must be mocked in tests.");
    });
    cancelDeviceConnection = jest.fn(async () => ({}));
  }

  return {
    BleManager,
    ScanMode: {
      LowLatency: 2,
    },
    State: {
      Unknown: "Unknown",
      Resetting: "Resetting",
      Unsupported: "Unsupported",
      Unauthorized: "Unauthorized",
      PoweredOff: "PoweredOff",
      PoweredOn: "PoweredOn",
    },
  };
});

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
