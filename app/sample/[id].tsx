import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { MapPin, Upload } from "lucide-react-native";
import ResultCard from "@/components/ResultCard";
import StatusBadge from "@/components/StatusBadge";
import SecondaryButton from "@/components/SecondaryButton";
import EmptyState from "@/components/EmptyState";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useSampleById, useSamples } from "@/providers/SamplesProvider";
import { formatCoords, formatDateTime } from "@/utils/format";

export default function SampleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sample = useSampleById(id);
  const { syncSample, isSyncing } = useSamples();

  if (!sample) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Sample" }} />
        <EmptyState title="Sample not found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: sample.sampleId }} />
      <ScrollView contentContainerStyle={styles.content}>
        {sample.imageUri ? (
          <View style={styles.imageCard}>
            <Image source={{ uri: sample.imageUri }} style={styles.image} />
          </View>
        ) : null}

        <ResultCard
          estimate={sample.microplasticEstimate}
          unit={sample.unit}
          confidence={sample.confidence}
          modelVersion={sample.modelVersion}
          status={sample.inferenceStatus}
          summary={sample.inferenceSummary}
        />

        <View style={styles.card}>
          <Row label="Sample ID" value={sample.sampleId} />
          <Row label="Captured" value={formatDateTime(sample.capturedAt)} />
          <Row
            label="Location"
            value={
              sample.locationLabel ??
              formatCoords(sample.latitude, sample.longitude)
            }
            icon={<MapPin size={14} color={Colors.light.textMuted} />}
          />
          {sample.waterSource ? (
            <Row label="Source" value={sample.waterSource} />
          ) : null}
          {sample.temperatureC !== undefined ? (
            <Row label="Temp" value={`${sample.temperatureC} °C`} />
          ) : null}
          {sample.phLevel !== undefined ? (
            <Row label="pH" value={sample.phLevel.toString()} />
          ) : null}
          {sample.deviceId ? (
            <Row label="Device" value={sample.deviceId} />
          ) : null}
          {sample.sequenceId ? (
            <Row label="Sequence" value={sample.sequenceId} />
          ) : null}
          {sample.captureOutcome ? (
            <Row label="Capture outcome" value={sample.captureOutcome} />
          ) : null}
          {sample.captureReason ? (
            <Row label="Capture reason" value={sample.captureReason} />
          ) : null}
          <View style={styles.statusRow}>
            <Text style={styles.label}>Sync</Text>
            <StatusBadge status={sample.uploadStatus} small />
          </View>
        </View>

        {sample.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesBody}>{sample.notes}</Text>
          </View>
        ) : null}

        {sample.uploadStatus !== "uploaded" ? (
          <SecondaryButton
            title={isSyncing ? "Checking…" : "Backend upload not configured"}
            onPress={() => syncSample(sample)}
            disabled
            icon={<Upload size={16} color={Colors.light.text} />}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>
        {icon}
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  imageCard: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  image: { width: "100%", height: 220 },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.light.textMuted,
    fontWeight: FontWeight.semibold,
  },
  valueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    maxWidth: "60%",
  },
  value: {
    fontSize: FontSize.sm,
    color: Colors.light.text,
    fontWeight: FontWeight.semibold,
  },
  notesCard: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  notesTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesBody: { fontSize: FontSize.md, color: Colors.light.text, lineHeight: 22 },
});
