import { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Modal } from "react-native";
import { computeStandings, computeStats, isRoundFullyResolved } from "../lib/swiss";
import { setTournamentStatus } from "../lib/repo";
import { colors, spacing, radius } from "../lib/theme";
import { exportPdf, pdfBaseStyles, escapeHtml, formatTimeNow, randomDigits } from "../lib/pdf";

export default function StandingsTab({ tournament, reload }) {
  const rows = useMemo(() => computeStandings(tournament), [tournament]);
  const stats = useMemo(() => computeStats(tournament), [tournament]);
  const [generating, setGenerating] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState(null);
  const finished = tournament.status === "finished";
  const playerById = (id) => tournament.players.find((p) => p.id === id);

  const detailPlayer = detailPlayerId ? playerById(detailPlayerId) : null;
  const opponentDetails = useMemo(() => {
    if (!detailPlayerId) return [];
    return (stats.roundsByPlayer[detailPlayerId] || [])
      .filter((r) => r.opponentId != null)
      .map((r) => ({
        roundNumber: r.roundNumber,
        opponentId: r.opponentId,
        opponentName: playerById(r.opponentId)?.name || "?",
        winrate: stats.record[r.opponentId] ?? 0,
      }))
      .sort((a, b) => a.roundNumber - b.roundNumber);
  }, [detailPlayerId, stats, tournament]);
  const opponentWinrateSum = opponentDetails.reduce((s, o) => s + o.winrate, 0);

  async function handleStandingsPdf() {
    setGenerating(true);
    try {
      const activeCount = tournament.players.filter((p) => p.enabled).length;
      const resolvedRoundsCount = tournament.rounds.filter(isRoundFullyResolved).length;
      const rowsHtml = rows
        .map((r) => {
          const estado = r.disabledRound
            ? `Inhabilitado en ronda ${r.disabledRound}`
            : !r.enabled
            ? "Inhabilitado"
            : "";
          return `
            <tr>
              <td style="width:32px;font-weight:700;">${r.rank}</td>
              <td style="width:26%;">${escapeHtml(r.name)}</td>
              <td style="width:22%;color:#666;font-size:10.5px;">${escapeHtml(estado)}</td>
              <td style="width:18%;color:#666;font-size:10.5px;">${r.deck ? escapeHtml(r.deck) : ""}</td>
              <td style="width:40px;text-align:center;font-weight:700;">${r.points}</td>
              <td style="width:56px;text-align:center;">${(r.opPercent * 100).toFixed(2)}%</td>
              <td style="width:56px;text-align:center;">${(r.oopPercent * 100).toFixed(2)}%</td>
              <td style="width:40px;text-align:center;">${r.sl}</td>
            </tr>`;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            ${pdfBaseStyles()}
          </head>
          <body>
            <h1>${escapeHtml(tournament.name)} — Standings</h1>
            <div class="meta">
              <span>Fecha: ${escapeHtml(tournament.date)}</span>
              <span>Hora: ${formatTimeNow()}</span>
              <span>Jugadores inscritos: ${rows.length}</span>
              <span>Jugadores activos: ${activeCount}</span>
              <span>Rondas registradas: ${resolvedRoundsCount}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Estado</th>
                  <th>Deck</th>
                  <th style="text-align:center;">Pts</th>
                  <th style="text-align:center;">OP%</th>
                  <th style="text-align:center;">OOP%</th>
                  <th style="text-align:center;">SL</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `;

      await exportPdf(html, `${tournament.name} - ${randomDigits(6)}`);
    } catch (e) {
      Alert.alert("No se pudo generar el PDF", "Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  function handleFinish() {
    Alert.alert(
      "Finalizar torneo",
      "Ya no vas a poder generar más rondas. Sí vas a poder seguir corrigiendo resultados de rondas ya jugadas. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          onPress: async () => {
            await setTournamentStatus(tournament.id, "finished");
            reload();
          },
        },
      ]
    );
  }

  function handleReopen() {
    setTournamentStatus(tournament.id, "ongoing").then(reload);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topRow}>
        {finished ? (
          <Pressable onPress={handleReopen} style={styles.reopenBtn}>
            <Text style={styles.reopenBtnText}>Torneo finalizado · Reabrir</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleFinish} style={styles.finishBtn}>
            <Text style={styles.finishBtnText}>Finalizar torneo</Text>
          </Pressable>
        )}
        <Pressable onPress={handleStandingsPdf} style={styles.copyBtn} disabled={generating}>
          <Text style={styles.copyBtnText}>{generating ? "Generando…" : "Standings PDF"}</Text>
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: 24 }]}>#</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Jugador</Text>
        <Text style={[styles.headerCell, styles.colDivider, { width: 40, textAlign: "center" }]}>Pts</Text>
        <Text style={[styles.headerCell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>OP%</Text>
        <Text style={[styles.headerCell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>OOP%</Text>
        <Text style={[styles.headerCell, styles.colDivider, { width: 40, textAlign: "center" }]}>SL</Text>
        <Text style={[styles.headerCell, { width: 30 }]}></Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
        ListEmptyComponent={<Text style={styles.empty}>Sin datos todavía.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.enabled && { opacity: 0.5 }]}>
            <Text style={[styles.cell, { width: 24, color: item.rank === 1 ? colors.gold : colors.inkDim, fontWeight: "700" }]}>
              {item.rank}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cell, { fontWeight: "600" }]}>{item.name}</Text>
              {item.deck ? <Text style={styles.deck}>{item.deck}</Text> : null}
            </View>
            <Text style={[styles.cell, styles.colDivider, { width: 40, textAlign: "center", color: colors.teal, fontWeight: "700" }]}>{item.points}</Text>
            <Text style={[styles.cell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>{(item.opPercent * 100).toFixed(2)}%</Text>
            <Text style={[styles.cell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>{(item.oopPercent * 100).toFixed(2)}%</Text>
            <Text style={[styles.cell, styles.colDivider, { width: 40, textAlign: "center" }]}>{item.sl}</Text>
            <Pressable
              onPress={() => setDetailPlayerId(item.id)}
              style={styles.slInfoBtn}
              hitSlop={6}
            >
              <Text style={styles.slInfoBtnText}>OP</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal
        visible={detailPlayerId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailPlayerId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailPlayerId(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rivales de {detailPlayer?.name}</Text>
            <Text style={styles.modalSubtitle}>Winrate de cada rival con los resultados registrados hasta ahora</Text>

            <View style={styles.opponentHeaderRow}>
              <Text style={[styles.opponentHeaderCell, { width: 56 }]}>Ronda</Text>
              <Text style={[styles.opponentHeaderCell, { flex: 1 }]}>Rival</Text>
              <Text style={[styles.opponentHeaderCell, { width: 64, textAlign: "right" }]}>Winrate</Text>
            </View>

            <FlatList
              data={opponentDetails}
              keyExtractor={(o, i) => `${o.roundNumber}-${o.opponentId}-${i}`}
              style={{ maxHeight: 280 }}
              ListEmptyComponent={<Text style={styles.empty}>Este jugador todavía no tiene rivales registrados.</Text>}
              renderItem={({ item }) => (
                <View style={styles.opponentRow}>
                  <Text style={[styles.opponentCell, { width: 56 }]}>Ronda {item.roundNumber}</Text>
                  <Text style={[styles.opponentCell, { flex: 1, fontWeight: "600" }]}>{item.opponentName}</Text>
                  <Text style={[styles.opponentCell, { width: 64, textAlign: "right", color: colors.gold }]}>
                    {(item.winrate * 100).toFixed(2)}%
                  </Text>
                </View>
              )}
            />

            <View style={styles.opponentSumRow}>
              <Text style={styles.opponentSumLabel}>Suma de winrates</Text>
              <Text style={styles.opponentSumValue}>{(opponentWinrateSum * 100).toFixed(2)}%</Text>
            </View>
            {opponentDetails.length ? (
              <Text style={styles.opponentSumHint}>
                OP% = {(opponentWinrateSum * 100).toFixed(2)}% ÷ {opponentDetails.length} rival
                {opponentDetails.length === 1 ? "" : "es"} ={" "}
                {((opponentWinrateSum / opponentDetails.length) * 100).toFixed(2)}%
              </Text>
            ) : null}

            <Pressable onPress={() => setDetailPlayerId(null)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  finishBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
  finishBtnText: { color: colors.red, fontSize: 11.5, fontWeight: "600" },
  reopenBtn: { borderWidth: 1, borderColor: colors.teal, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
  reopenBtnText: { color: colors.teal, fontSize: 11.5, fontWeight: "600" },
  copyBtn: {
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
  cell: { color: colors.ink, fontSize: 12.5, fontFamily: "monospace" },
  colDivider: { borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 6 },
  deck: { color: colors.teal, fontSize: 10, fontWeight: "600", marginTop: 1, fontFamily: "monospace" },
  empty: { color: colors.inkDim, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  slInfoBtn: {
    width: 30,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  slInfoBtnText: { color: colors.gold, fontSize: 10, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalBox: { width: "100%", maxHeight: "80%", backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  modalSubtitle: { color: colors.inkDim, fontSize: 11, marginBottom: 10 },
  opponentHeaderRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  opponentHeaderCell: { color: colors.inkDim, fontSize: 10.5 },
  opponentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
  opponentCell: { color: colors.ink, fontSize: 12.5, fontFamily: "monospace" },
  opponentSumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  opponentSumLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  opponentSumValue: { color: colors.gold, fontSize: 15, fontWeight: "700" },
  opponentSumHint: { color: colors.inkDim, fontSize: 10.5, marginTop: 4 },
  modalCloseBtn: { marginTop: spacing.md, alignSelf: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 16 },
  modalCloseBtnText: { color: colors.inkDim, fontSize: 12, fontWeight: "600" },
});