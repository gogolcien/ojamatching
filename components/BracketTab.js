import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, FlatList } from "react-native";
import { createRound, setMatchResult, setTournamentStatus, replaceRoundMatches } from "../lib/repo";
import { generateFirstRound, generateNextRound, isRoundComplete } from "../lib/bracket";
import { colors, spacing, radius } from "../lib/theme";
import { Button, Badge } from "./ui";
import ManualPairingEditor from "./ManualPairingEditor";

export default function BracketTab({ tournament, reload }) {
  const rounds = tournament.rounds;
  const [activeRoundIdx, setActiveRoundIdx] = useState(rounds.length - 1);
  const [manualEditing, setManualEditing] = useState(false);
  const round = rounds[activeRoundIdx] ?? rounds[rounds.length - 1];
  const isLastRound = round && rounds.length && round.id === rounds[rounds.length - 1].id;
  const hasResults = round && round.matches.some((m) => m.playerBId != null && m.result);
  const finished = tournament.status === "finished";
  const editable = !finished;
  const playerById = (id) => tournament.players.find((p) => p.id === id);

  const roundDone = round && isRoundComplete(round.matches);

  // La ronda final es la única mesa que queda: en cuanto se captura su
  // resultado ya sabemos el campeón, sin necesitar una ronda extra.
  let championId = null;
  if (isLastRound && roundDone && round.matches.length === 1) {
    const finalMatch = round.matches[0];
    if (finalMatch.playerBId == null) championId = finalMatch.playerAId;
    else if (finalMatch.result === "a_win") championId = finalMatch.playerAId;
    else if (finalMatch.result === "b_win") championId = finalMatch.playerBId;
    // 'double_loss' en la final: ambos quedan eliminados, no hay campeón.
  }
  const champion = championId ? playerById(championId) : null;
  const doubleFinalLoss =
    isLastRound && roundDone && round.matches.length === 1 && round.matches[0].result === "double_loss";

  async function handleStart() {
    const pairs = generateFirstRound(tournament.players.filter((p) => p.enabled));
    await createRound(tournament.id, 1, pairs);
    await reload();
    setActiveRoundIdx(0);
  }

  async function handleFinish() {
    await setTournamentStatus(tournament.id, "finished");
    reload();
  }

  async function handleNextRound() {
    const { pairs } = generateNextRound(round.matches);
    await createRound(tournament.id, round.roundNumber + 1, pairs);
    await reload();
    setActiveRoundIdx(rounds.length);
  }

  async function handleSetResult(matchId, result) {
    await setMatchResult(matchId, result);
    reload();
  }

  async function handleSaveManual(pairs) {
    await replaceRoundMatches(
      round.id,
      pairs.map((p) => ({ slotIndex: p.slotIndex, playerAId: p.aId, playerBId: p.bId }))
    );
    setManualEditing(false);
    reload();
  }

  if (!rounds.length) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={styles.empty}>Todavía no se ha armado el bracket.</Text>
        <Button
          title="Sortear ronda 1"
          onPress={handleStart}
          disabled={tournament.players.filter((p) => p.enabled).length < 2}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {finished ? (
        <View style={styles.finishedBanner}>
          <Text style={styles.finishedText}>Torneo finalizado — ya no se pueden capturar resultados.</Text>
        </View>
      ) : null}
      {champion ? (
        <View style={styles.championBanner}>
          <Text style={styles.championText}>🏆 Campeón: {champion.name}</Text>
        </View>
      ) : null}
      {doubleFinalLoss ? (
        <View style={styles.championBanner}>
          <Text style={styles.championText}>Ambos finalistas perdieron: el torneo queda sin campeón.</Text>
        </View>
      ) : null}

      {!manualEditing ? (
        <View style={styles.actionsRow}>
          {isLastRound && !hasResults && !champion && !doubleFinalLoss && !finished ? (
            <Button title="Pareos manuales" variant="ghost" small onPress={() => setManualEditing(true)} />
          ) : null}
          {isLastRound && !roundDone ? (
            <Button title="Captura los resultados para continuar" onPress={() => {}} disabled small />
          ) : null}
          {isLastRound && roundDone && round.matches.length > 1 && !finished ? (
            <Button title="Avanzar a la siguiente ronda" onPress={handleNextRound} small />
          ) : null}
          {(champion || doubleFinalLoss) && !finished ? (
            <Button title="Finalizar torneo" onPress={handleFinish} small />
          ) : null}
        </View>
      ) : null}

      {!manualEditing ? (
        <RoundSelector
          rounds={rounds}
          activeRoundIdx={activeRoundIdx}
          onSelect={(idx) => setActiveRoundIdx(idx)}
        />
      ) : null}

      {manualEditing ? (
        <ManualPairingEditor
          round={round}
          playerById={playerById}
          onSave={handleSaveManual}
          onCancel={() => setManualEditing(false)}
        />
      ) : (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
        {!isLastRound && editable ? (
          <Text style={styles.editHint}>
            Estás viendo una ronda anterior. Si cambias un resultado aquí, el bracket de las rondas
            posteriores no se recalcula solo — revísalas con pareo manual si hace falta.
          </Text>
        ) : null}
        {round.matches.map((m) => {
          const a = playerById(m.playerAId);
          const b = m.playerBId ? playerById(m.playerBId) : null;
          const canPick = editable;
          return (
            <View key={m.id} style={styles.card}>
              <Text style={styles.tableNum}>Mesa {m.tableNum}</Text>
              {!b ? (
                <View style={[styles.matchRow, { alignItems: "center" }]}>
                  <PlayerBox name={a?.name || "?"} tone="win" />
                  <Badge text="AUTOWIN" tone="gold" />
                </View>
              ) : (
                <>
                  <Text style={styles.hint}>{canPick ? "Toca al ganador de la mesa" : null}</Text>
                  <View style={styles.matchRow}>
                    <View style={styles.playerColumn}>
                      <PlayerBox
                        name={a?.name || "?"}
                        tone={m.result === "a_win" ? "win" : m.result === "double_loss" ? "loss" : null}
                        onPress={canPick ? () => handleSetResult(m.id, "a_win") : null}
                      />
                    </View>
                    <Text style={styles.vs}>VS</Text>
                    <View style={styles.playerColumn}>
                      <PlayerBox
                        name={b?.name || "?"}
                        tone={m.result === "b_win" ? "win" : m.result === "double_loss" ? "loss" : null}
                        onPress={canPick ? () => handleSetResult(m.id, "b_win") : null}
                      />
                    </View>
                  </View>
                  {canPick ? (
                    <View style={styles.actions}>
                      <ResultBtn label="Pierden ambos" active={m.result === "double_loss"} onPress={() => handleSetResult(m.id, "double_loss")} tone="danger" />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
      )}
    </View>
  );
}

function RoundSelector({ rounds, activeRoundIdx, onSelect }) {
  const [open, setOpen] = useState(false);
  const round = rounds[activeRoundIdx];

  return (
    <>
      <Pressable style={styles.roundSelector} onPress={() => setOpen(true)} hitSlop={4}>
        <Text style={styles.roundSelectorText}>Ronda {round.roundNumber}</Text>
        <Text style={styles.roundSelectorCaret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.addLabel}>Elegir ronda</Text>
            <FlatList
              data={rounds}
              keyExtractor={(r) => r.id}
              renderItem={({ item, index }) => (
                <Pressable
                  style={[styles.roundOptionRow, index === activeRoundIdx && styles.roundOptionRowActive]}
                  onPress={() => {
                    onSelect(index);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.roundOptionText, index === activeRoundIdx && styles.roundOptionTextActive]}>
                    Ronda {item.roundNumber}
                  </Text>
                  {index === rounds.length - 1 ? <Text style={styles.roundOptionMeta}>Actual</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function PlayerBox({ name, tone, onPress }) {
  const toneStyle =
    tone === "win"
      ? { backgroundColor: "#5cb85c22", borderColor: "#5cb85c55" }
      : tone === "loss"
      ? { backgroundColor: "#c1594f22", borderColor: "#c1594f55" }
      : { borderColor: colors.line };
  const content = <Text style={styles.playerName}>{name}</Text>;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.playerBox, toneStyle, pressed && { opacity: 0.7 }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.playerBox, toneStyle]}>{content}</View>;
}

function ResultBtn({ label, active, onPress, tone }) {
  const bg = active ? (tone === "danger" ? colors.red : colors.teal) : "transparent";
  const fg = active ? "#fff" : colors.inkDim;
  return (
    <Pressable onPress={onPress} style={[styles.resultBtn, { backgroundColor: bg, borderColor: active ? bg : colors.line }]}>
      <Text style={[styles.resultBtnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  finishedBanner: { margin: spacing.lg, marginBottom: 0, backgroundColor: "#9aa3b222", borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  finishedText: { color: colors.inkDim, fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  editHint: { color: colors.gold, fontSize: 11, textAlign: "center", marginBottom: 4 },
  championBanner: { margin: spacing.lg, marginBottom: 0, backgroundColor: "#d4a53722", borderColor: "#d4a53755", borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  championText: { color: colors.gold, fontSize: 14, fontWeight: "700", textAlign: "center" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8 },
  roundSelector: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  },
  roundSelectorText: { color: colors.gold, fontSize: 13, fontWeight: "700" },
  roundSelectorCaret: { color: colors.gold, fontSize: 11 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, alignSelf: "stretch", alignItems: "center" },
  tableNum: { color: colors.inkDim, fontSize: 10.5, marginBottom: 8, fontFamily: "monospace", textAlign: "center" },
  hint: { color: colors.inkDim, fontSize: 10, marginBottom: 6, textAlign: "center" },
  matchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  playerColumn: { alignItems: "center", gap: 6 },
  playerBox: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center" },
  playerName: { color: colors.ink, fontSize: 13, fontWeight: "600", textAlign: "center" },
  vs: { color: colors.inkDim, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, justifyContent: "center" },
  resultBtn: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  resultBtnText: { fontSize: 11, fontWeight: "600" },
  empty: { color: colors.inkDim, fontSize: 13, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalBox: { width: "100%", maxHeight: "70%", backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  addLabel: { color: colors.inkDim, fontSize: 11.5, marginBottom: 8 },
  roundOptionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  roundOptionRowActive: {},
  roundOptionText: { color: colors.ink, fontSize: 13.5, fontWeight: "500" },
  roundOptionTextActive: { color: colors.gold, fontWeight: "700" },
  roundOptionMeta: { color: colors.inkDim, fontSize: 11 },
});
