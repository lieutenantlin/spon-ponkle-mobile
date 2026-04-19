import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, MapPin } from "lucide-react-native";
import Colors from "@/constants/colors";
import { Radius, Spacing, FontSize, FontWeight } from "@/constants/theme";
import { WaterSample } from "@/types";
import StatusBadge from "./StatusBadge";
import { formatShortDate } from "@/utils/format";

interface Props {
  sample: WaterSample;
  onPress: () => void;
}

function SampleListItem({ sample, onPress }: Props) {
  return (
    <Pressable
      testID={`sample-item-${sample.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
        {sample.imageUri ? (
          <Image source={{ uri: sample.imageUri }} style={styles.thumbImage} />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.id} numberOfLines={1}>
            {sample.sampleId}
          </Text>
          <StatusBadge status={sample.uploadStatus} small />
        </View>
        <View style={styles.locationRow}>
          <MapPin size={12} color={Colors.light.textSubtle} />
          <Text style={styles.location} numberOfLines={1}>
            {sample.locationLabel ??
              `${sample.latitude.toFixed(3)}, ${sample.longitude.toFixed(3)}`}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.value}>
            {sample.microplasticEstimate !== undefined ? (
              <>
                {sample.microplasticEstimate.toFixed(1)}{" "}
                <Text style={styles.unit}>{sample.unit}</Text>
              </>
            ) : (
              "Awaiting model"
            )}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.date}>{formatShortDate(sample.capturedAt)}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={Colors.light.textSubtle} />
    </Pressable>
  );
}

export default React.memo(SampleListItem);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pressed: { opacity: 0.8 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.light.surfaceAlt,
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbPlaceholder: { flex: 1, backgroundColor: Colors.light.surfaceAlt },
  body: { flex: 1, gap: 4 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  id: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
    flex: 1,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: {
    fontSize: FontSize.sm,
    color: Colors.light.textMuted,
    flex: 1,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  value: {
    fontSize: FontSize.sm,
    color: Colors.light.text,
    fontWeight: FontWeight.semibold,
  },
  unit: {
    color: Colors.light.textMuted,
    fontWeight: FontWeight.regular,
  },
  dot: { color: Colors.light.textSubtle },
  date: { fontSize: FontSize.sm, color: Colors.light.textMuted },
});
