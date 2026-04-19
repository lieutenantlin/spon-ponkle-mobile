import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { ScanLine } from "lucide-react-native";
import Colors from "@/constants/colors";
import { FontSize, FontWeight, Spacing } from "@/constants/theme";
import { deviceService } from "@/services/deviceService";
import { useScanDraft } from "@/providers/ScanDraftProvider";

export default function ProcessingScreen() {
  const router = useRouter();
  const { draft, setResult } = useScanDraft();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    (async () => {
      const res = await deviceService.runInference(draft.imageUri ?? "");
      setResult(res);
      router.replace("/scan/result");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.1],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Analyzing" }} />
      <View style={styles.center}>
        <View style={styles.ringWrap}>
          <Animated.View
            style={[styles.ring, { transform: [{ scale }], opacity }]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ringInner,
              { transform: [{ scale }], opacity },
            ]}
          />
          <View style={styles.core}>
            <ScanLine color="#fff" size={36} />
          </View>
        </View>

        <Text style={styles.title}>Packaging sample</Text>
        <Text style={styles.subtitle}>
          Saving the capture, device telemetry, and metadata locally. The microplastic analysis model is still pending integration.
        </Text>

        <View style={styles.steps}>
          <Step label="Saving capture image" done />
          <Step label="Packaging device snapshot" active />
          <Step label="Marking analysis as pending" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Step({
  label,
  done,
  active,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepDot,
          done && styles.stepDotDone,
          active && styles.stepDotActive,
        ]}
      />
      <Text
        style={[
          styles.stepLabel,
          (done || active) && styles.stepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  ringWrap: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.palette.aqua,
  },
  ringInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.palette.ocean,
  },
  core: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
    marginTop: Spacing.xl,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.light.textMuted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  steps: { marginTop: Spacing.xl, gap: 10, alignSelf: "stretch", paddingHorizontal: Spacing.xl },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.border,
  },
  stepDotActive: { backgroundColor: Colors.light.tint },
  stepDotDone: { backgroundColor: Colors.light.success },
  stepLabel: { fontSize: FontSize.sm, color: Colors.light.textSubtle },
  stepLabelActive: { color: Colors.light.text, fontWeight: FontWeight.semibold },
});
