import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import {
  Camera,
  ImageIcon,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";
import SecondaryButton from "@/components/SecondaryButton";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useDevice } from "@/providers/DeviceProvider";
import { useScanDraft } from "@/providers/ScanDraftProvider";
import { cameraService } from "@/services/cameraService";

export default function CaptureScreen() {
  const router = useRouter();
  const {
    status,
    busy,
    startCapture,
    confirmPhonePositioned,
    confirmCameraReady,
    completeCapture,
    cancelCapture,
  } = useDevice();
  const { draft, setImage, setCaptureSession, clearImages } = useScanDraft();
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraArmed, setCameraArmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const captureStartedRef = useRef(false);

  const captureSession = status.captureSession ?? draft.captureSession ?? null;
  const sequenceId = captureSession?.sequenceId;
  const canContinue =
    captureSession?.state === "completed" && Boolean(draft.imageUri);

  useEffect(() => {
    setCaptureSession(status.captureSession);
  }, [setCaptureSession, status.captureSession]);

  useEffect(() => {
    if (
      !cameraArmed ||
      !sequenceId ||
      captureSession?.state !== "capturing" ||
      captureStartedRef.current
    ) {
      return;
    }

    captureStartedRef.current = true;
    setCameraBusy(true);

    void (async () => {
      try {
        const uri = await cameraService.captureImage();
        if (!uri) {
          throw new Error("No image was returned from the camera.");
        }
        setImage(uri);
        await completeCapture(sequenceId, "success", { capture_count: 1 });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "camera_capture_failed";
        setLocalError(reason);
        await cancelCapture(sequenceId, reason).catch(() => undefined);
      } finally {
        setCameraBusy(false);
        setCameraArmed(false);
      }
    })();
  }, [
    cameraArmed,
    captureSession?.state,
    cancelCapture,
    completeCapture,
    sequenceId,
    setImage,
  ]);

  const beginCapture = async () => {
    setLocalError(null);
    captureStartedRef.current = false;
    clearImages();
    await startCapture();
  };

  const onPhonePositioned = async () => {
    if (!sequenceId) return;
    setLocalError(null);
    await confirmPhonePositioned(sequenceId);
  };

  const onCameraReady = async () => {
    if (!sequenceId) return;
    setLocalError(null);
    captureStartedRef.current = false;
    setCameraArmed(true);
    await confirmCameraReady(sequenceId);
  };

  const onPickFromLibrary = async () => {
    if (!sequenceId) return;
    setCameraBusy(true);
    setLocalError(null);
    try {
      const uri = await cameraService.pickFromLibrary();
      if (!uri) return;
      setImage(uri);
      await completeCapture(sequenceId, "success", { capture_count: 1 });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "library_import_failed");
    } finally {
      setCameraBusy(false);
    }
  };

  const onCancel = async () => {
    if (!sequenceId) return;
    await cancelCapture(sequenceId, "user_cancelled");
  };

  const instruction =
    captureSession?.instruction ??
    (captureSession?.state === "mixing"
      ? "Keep the phone off the tank while the device mixes the sample."
      : captureSession?.state === "awaiting_phone_placement"
      ? "Place the phone over the tank, then confirm when it is positioned."
      : captureSession?.state === "awaiting_camera_ready"
      ? "Frame the sample, then confirm camera readiness."
      : captureSession?.state === "capturing"
      ? "The device is ready. Capturing the phone image now."
      : captureSession?.state === "finalizing"
      ? "Finalizing the device-owned capture sequence."
      : "Start a device-guided capture to let UNO Q drive the sequence.");

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Capture sample" }} />

      <View style={styles.viewfinder}>
        {draft.imageUri ? (
          <Image source={{ uri: draft.imageUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.reticle}>
              <ScanLine size={40} color={Colors.palette.aqua} />
            </View>
            <Text style={styles.placeholderTitle}>UNO Q guided capture</Text>
            <Text style={styles.placeholderSub}>{instruction}</Text>
          </View>
        )}
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Capture state</Text>
        <Text style={styles.statusValue}>
          {captureSession ? formatCaptureState(captureSession.state) : "Idle"}
        </Text>
        <Text style={styles.statusHint}>
          {captureSession?.remainingMs
            ? `${instruction} ${Math.ceil(captureSession.remainingMs / 1000)}s remaining.`
            : instruction}
        </Text>
      </View>

      {!status.controlReady ? (
        <View style={styles.gateCard}>
          <ShieldAlert size={18} color={Colors.light.amber} />
          <View style={styles.gateBody}>
            <Text style={styles.gateTitle}>Device connection required</Text>
            <Text style={styles.gateText}>
              Connect and claim the UNO Q before starting the device-owned capture sequence.
            </Text>
          </View>
          <SecondaryButton title="Open device setup" onPress={() => router.push("/device" as never)} />
        </View>
      ) : null}

      {(status.error || localError) && !canContinue ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Latest issue</Text>
          <Text style={styles.errorText}>
            {localError ?? status.error?.message ?? "Unknown capture error"}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {!captureSession || captureSession.state === "idle" ? (
          <PrimaryButton
            title={busy ? "Starting..." : "Start device capture"}
            onPress={beginCapture}
            disabled={!status.controlReady || busy}
            icon={<Camera size={18} color="#fff" />}
          />
        ) : null}

        {captureSession?.state === "awaiting_phone_placement" ? (
          <PrimaryButton
            title="Phone Positioned"
            onPress={onPhonePositioned}
            disabled={busy}
          />
        ) : null}

        {captureSession?.state === "awaiting_camera_ready" ? (
          <>
            <PrimaryButton
              title={cameraBusy ? "Opening camera..." : "Camera Ready"}
              onPress={onCameraReady}
              loading={cameraBusy}
              disabled={busy || cameraBusy}
            />
            <Pressable onPress={onPickFromLibrary} style={styles.secondaryLink}>
              <ImageIcon size={16} color={Colors.light.tint} />
              <Text style={styles.secondaryLinkText}>Use photo library instead</Text>
            </Pressable>
          </>
        ) : null}

        {captureSession &&
        !["completed", "failed", "cancelled", "idle"].includes(captureSession.state) ? (
          <SecondaryButton
            title="Cancel capture"
            onPress={onCancel}
            disabled={busy || cameraBusy}
          />
        ) : null}

        {canContinue ? (
          <>
            <SecondaryButton
              title="Capture another sample"
              onPress={beginCapture}
              icon={<RefreshCw size={18} color={Colors.light.text} />}
            />
            <PrimaryButton
              title="Continue to metadata"
              onPress={() => router.push("/scan/metadata")}
              testID="capture-continue"
            />
          </>
        ) : null}

        {captureSession &&
        ["failed", "cancelled"].includes(captureSession.state) &&
        !canContinue ? (
          <PrimaryButton
            title="Restart capture"
            onPress={beginCapture}
            disabled={busy}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function formatCaptureState(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  viewfinder: {
    flex: 1,
    margin: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: "hidden",
    backgroundColor: Colors.palette.deepOcean,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", padding: Spacing.xl },
  reticle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: Colors.palette.aqua,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  placeholderTitle: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  placeholderSub: {
    color: "#B7D6DB",
    fontSize: FontSize.sm,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 20,
  },
  statusCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 4,
  },
  statusLabel: {
    color: Colors.light.textSubtle,
    fontSize: FontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: FontWeight.semibold,
  },
  statusValue: {
    color: Colors.light.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statusHint: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  gateCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.light.surfaceAlt,
    gap: Spacing.sm,
  },
  gateBody: { gap: 4 },
  gateTitle: {
    color: Colors.light.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  gateText: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  errorCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "#FFF2F2",
    borderWidth: 1,
    borderColor: "#F6CCCC",
    gap: 4,
  },
  errorTitle: {
    color: Colors.light.danger,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  errorText: {
    color: Colors.light.text,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
  },
  secondaryLinkText: {
    color: Colors.light.tint,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
