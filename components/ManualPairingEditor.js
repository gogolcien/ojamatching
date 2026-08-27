import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, FlatList } from "react-native";
import { colors, spacing, radius } from "../lib/theme";
import { Button } from "./ui";

// Editor de pareo manual reutilizable (suizo y eliminación directa).
// Recibe la ronda actual (sin resultados capturados todavía) y deja
// reacomodar quién juega contra quién intercambiando jugadores entre
// mesas. No cambia el número de mesas ni el AUTOWIN existente, solo
// quién ocupa cada lugar — así nunca se puede dejar a alguien sin
// pareo ni duplicado.
export default function ManualPairingEditor({ round, playerById, onSave, onCancel }) {
  const [pairs, setPairs] = useState(
    round.matches.map((m) => ({ tableNum: m.tableNum, slotIndex: m.slotIndex, aId: m.playerAId, bId: m.playerBId, isThirdPlace: !!m.isThirdPlace }))
  );
  const [picker, setPicker] = useState(null); // { pairIdx, side } | null

  const options = [];
  pairs.forEach((p, pairIdx) => {
    options.push({ pairIdx, side: "aId", playerId: p.aId, tableNum: p.tableNum });
    options.push({ pairIdx, side: "bId", playerId: p.bId, tableNum: p.tableNum });
  });

  function handlePick(target) {
    if (!picker) return;
    setPairs((prev) => {
      const next = prev.map((p) => ({ ...p }));
      const a = next[picker.pairIdx][picker.side];
      const b = next[target.pairIdx][target.side];
      next[picker.pairIdx][picker.side] = b;
      next[target.pairIdx][target.side] = a;
      return next;
    });
    setPicker(null);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          Toca a un jugador y luego a otro para intercambiar sus lugares. El número de mesas y el AUTOWIN se
          mantienen igual.
        </Text>
      </View>

      <FlatList
        data={pairs}
        keyExtractor={(p) => String(p.tableNum)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm }}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.tableNum}>Mesa {item.tableNum}</Text>
            <View style={styles.row}>
              <Slot
                name={playerById(item.aId)?.name}
                selected={picker && picker.pairIdx === index && picker.side === "aId"}
                onPress={() => (picker ? handlePick({ pairIdx: index, side: "aId" }) : setPicker({ pairIdx: index, side: "aId" }))}
              />
              <Text style={styles.vs}>VS</Text>
              <Slot
                name={item.bId ? playerById(item.bId)?.name : "AUTOWIN / vacío"}
                empty={!item.bId}
                selected={picker && picker.pairIdx === index && picker.side === "bId"}
                onPress={() => (picker ? handlePick({ pairIdx: index, side: "bId" }) : setPicker({ pairIdx: index, side: "bId" }))}
              />
            </View>
          </View>
        )}
      />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button title="Guardar pareo manual" onPress={() => onSave(pairs)} style={{ flex: 1 }} />
      </View>

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.addLabel}>Intercambiar con…</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => `${o.pairIdx}-${o.side}`}
              renderItem={({ item }) => {
                const isSelf = picker && item.pairIdx === picker.pairIdx && item.side === picker.side;
                return (
                  <Pressable
                    style={[styles.optionRow, isSelf && { opacity: 0.4 }]}
                    onPress={() => !isSelf && handlePick(item)}
                    disabled={isSelf}
                  >
                    <Text style={styles.optionText}>
                      {item.playerId ? playerById(item.playerId)?.name : "AUTOWIN / vacío"}
                    </Text>
                    <Text style={styles.optionMeta}>Mesa {item.tableNum}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Slot({ name, empty, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.slot, empty && styles.slotEmpty, selected && styles.slotSelected]}
    >
      <Text style={[styles.slotText, empty && styles.slotTextEmpty]}>{name || "?"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hintBox: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  hint: { color: colors.inkDim, fontSize: 11.5, lineHeight: 16 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  tableNum: { color: colors.inkDim, fontSize: 10.5, marginBottom: 8, fontFamily: "monospace" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  vs: { color: colors.inkDim, fontSize: 11, fontWeight: "700" },
  slot: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10 },
  slotEmpty: { borderStyle: "dashed" },
  slotSelected: { borderColor: colors.gold, backgroundColor: "#d4a53714" },
  slotText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  slotTextEmpty: { color: colors.inkDim, fontWeight: "400", fontSize: 12 },
  actions: { flexDirection: "row", gap: 10, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  modalBackdrop: { flex: 1, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalBox: { width: "100%", maxHeight: "70%", backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  addLabel: { color: colors.inkDim, fontSize: 11.5, marginBottom: 8 },
  optionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { color: colors.ink, fontSize: 13.5, fontWeight: "500" },
  optionMeta: { color: colors.inkDim, fontSize: 11 },
});
