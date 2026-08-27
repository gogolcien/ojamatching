import { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { computeEliminationStandings } from "../lib/bracket";
import { colors, spacing, radius } from "../lib/theme";

function podiumLabel(item) {
  switch (item.podium) {
    case 1:
      return "Campeón";
    case 2:
      return "Subcampeón";
    case 3:
      return "3er lugar";
    case 4:
      return "4to lugar";
    default:
      return null;
  }
}

export default function EliminationStandingsTab({ tournament }) {
  const rows = useMemo(
    () => computeEliminationStandings(tournament.players, tournament.rounds),
    [tournament]
  );
  const [copied, setCopied] = useState(false);

  async function copyNames() {
    const text = rows.map((r) => r.name).join("\n");
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={copyNames} style={styles.copyBtn}>
        <Text style={styles.copyBtnText}>{copied ? "Copiado ✓" : "Copiar nombres"}</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: 24 }]}>#</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Jugador</Text>
        <Text style={[styles.headerCell, { width: 100, textAlign: "right" }]}>Estado</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
        ListEmptyComponent={<Text style={styles.empty}>Sin datos todavía.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.cell, { width: 24, color: item.rank === 1 ? colors.gold : colors.inkDim, fontWeight: "700" }]}>
              {item.rank}
            </Text>
            <Text style={[styles.cell, { flex: 1, fontWeight: "600" }]}>{item.name}</Text>
            <Text style={[styles.cell, { width: 100, textAlign: "right", color: item.podium != null || item.eliminatedInRound == null ? colors.teal : colors.inkDim }]}>
              {podiumLabel(item) ?? (item.eliminatedInRound == null ? "En pie" : `Eliminado R${item.eliminatedInRound}`)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copyBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  copyBtnText: { color: colors.inkDim, fontSize: 11.5, fontWeight: "600" },
  headerRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  headerCell: { color: colors.inkDim, fontSize: 10.5 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  cell: { color: colors.ink, fontSize: 12.5 },
  empty: { color: colors.inkDim, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
});
