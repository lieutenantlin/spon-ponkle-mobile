import createContextHook from "@nkzw/create-context-hook";
import { AppState } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceStatus } from "@/types";
import { DEFAULT_DEVICE_STATUS, DeviceServiceLike, deviceService } from "@/services/deviceService";

export function useProvideDevice(service: DeviceServiceLike = deviceService) {
  const [status, setStatus] = useState<DeviceStatus>(() => service.getSnapshot?.() ?? DEFAULT_DEVICE_STATUS);

  useEffect(() => {
    let active = true;
    const unsubscribe = service.subscribe((next) => {
      if (active) {
        setStatus(next);
      }
    });

    void service
      .initialize()
      .then((next) => {
        if (active) {
          setStatus(next);
        }
        return service.restoreConnection();
      })
      .catch(() => undefined);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void service.restoreConnection().catch(() => undefined);
      }
    });

    return () => {
      active = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [service]);

  const busy = useMemo(() => {
    return !["idle", "connected", "error"].includes(status.connectionPhase);
  }, [status.connectionPhase]);

  const scan = useCallback(async () => {
    await service.scan();
  }, [service]);

  const connect = useCallback(
    async (peripheralId: string) => {
      await service.connect(peripheralId);
    },
    [service]
  );

  const claimAuthorization = useCallback(async () => {
    await service.claimAuthorization();
  }, [service]);

  const disconnect = useCallback(async () => {
    await service.disconnect();
  }, [service]);

  const refreshDeviceInfo = useCallback(async () => {
    await service.refreshDeviceInfo();
  }, [service]);

  const startCapture = useCallback(async () => {
    await service.startCapture();
  }, [service]);

  const confirmPhonePositioned = useCallback(
    async (sequenceId: string) => {
      await service.confirmPhonePositioned(sequenceId);
    },
    [service]
  );

  const confirmCameraReady = useCallback(
    async (sequenceId: string) => {
      await service.confirmCameraReady(sequenceId);
    },
    [service]
  );

  const completeCapture = useCallback(
    async (sequenceId: string, outcome: "success" = "success", metadata?: Record<string, unknown>) => {
      await service.completeCapture(sequenceId, outcome, metadata);
    },
    [service]
  );

  const cancelCapture = useCallback(
    async (sequenceId: string, reason?: string) => {
      await service.cancelCapture(sequenceId, reason);
    },
    [service]
  );

  return {
    status,
    busy,
    scan,
    connect,
    claimAuthorization,
    disconnect,
    refreshDeviceInfo,
    startCapture,
    confirmPhonePositioned,
    confirmCameraReady,
    completeCapture,
    cancelCapture,
  };
}

export const [DeviceProvider, useDevice] = createContextHook(useProvideDevice);
