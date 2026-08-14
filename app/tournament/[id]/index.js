import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTournament } from "../../../lib/useTournament";
import { colors, spacing } from "../../../lib/theme";
import RegistroTab from "../../../components/RegistroTab";
import PareosTab from "../../../components/PareosTab";
import BracketTab from "../../../components/BracketTab";
import StandingsTab from "../../../components/StandingsTab";
import EliminationStandingsTab from "../../../components/EliminationStandingsTab";
import { Footer } from "../../../components/ui";

export default function TournamentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data, loading, reload } = useTournament(id);
  const [tab, setTab] = useState("registro");

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const isElimination = data.format === "elimination";
  const tabs = [
    { key: "registro", label: "Registro" },
    { key: "pareos", label: isElimination ? "Bracket" : "Pareos" },
    { key: "standings", label: "Standings" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Torneos</Text>
        </Pressable>
        <Text style={styles.title}>{data.name}</Text>
        <Text style={styles.subtitle}>
          {data.players.length} jugador(es) · {data.rounds.length} ronda(s) jugada(s)
        </Text>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      {tab === "registro" ? <RegistroTab tournament={data} reload={reload} /> : null}
      {tab === "pareos" && !isElimination ? <PareosTab tournament={data} reload={reload} /> : null}
      {tab === "pareos" && isElimination ? <BracketTab tournament={data} reload={reload} /> : null}
      {tab === "standings" && !isElimination ? <StandingsTab tournament={data} reload={reload} /> : null}
      {tab === "standings" && isElimination ? <EliminationStandingsTab tournament={data} /> : null}

      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  back: { color: colors.inkDim, fontSize: 13, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  subtitle: { color: colors.inkDim, fontSize: 11.5, marginTop: 2 },
  tabBar: { flexDirection: "row", gap: 20, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabItem: { paddingBottom: 10 },
  tabLabel: { color: colors.inkDim, fontSize: 13.5 },
  tabLabelActive: { color: colors.ink, fontWeight: "600" },
  tabUnderline: { height: 2, backgroundColor: colors.gold, borderRadius: 1, marginTop: 6 },
});