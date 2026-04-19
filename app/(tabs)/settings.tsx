import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Activity, LogOut, Radio, RotateCcw } from "lucide-react-native";
import ScreenHeader from "@/components/ScreenHeader";
import PrimaryButton from "@/components/PrimaryButton";
import SecondaryButton from "@/components/SecondaryButton";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useDevice } from "@/providers/DeviceProvider";
import { useSamples } from "@/providers/SamplesProvider";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { status } = useDevice();
  const { samples, retryAllFailed, isRetrying } = useSamples();

  const queuedCount = samples.filter((sample) => sample.uploadStatus !== "uploaded").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader
        eyebrow="Session"
        title="Settings"
        subtitle="Inspect the local session, BLE hardware connection, and samples waiting for a future backend."
      />

      <View style={styles.content}>
        <Card
          icon={<Activity size={18} color={Colors.light.tint} />}
          title="Signed in user"
          body={user?.email ?? "No user session"}
          footnote={user?.organization ?? "Mock auth provider"}
        />
        <Card
          icon={<Radio size={18} color={Colors.light.tint} />}
          title="Device status"
          body={
            status.connected
              ? status.controlReady
                ? status.deviceName ?? "Connected and claimed"
                : status.deviceName ?? "Connected, claim required"
              : "Disconnected"
          }
          footnote={
            status.connected && status.lastSeenAt
              ? `Last seen ${new Date(status.lastSeenAt).toLocaleString()}`
              : "Use the device setup screen to scan, connect, and claim the UNO Q."
          }
        />
        <Card
          icon={<RotateCcw size={18} color={Colors.light.tint} />}
          title="Sync queue"
          body={`${queuedCount} pending or failed sample${queuedCount === 1 ? "" : "s"}`}
          footnote="Backend upload is not configured yet, so samples stay local in this phase."
        />

        <SecondaryButton
          title={status.connected ? "Open device setup" : "Connect device"}
          onPress={() => router.push("/device" as never)}
        />

        <SecondaryButton
          title={isRetrying ? "Checking queue..." : "Re-check queued samples"}
          onPress={() => void retryAllFailed()}
          disabled={isRetrying || queuedCount === 0}
        />

        <PrimaryButton
          title="Sign out"
          onPress={() => void logout()}
          icon={<LogOut size={16} color={Colors.light.surface} />}
        />
      </View>
    </SafeAreaView>
  );
}

function Card({
  icon,
  title,
  body,
  footnote,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footnote: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
      <Text style={styles.cardFootnote}>{footnote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surfaceAlt,
  },
  cardTitle: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  cardBody: {
    color: Colors.light.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cardFootnote: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
