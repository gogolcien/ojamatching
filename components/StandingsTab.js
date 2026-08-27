import { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { computeStandings, computeStats, isRoundFullyResolved } from "../lib/swiss";
import { setTournamentStatus, createTopCutTournament } from "../lib/repo";
import { colors, spacing, radius } from "../lib/theme";
import { exportPdf, pdfBaseStyles, escapeHtml, formatTimeNow, randomDigits } from "../lib/pdf";

// Tamaños de Top Cut disponibles (deben ser potencia de 2, para que
// el algoritmo de siembra por bracket funcione sin byes).
const TOP_CUT_SIZES = [4, 8, 16, 32, 64];

const METRIC_INFO = {
  ow: {
    title: "OW% — Opponents Winrate",
    message:
      "Promedio del winrate de los rivales REALES que enfrentó este jugador. Las rondas de AUTOWIN/AUTOLOSE no cuentan (ni suman ni dividen), porque no hubo un rival real en esa ronda.",
  },
  oow: {
    title: "OOW% — Opponents' Opponents Winrate",
    message:
      "Promedio del OW% de los rivales REALES que enfrentó este jugador. Mide, en promedio, qué tan fuerte fue el nivel de los rivales de sus propios rivales. Igual que OW%, omite las rondas de AUTOWIN/AUTOLOSE.",
  },
  sl: {
    title: "SL — Square Loss",
    message:
      "Suma del cuadrado del número de ronda de cada derrota (por ejemplo, perder en ronda 1 y ronda 3 = 1² + 3² = 10). Se usa como criterio de desempate: perder en una ronda tardía pesa más que perder en una temprana, así que un SL más alto favorece a quien perdió, si perdió, en rondas más avanzadas.",
  },
};

function showMetricInfo(key) {
  const info = METRIC_INFO[key];
  Alert.alert(info.title, info.message);
}

export default function StandingsTab({ tournament, reload }) {
  const router = useRouter();
  const rows = useMemo(() => computeStandings(tournament), [tournament]);
  const stats = useMemo(() => computeStats(tournament), [tournament]);
  const [generating, setGenerating] = useState(false);
  const [cuttingSize, setCuttingSize] = useState(null);
  const [topCutModalOpen, setTopCutModalOpen] = useState(false);
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
              <td style="width:56px;text-align:center;">${(r.owPercent * 100).toFixed(2)}%</td>
              <td style="width:56px;text-align:center;">${(r.oowPercent * 100).toFixed(2)}%</td>
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
                  <th style="text-align:center;">OW%</th>
                  <th style="text-align:center;">OOW%</th>
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

  const eligibleForCut = rows.filter((r) => r.enabled);
  const availableCutSizes = TOP_CUT_SIZES.filter((size) => size <= eligibleForCut.length);

  // El botón de Top Cut solo debe aparecer una vez que la ronda en
  // curso ya tiene todos sus resultados capturados (o si todavía no
  // se ha generado ninguna ronda, no aplica el corte).
  const lastRound = tournament.rounds.length ? tournament.rounds[tournament.rounds.length - 1] : null;
  const currentRoundResolved = !!lastRound && isRoundFullyResolved(lastRound);

  // Recomendación de tamaño según cantidad de jugadores activos. Para
  // 9-32 jugadores sigue la tabla oficial de Konami (Top 4); de ahí en
  // adelante es una extrapolación propia, no un número oficial de KTS.
  function recommendedCutSize(n) {
    if (n < 9) return null;
    if (n <= 32) return 4;
    if (n <= 128) return 8;
    if (n <= 512) return 16;
    if (n <= 2048) return 32;
    return 64;
  }
  const recommendedSize = recommendedCutSize(eligibleForCut.length);
  const recommendedAvailable = recommendedSize != null && availableCutSizes.includes(recommendedSize);

  async function handlePickTopCutSize(size) {
    setTopCutModalOpen(false);
    Alert.alert(
      `Cortar a Top ${size}`,
      `Se va a crear un torneo nuevo de eliminación directa con los ${size} mejores jugadores actuales (sembrados 1 vs ${size}, 2 vs ${size - 1}, etc., para que los mejores puestos se enfrenten lo más tarde posible). Este torneo suizo no se modifica. ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear Top Cut",
          onPress: async () => {
            setCuttingSize(size);
            try {
              const topPlayers = eligibleForCut.slice(0, size).map((r) => ({ name: r.name, deck: r.deck }));
              const newId = await createTopCutTournament({
                sourceTournamentId: tournament.id,
                name: `${tournament.name} - Top ${size}`,
                date: tournament.date,
                orderedTopPlayers: topPlayers,
              });
              router.push(`/tournament/${newId}`);
            } catch (e) {
              Alert.alert("No se pudo crear el Top Cut", "Intenta de nuevo.");
            } finally {
              setCuttingSize(null);
            }
          },
        },
      ]
    );
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
        {tournament.format !== "elimination" && availableCutSizes.length > 0 && currentRoundResolved ? (
          <Pressable
            onPress={() => setTopCutModalOpen(true)}
            style={styles.copyBtn}
            disabled={cuttingSize != null}
          >
            <Text style={styles.copyBtnText}>{cuttingSize ? `Creando Top ${cuttingSize}…` : "Cortar a Top…"}</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={topCutModalOpen} transparent animationType="fade" onRequestClose={() => setTopCutModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTopCutModalOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.addLabel}>Elegir tamaño del Top Cut</Text>
            {recommendedAvailable ? (
              <Text style={[styles.addLabel, { color: colors.gold, marginBottom: 10 }]}>
                Para {eligibleForCut.length} jugadores, lo ideal es Top {recommendedSize}.
              </Text>
            ) : null}
            {availableCutSizes.map((size) => (
              <Pressable key={size} style={styles.roundOptionRow} onPress={() => handlePickTopCutSize(size)}>
                <Text style={styles.roundOptionText}>
                  Top {size}
                  {size === recommendedSize ? " ⭐" : ""}
                </Text>
                <Text style={styles.roundOptionMeta}>
                  {size === 4 ? "Semifinal + 3er lugar" : `${Math.log2(size)} rondas de bracket`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: 24 }]}>#</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Jugador</Text>
        <Text style={[styles.headerCell, styles.colDivider, { width: 40, textAlign: "center" }]}>Pts</Text>
        <Pressable onPress={() => showMetricInfo("ow")} hitSlop={4}>
          <Text style={[styles.headerCell, styles.colDivider, styles.headerCellInfo, { width: 62, textAlign: "center", paddingRight: 6 }]}>OW% ⓘ</Text>
        </Pressable>
        <Pressable onPress={() => showMetricInfo("oow")} hitSlop={4}>
          <Text style={[styles.headerCell, styles.colDivider, styles.headerCellInfo, { width: 62, textAlign: "center", paddingRight: 6 }]}>OOW% ⓘ</Text>
        </Pressable>
        <Pressable onPress={() => showMetricInfo("sl")} hitSlop={4}>
          <Text style={[styles.headerCell, styles.colDivider, styles.headerCellInfo, { width: 40, textAlign: "center" }]}>SL ⓘ</Text>
        </Pressable>
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
            <Text style={[styles.cell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>{(item.owPercent * 100).toFixed(2)}%</Text>
            <Text style={[styles.cell, styles.colDivider, { width: 62, textAlign: "center", paddingRight: 6 }]}>{(item.oowPercent * 100).toFixed(2)}%</Text>
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
                OW% = {(opponentWinrateSum * 100).toFixed(2)}% ÷ {opponentDetails.length} rival
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
  headerCellInfo: { color: colors.gold },
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
  addLabel: { color: colors.inkDim, fontSize: 11.5, marginBottom: 8 },
  roundOptionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  roundOptionText: { color: colors.ink, fontSize: 13.5, fontWeight: "500" },
  roundOptionMeta: { color: colors.inkDim, fontSize: 11 },
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