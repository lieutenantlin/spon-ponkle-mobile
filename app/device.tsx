import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Activity, CheckCircle2, Radio, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react-native";
import ScreenHeader from "@/components/ScreenHeader";
import PrimaryButton from "@/components/PrimaryButton";
import SecondaryButton from "@/components/SecondaryButton";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { useDevice } from "@/providers/DeviceProvider";
import { DiscoveredDevice } from "@/types";

export default function DeviceSetupScreen() {
  const {
    status,
    busy,
    scan,
    connect,
    claimAuthorization,
    disconnect,
    refreshDeviceInfo,
  } = useDevice();

  const healthSummary = useMemo(() => {
    if (!status.lastHealthEvent) {
      return "No health event received yet.";
    }
    return status.lastHealthEvent.status ?? "Unknown";
  }, [status.lastHealthEvent]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "UNO Q Setup" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Bluetooth"
          title="UNO Q setup"
          subtitle="Connect to the tank controller over BLE, then claim control so the app can subscribe to telemetry."
        />

        <Card
          icon={<Radio size={18} color={Colors.light.tint} />}
          title="Connection status"
          body={formatConnectionStatus(status.connected, status.controlReady)}
          footnote={[
            `Bluetooth: ${status.bluetoothState}`,
            `Phase: ${formatToken(status.connectionPhase)}`,
            status.deviceName ? `Device: ${status.deviceName}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />

        <View style={styles.instructions}>
          <Text style={styles.sectionTitle}>Manual pairing steps</Text>
          <Instruction
            title="First-time pair"
            body="Short-press the physical button on the UNO Q to open the 60-second pairing window, then scan and connect from this screen."
          />
          <Instruction
            title="Replace the remembered phone"
            body="Long-press the button on the UNO Q to clear the stored phone and reopen the pairing window before reconnecting."
          />
          <Instruction
            title="Claim device"
            body="After BLE connection succeeds, tap Claim device to send the low-risk `sensors.read` control command and subscribe to telemetry."
          />
        </View>

        {status.error ? (
          <Card
            icon={<ShieldAlert size={18} color={Colors.light.coral} />}
            title="Latest error"
            body={status.error.message}
            footnote={status.error.code}
            tone="danger"
          />
        ) : null}

        <View style={styles.actionRow}>
          <PrimaryButton
            title={busy && status.connectionPhase === "scanning" ? "Scanning..." : "Scan for UNO Q"}
            onPress={() => void scan()}
            loading={busy && status.connectionPhase === "scanning"}
            style={styles.flexButton}
          />
          <SecondaryButton
            title="Refresh info"
            onPress={() => void refreshDeviceInfo()}
            disabled={!status.connected || busy}
            icon={<RefreshCw size={16} color={Colors.light.text} />}
            style={styles.flexButton}
          />
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Discovered devices</Text>
          {status.discoveredDevices.length ? (
            <View style={styles.deviceList}>
              {status.discoveredDevices.map((device) => (
                <DeviceRow
                  key={device.peripheralId}
                  device={device}
                  connected={status.peripheralId === device.peripheralId && status.connected}
                  busy={busy}
                  onConnect={() => void connect(device.peripheralId)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No UNO Q devices discovered yet. Open the pairing window on the hardware, then scan.
            </Text>
          )}
        </View>

        {status.connected ? (
          <View style={styles.connectedActions}>
            <PrimaryButton
              title={
                status.controlReady
                  ? "Control ready"
                  : busy && status.connectionPhase === "claiming"
                  ? "Claiming..."
                  : "Claim device"
              }
              onPress={() => void claimAuthorization()}
              loading={busy && status.connectionPhase === "claiming"}
              disabled={status.controlReady}
              icon={<ShieldCheck size={16} color={Colors.light.surface} />}
            />
            <SecondaryButton
              title={busy && status.connectionPhase === "disconnecting" ? "Disconnecting..." : "Disconnect"}
              onPress={() => void disconnect()}
              disabled={busy && status.connectionPhase === "disconnecting"}
              icon={<Activity size={16} color={Colors.light.text} />}
            />
          </View>
        ) : null}

        <Card
          icon={
            status.controlReady ? (
              <CheckCircle2 size={18} color={Colors.light.success} />
            ) : (
              <ShieldAlert size={18} color={Colors.light.amber} />
            )
          }
          title="Device state"
          body={[
            `Pairing: ${formatToken(status.pairingState ?? "unknown")}`,
            `Status: ${formatToken(status.statusMode ?? "unknown")}`,
            `Telemetry: ${status.telemetrySubscribed ? "Subscribed" : "Off"}`,
          ].join(" · ")}
          footnote="Connection is real in this phase. Sample analysis remains mocked."
        />

        <Card
          icon={<Activity size={18} color={Colors.light.tint} />}
          title="Last health event"
          body={healthSummary}
          footnote={formatHealthChecks(status.deviceInfo?.last_health_event?.checks)}
        />

        <Card
          icon={<Activity size={18} color={Colors.light.tint} />}
          title="Live telemetry"
          body={
            status.lastTelemetry
              ? `${(status.lastTelemetry.temp_c ?? 0).toFixed(1)} °C · light ${status.lastTelemetry.light_pct ?? "—"}% · water ${status.lastTelemetry.water_pct ?? "—"}%`
              : "No telemetry received yet."
          }
          footnote={
            status.lastTelemetry
              ? `Faults: ${(status.lastTelemetry.faults ?? []).join(", ") || "none"}`
              : "Claim the device to start telemetry.subscribe."
          }
        />

        {status.deviceInfo ? (
          <Card
            icon={<Radio size={18} color={Colors.light.tint} />}
            title="Device info"
            body={status.deviceInfo.name ?? "UNO Q"}
            footnote={[
              status.deviceInfo.app_version
                ? `App ${status.deviceInfo.app_version}`
                : null,
              status.lastPeripheralId ? `Peripheral ${status.lastPeripheralId}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceRow({
  device,
  connected,
  busy,
  onConnect,
}: {
  device: DiscoveredDevice;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
}) {
  const label = device.localName ?? device.name ?? "UNO Q";
  const signal = device.signal !== undefined ? `${Math.round(device.signal * 100)}% signal` : "Signal unavailable";

  return (
    <View style={[styles.deviceRow, connected && styles.deviceRowConnected]}>
      <View style={styles.deviceBody}>
        <Text style={styles.deviceName}>{label}</Text>
        <Text style={styles.deviceMeta}>{device.peripheralId}</Text>
        <Text style={styles.deviceMeta}>{signal}</Text>
      </View>
      <SecondaryButton
        title={connected ? "Connected" : "Connect"}
        onPress={onConnect}
        disabled={connected || busy}
        style={styles.deviceButton}
      />
    </View>
  );
}

function Card({
  icon,
  title,
  body,
  footnote,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footnote: string;
  tone?: "default" | "danger";
}) {
  return (
    <View style={[styles.card, tone === "danger" && styles.cardDanger]}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
      <Text style={styles.cardFootnote}>{footnote}</Text>
    </View>
  );
}

function Instruction({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.instruction}>
      <Text style={styles.instructionTitle}>{title}</Text>
      <Text style={styles.instructionBody}>{body}</Text>
    </View>
  );
}

function formatConnectionStatus(connected: boolean, controlReady: boolean): string {
  if (!connected) return "Disconnected";
  return controlReady ? "Connected and claimed" : "Connected, claim required";
}

function formatToken(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatHealthChecks(
  checks: Record<string, boolean | string | number | null> | undefined
): string {
  if (!checks || Object.keys(checks).length === 0) {
    return "No hardware checks published yet.";
  }

  return Object.entries(checks)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  content: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  instructions: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  instruction: {
    gap: 4,
  },
  instructionTitle: {
    color: Colors.light.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  instructionBody: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    color: Colors.light.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  actionRow: {
    paddingHorizontal: Spacing.xl,
    flexDirection: "row",
    gap: Spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  listCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: Spacing.md,
  },
  deviceList: {
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.light.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  deviceRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  deviceRowConnected: {
    borderColor: Colors.light.success,
    backgroundColor: Colors.light.surfaceAlt,
  },
  deviceBody: {
    gap: 4,
  },
  deviceName: {
    color: Colors.light.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  deviceMeta: {
    color: Colors.light.textMuted,
    fontSize: FontSize.xs,
  },
  deviceButton: {
    alignSelf: "flex-start",
  },
  connectedActions: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  card: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    gap: 6,
  },
  cardDanger: {
    borderColor: "#F0C5CB",
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
