import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { CheckCircle2, Home, MapPin, Upload } from "lucide-react-native";
import ResultCard from "@/components/ResultCard";
import PrimaryButton from "@/components/PrimaryButton";
import SecondaryButton from "@/components/SecondaryButton";
import StatusBadge from "@/components/StatusBadge";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useScanDraft } from "@/providers/ScanDraftProvider";
import { useSamples } from "@/providers/SamplesProvider";
import { useDevice } from "@/providers/DeviceProvider";
import { WaterSample } from "@/types";
import { formatCoords, formatDateTime, newSampleId } from "@/utils/format";

export default function ResultScreen() {
  const router = useRouter();
  const { draft, reset } = useScanDraft();
  const { addSample, syncSample } = useSamples();
  const { status: device } = useDevice();
  const [saved, setSaved] = useState<WaterSample | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const result = draft.result;

  const sample = useMemo<WaterSample | null>(() => {
    if (!result) return null;
    return {
      id: `smp_${Date.now()}`,
      sampleId: newSampleId(),
      capturedAt: result.processedAt,
      latitude: draft.location?.latitude ?? 0,
      longitude: draft.location?.longitude ?? 0,
      microplasticEstimate: result.microplasticEstimate,
      unit: result.unit,
      confidence: result.confidence,
      modelVersion: result.modelVersion,
      inferenceStatus: result.status,
      inferenceSummary: result.summary,
      notes: draft.metadata.notes,
      imageUri: draft.imageUri ?? "",
      imageUris: draft.imageUris,
      uploadStatus: "pending",
      deviceId: device.deviceId,
      peripheralId: device.peripheralId,
      sequenceId: draft.captureSession?.sequenceId,
      captureOutcome: draft.captureSession?.outcome,
      captureReason: draft.captureSession?.reason,
      telemetrySnapshot: device.lastTelemetry ?? null,
      healthSnapshot: device.lastHealthEvent ?? null,
      deviceInfoSnapshot: device.deviceInfo,
      waterSource: draft.metadata.waterSource,
      temperatureC: draft.metadata.temperatureC,
      phLevel: draft.metadata.phLevel,
    };
  }, [result, draft, device]);

  useEffect(() => {
    (async () => {
      if (sample && !saved) {
        const created = await addSample(sample);
        setSaved(created);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample]);

  const onUpload = async () => {
    if (!saved) return;
    setUploading(true);
    try {
      const updated = await syncSample(saved);
      setSaved(updated);
    } finally {
      setUploading(false);
    }
  };

  const onDone = () => {
    reset();
    router.dismissAll();
    router.replace("/(tabs)/(home)");
  };

  if (!result || !sample) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.fallback}>No result available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Result" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.successRow}>
          <CheckCircle2 color={Colors.light.success} size={20} />
          <Text style={styles.successText}>Capture saved</Text>
        </View>

        <ResultCard
          estimate={result.microplasticEstimate}
          unit={result.unit}
          confidence={result.confidence}
          modelVersion={result.modelVersion}
          status={result.status}
          summary={result.summary}
        />

        {draft.imageUri ? (
          <View style={styles.imageCard}>
            <Image source={{ uri: draft.imageUri }} style={styles.image} />
            <Text style={styles.imageLabel}>Sample image</Text>
          </View>
        ) : null}

        <View style={styles.metaCard}>
          <MetaRow label="Sample ID" value={sample.sampleId} />
          <MetaRow label="Captured" value={formatDateTime(sample.capturedAt)} />
          <MetaRow
            label="Location"
            value={
              sample.latitude || sample.longitude
                ? formatCoords(sample.latitude, sample.longitude)
                : "—"
            }
            icon={<MapPin size={14} color={Colors.light.textMuted} />}
          />
          {sample.waterSource ? (
            <MetaRow label="Source" value={sample.waterSource} />
          ) : null}
          {sample.temperatureC !== undefined ? (
            <MetaRow label="Temp" value={`${sample.temperatureC} °C`} />
          ) : null}
          {sample.phLevel !== undefined ? (
            <MetaRow label="pH" value={sample.phLevel.toString()} />
          ) : null}
          {sample.sequenceId ? (
            <MetaRow label="Sequence" value={sample.sequenceId} />
          ) : null}
          {sample.captureOutcome ? (
            <MetaRow label="Capture" value={sample.captureOutcome} />
          ) : null}
          <View style={styles.syncRow}>
            <Text style={styles.metaLabel}>Sync</Text>
            <StatusBadge status={saved?.uploadStatus ?? "pending"} small />
          </View>
        </View>

        <View style={styles.actions}>
          <SecondaryButton
            title={
              "Backend upload not configured"
            }
            onPress={onUpload}
            disabled
            icon={<Upload size={16} color={Colors.light.text} />}
          />
          <PrimaryButton
            title="Done"
            onPress={onDone}
            icon={<Home size={18} color="#fff" />}
            testID="result-done"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <View style={styles.metaValueWrap}>
        {icon}
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  fallback: { padding: Spacing.xl, color: Colors.light.textMuted },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  successText: {
    color: Colors.light.success,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  imageCard: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  image: { width: "100%", height: 200 },
  imageLabel: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    color: Colors.light.textMuted,
    fontSize: FontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: FontWeight.semibold,
  },
  metaCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  metaLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textMuted,
    fontWeight: FontWeight.semibold,
  },
  metaValueWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  metaValue: { fontSize: FontSize.sm, color: Colors.light.text, fontWeight: FontWeight.semibold },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
  },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
});
