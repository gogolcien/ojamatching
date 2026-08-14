import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTournaments, deleteTournament } from "../lib/repo";
import { colors, spacing, radius } from "../lib/theme";
import { Badge, Button, Footer } from "../components/ui";

export default function Home() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);

  const load = useCallback(() => {
    listTournaments().then(setTournaments);
  }, []);

  useFocusEffect(load);

  function handleDelete(item) {
    Alert.alert(
      "Eliminar torneo",
      `¿Seguro que quieres eliminar "${item.name}"? Se borrarán también sus jugadores, rondas y resultados. Esto no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteTournament(item.id);
            load();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, alignItems: "center", gap: 6 }}>
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.heading}>Mis torneos</Text>
        <Text style={styles.subheading}>Guardados en este dispositivo, sin conexión a internet</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <Button title="+ Nuevo torneo" onPress={() => router.push("/new-tournament")} />
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(t) => t.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.empty}>Todavía no has creado ningún torneo.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push(`/tournament/${item.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.rowActions}>
                <Badge
                  text={item.status === "finished" ? "Finalizado" : "En curso"}
                  tone={item.status === "finished" ? "dim" : "teal"}
                />
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={styles.deleteIcon}>🗑</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.date} · {item.format === "elimination" ? "Eliminación directa" : "Pareo suizo"}
            </Text>
          </Pressable>
        )}
      />

      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  logo: { width: 72, height: 72, borderRadius: radius.lg },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  subheading: { color: colors.inkDim, fontSize: 11.5 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  deleteIcon: { color: colors.red, fontSize: 14 },
  name: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.inkDim, fontSize: 11.5, marginTop: 4 },
  empty: { color: colors.inkDim, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
});