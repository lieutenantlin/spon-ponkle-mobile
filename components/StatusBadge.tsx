import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { Radius } from "@/constants/theme";
import { UploadStatus } from "@/types";

interface Props {
  status: UploadStatus;
  small?: boolean;
}

const COPY: Record<UploadStatus, string> = {
  pending: "Queued",
  uploading: "Uploading",
  uploaded: "Synced",
  synced: "Synced",
  failed: "Failed",
};

const COLORS: Record<UploadStatus, { bg: string; fg: string }> = {
  pending: { bg: "#FFF4DB", fg: "#8A6200" },
  uploading: { bg: "#DDEFFE", fg: "#0B6E7F" },
  uploaded: { bg: "#DDF5E6", fg: Colors.light.success },
  synced: { bg: "#DDF5E6", fg: Colors.light.success },
  failed: { bg: "#FCE4E4", fg: Colors.light.danger },
};

export default function StatusBadge({ status, small }: Props) {
  const c = COLORS[status];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: c.bg },
        small && styles.small,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }, small && styles.textSmall]}>
        {COPY[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: "600" },
  textSmall: { fontSize: 11 },
});
