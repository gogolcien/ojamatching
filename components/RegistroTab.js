import { useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, Alert, Modal } from "react-native";
import { addPlayer, renamePlayer, updatePlayerDeck, togglePlayerEnabled, deletePlayer } from "../lib/repo";
import { colors, spacing, radius } from "../lib/theme";
import { Badge, Button } from "./ui";

export default function RegistroTab({ tournament, reload }) {
  const [name, setName] = useState("");
  const [deck, setDeck] = useState("");
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(null); // jugador que se está editando
  const [renameText, setRenameText] = useState("");
  const [deckText, setDeckText] = useState("");
  const canDelete = tournament.rounds.length === 0;

  async function handleAdd() {
    if (!name.trim()) {
      setError("Escribe un nombre.");
      return;
    }
    if (tournament.players.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      setError("Ese jugador ya está registrado.");
      return;
    }
    setError("");
    await addPlayer(tournament.id, name, deck.trim() || null);
    setName("");
    setDeck("");
    reload();
  }

  function handleRename(p) {
    setRenaming(p);
    setRenameText(p.name);
    setDeckText(p.deck || "");
  }

  async function confirmRename() {
    if (renaming && renameText.trim()) {
      await renamePlayer(renaming.id, renameText);
      await updatePlayerDeck(renaming.id, deckText);
      reload();
    }
    setRenaming(null);
  }

  function handleDelete(p) {
    Alert.alert("Eliminar jugador", `¿Quitar a ${p.name} del torneo?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deletePlayer(p.id);
          reload();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.addBox}>
        <Text style={styles.addLabel}>Agregar jugador</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre o apodo"
            placeholderTextColor={colors.inkDim}
            style={styles.input}
            onSubmitEditing={handleAdd}
          />
          <Button title="Agregar" onPress={handleAdd} small />
        </View>
        <Text style={[styles.addLabel, { marginTop: 8 }]}>Deck (opcional)</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <TextInput
            value={deck}
            onChangeText={setDeck}
            placeholder="Ej. Elementales Heroicos"
            placeholderTextColor={colors.inkDim}
            style={styles.input}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {tournament.rounds.length > 0 ? (
          <Text style={styles.hint}>El torneo ya inició: un jugador nuevo se agrega sin puntos previos.</Text>
        ) : null}
      </View>

      <FlatList
        data={tournament.players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay jugadores registrados.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.enabled && styles.rowDisabled]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.deck ? <Text style={styles.deck}>{item.deck}</Text> : null}
            </View>
            <View style={styles.actions}>
              <Badge text={item.enabled ? "Habilitado" : "Inhabilitado"} tone={item.enabled ? "teal" : "dim"} />
              <Pressable onPress={() => handleRename(item)} hitSlop={8}>
                <Text style={styles.icon}>✎</Text>
              </Pressable>
              <Pressable
                onPress={() => togglePlayerEnabled(item.id, !item.enabled, tournament.rounds.length).then(reload)}
                hitSlop={8}
              >
                <Text style={styles.icon}>{item.enabled ? "⛔" : "↺"}</Text>
              </Pressable>
              {canDelete ? (
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={[styles.icon, { color: colors.red }]}>🗑</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />

      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.addLabel}>Corregir nombre</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 }}>
              <TextInput value={renameText} onChangeText={setRenameText} style={styles.input} autoFocus />
            </View>
            <Text style={styles.addLabel}>Deck</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 }}>
              <TextInput
                value={deckText}
                onChangeText={setDeckText}
                placeholder="Sin deck registrado"
                placeholderTextColor={colors.inkDim}
                style={styles.input}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Cancelar" variant="ghost" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
              <Button title="Guardar" onPress={confirmRename} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBox: { padding: spacing.lg, paddingBottom: spacing.sm, gap: 8 },
  addLabel: { color: colors.inkDim, fontSize: 11.5 },
  input: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: colors.ink,
    fontSize: 13.5,
  },
  error: { color: colors.red, fontSize: 12 },
  hint: { color: colors.inkDim, fontSize: 11 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowDisabled: { opacity: 0.55 },
  name: { color: colors.ink, fontSize: 13.5, fontWeight: "500" },
  deck: { color: colors.teal, fontSize: 11, fontWeight: "600", marginTop: 2, fontFamily: "monospace" },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { color: colors.inkDim, fontSize: 14 },
  empty: { color: colors.inkDim, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  modalBackdrop: { flex: 1, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalBox: { width: "100%", backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
});