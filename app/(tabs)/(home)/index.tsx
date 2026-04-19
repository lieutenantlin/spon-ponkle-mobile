import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Radio, Upload, Waves } from "lucide-react-native";
import ScreenHeader from "@/components/ScreenHeader";
import SampleListItem from "@/components/SampleListItem";
import PrimaryButton from "@/components/PrimaryButton";
import SecondaryButton from "@/components/SecondaryButton";
import EmptyState from "@/components/EmptyState";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useDevice } from "@/providers/DeviceProvider";
import { useSamples } from "@/providers/SamplesProvider";

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { status } = useDevice();
  const {
    samples,
    isLoading,
    isRefetching,
    refetch,
    retryAllFailed,
    isRetrying,
  } = useSamples();

  const latestSamples = samples.slice(0, 3);
  const pendingCount = samples.filter((sample) => sample.uploadStatus !== "uploaded").length;
  const estimatedSamples = samples.filter(
    (sample) => sample.microplasticEstimate !== undefined
  );
  const avgEstimate = estimatedSamples.length
    ? (
        estimatedSamples.reduce(
          (sum, sample) => sum + (sample.microplasticEstimate ?? 0),
          0
        ) / estimatedSamples.length
      ).toFixed(1)
    : "0.0";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} />
        }
      >
        <ScreenHeader
          eyebrow="Field Ops"
          title={`Welcome, ${user?.name?.split(" ")[0] ?? "Researcher"}`}
          subtitle="Monitor coastal microplastic readings, launch scans, and review recent uploads."
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Today&apos;s snapshot</Text>
          <Text style={styles.heroValue}>{avgEstimate} particles/L</Text>
          <Text style={styles.heroBody}>
            Average concentration across {estimatedSamples.length} modeled samples in local storage. Newly captured device runs stay pending until the analysis model is available.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton
              title="Start new scan"
              onPress={() => router.push("/scan/capture")}
              style={styles.flexButton}
            />
            <SecondaryButton
              title={isRetrying ? "Retrying..." : "Retry uploads"}
              onPress={() => void retryAllFailed()}
              disabled={isRetrying || pendingCount === 0}
              icon={<Upload size={16} color={Colors.light.text} />}
              style={styles.flexButton}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <MetricCard
            icon={<Radio size={18} color={Colors.light.tint} />}
            label="Device"
            value={
              status.connected
                ? status.controlReady
                  ? "Ready"
                  : "Needs claim"
                : "Offline"
            }
            hint={
              status.connected
                ? status.deviceName ??
                  "Connected. Open device setup if this phone still needs to claim control."
                : "No edge device paired"
            }
          />
          <MetricCard
            icon={<Upload size={18} color={Colors.light.tint} />}
            label="Queued"
            value={pendingCount.toString()}
            hint={pendingCount === 1 ? "sample needs sync" : "samples need sync"}
          />
        </View>

        <MetricCard
          icon={<MapPin size={18} color={Colors.light.tint} />}
          label="Last location"
          value={samples[0]?.locationLabel ?? "No samples captured yet"}
          hint={samples[0] ? samples[0].sampleId : "Capture your first field sample"}
          fullWidth
        />

        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Recent samples</Text>
            <Text style={styles.sectionSub}>Most recent captures and sync state.</Text>
          </View>
          <SecondaryButton
            title="View all"
            onPress={() => router.push("/(tabs)/history")}
            style={styles.inlineButton}
          />
        </View>

        {latestSamples.length ? (
          <View style={styles.list}>
            {latestSamples.map((sample) => (
              <SampleListItem
                key={sample.id}
                sample={sample}
                onPress={() => router.push(`/sample/${sample.id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={<Waves size={28} color={Colors.light.tint} />}
            title="No samples yet"
            message="Run a device-guided capture to save your first local sample and telemetry snapshot."
            action={
              <PrimaryButton
                title="Capture sample"
                onPress={() => router.push("/scan/capture")}
              />
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  fullWidth,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.metricCard, fullWidth && styles.metricCardFull]}>
      <View style={styles.metricIcon}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  content: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  heroCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.light.tint,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heroEyebrow: {
    color: Colors.light.aqua,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroValue: {
    color: Colors.light.surface,
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: -1,
  },
  heroBody: {
    color: "#D9F2F4",
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  flexButton: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 6,
  },
  metricCardFull: {
    marginHorizontal: Spacing.xl,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surfaceAlt,
    marginBottom: 6,
  },
  metricLabel: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  metricValue: {
    color: Colors.light.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  metricHint: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.light.text,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  sectionSub: {
    marginTop: 4,
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
  },
  inlineButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  list: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
});
