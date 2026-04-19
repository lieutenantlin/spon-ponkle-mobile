import React from "react";
import { AppState } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceStatus } from "@/types";
import { DEFAULT_DEVICE_STATUS, DeviceServiceLike } from "@/services/deviceService";
import { useProvideDevice } from "./DeviceProvider";

describe("useProvideDevice", () => {
  it("initializes and attempts a restore on mount and foreground", async () => {
    const listeners = new Set<(status: DeviceStatus) => void>();
    let snapshot: DeviceStatus = {
      ...DEFAULT_DEVICE_STATUS,
      bluetoothState: "PoweredOn",
    };

    const service: DeviceServiceLike = {
      initialize: jest.fn(async () => snapshot),
      getStatus: jest.fn(async () => snapshot),
      getSnapshot: jest.fn(() => snapshot),
      subscribe: jest.fn((listener) => {
        listeners.add(listener);
        listener(snapshot);
        return () => listeners.delete(listener);
      }),
      scan: jest.fn(async () => snapshot),
      connect: jest.fn(async () => snapshot),
      claimAuthorization: jest.fn(async () => snapshot),
      disconnect: jest.fn(async () => snapshot),
      refreshDeviceInfo: jest.fn(async () => snapshot),
      restoreConnection: jest.fn(async () => snapshot),
      startCapture: jest.fn(async () => snapshot),
      confirmPhonePositioned: jest.fn(async () => snapshot),
      confirmCameraReady: jest.fn(async () => snapshot),
      completeCapture: jest.fn(async () => snapshot),
      cancelCapture: jest.fn(async () => snapshot),
      runInference: jest.fn(async () => ({
        status: "pending" as const,
        microplasticEstimate: 0,
        unit: "particles/L" as const,
        confidence: 0,
        modelVersion: "mock",
        processedAt: new Date().toISOString(),
      })),
    };

    const appStateListeners: Array<(state: string) => void> = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "change") {
          appStateListeners.push(listener as (state: string) => void);
        }
        return { remove: jest.fn() } as never;
      });

    renderHook(() => useProvideDevice(service));

    await waitFor(() => {
      expect(service.initialize).toHaveBeenCalledTimes(1);
      expect(service.restoreConnection).toHaveBeenCalledTimes(1);
    });

    act(() => {
      appStateListeners[0]?.("active");
    });

    await waitFor(() => {
      expect(service.restoreConnection).toHaveBeenCalledTimes(2);
    });
  });

  it("proxies claimAuthorization and updates state from service subscriptions", async () => {
    const listeners = new Set<(status: DeviceStatus) => void>();
    let snapshot: DeviceStatus = {
      ...DEFAULT_DEVICE_STATUS,
      bluetoothState: "PoweredOn",
    };

    const emit = (next: DeviceStatus) => {
      snapshot = next;
      listeners.forEach((listener) => listener(next));
    };

    const service: DeviceServiceLike = {
      initialize: jest.fn(async () => snapshot),
      getStatus: jest.fn(async () => snapshot),
      getSnapshot: jest.fn(() => snapshot),
      subscribe: jest.fn((listener) => {
        listeners.add(listener);
        listener(snapshot);
        return () => listeners.delete(listener);
      }),
      scan: jest.fn(async () => snapshot),
      connect: jest.fn(async () => snapshot),
      claimAuthorization: jest.fn(async () => {
        emit({
          ...snapshot,
          connected: true,
          controlReady: true,
          telemetrySubscribed: true,
          connectionPhase: "connected",
        });
        return snapshot;
      }),
      disconnect: jest.fn(async () => snapshot),
      refreshDeviceInfo: jest.fn(async () => snapshot),
      restoreConnection: jest.fn(async () => snapshot),
      startCapture: jest.fn(async () => snapshot),
      confirmPhonePositioned: jest.fn(async () => snapshot),
      confirmCameraReady: jest.fn(async () => snapshot),
      completeCapture: jest.fn(async () => snapshot),
      cancelCapture: jest.fn(async () => snapshot),
      runInference: jest.fn(async () => ({
        status: "pending" as const,
        microplasticEstimate: 0,
        unit: "particles/L" as const,
        confidence: 0,
        modelVersion: "mock",
        processedAt: new Date().toISOString(),
      })),
    };

    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(() => ({ remove: jest.fn() }) as never);

    const { result } = renderHook(() => useProvideDevice(service));

    await waitFor(() => {
      expect(service.initialize).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.claimAuthorization();
    });

    expect(service.claimAuthorization).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.status.controlReady).toBe(true);
      expect(result.current.status.telemetrySubscribed).toBe(true);
    });
  });
});
