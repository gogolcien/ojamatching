import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createTournament } from "../lib/repo";
import { colors, spacing, radius } from "../lib/theme";
import { Button, Footer } from "../components/ui";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewTournament() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [format, setFormat] = useState("swiss");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Ponle un nombre al torneo.");
      return;
    }
    const id = await createTournament({ name, date, format });
    router.replace(`/tournament/${id}`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jornada 13"
            placeholderTextColor={colors.inkDim}
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-11"
            placeholderTextColor={colors.inkDim}
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>Formato</Text>
          <View style={{ gap: spacing.sm }}>
            <FormatOption
              title="Pareo suizo"
              desc="Varias rondas, se empareja por puntaje. Nadie queda eliminado."
              selected={format === "swiss"}
              onPress={() => setFormat("swiss")}
            />
            <FormatOption
              title="Eliminación directa"
              desc="Bracket: quien pierde una mesa queda fuera del torneo."
              selected={format === "elimination"}
              onPress={() => setFormat("elimination")}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Crear torneo" onPress={handleCreate} />
      </View>

      <Footer />
    </SafeAreaView>
  );
}

function FormatOption({ title, desc, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.option,
        { borderColor: selected ? colors.gold : colors.line, backgroundColor: selected ? "#d4a53714" : colors.panel },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.gold : colors.inkDim }]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  label: { color: colors.inkDim, fontSize: 11.5, marginBottom: 6 },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 14,
  },
  option: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  optionTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  optionDesc: { color: colors.inkDim, fontSize: 11.5, marginTop: 2 },
  error: { color: colors.red, fontSize: 12.5 },
});
