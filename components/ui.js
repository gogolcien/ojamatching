import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

export function Button({ title, onPress, variant = "gold", style, disabled, small }) {
  const bg =
    variant === "gold" ? colors.gold : variant === "teal" ? colors.teal : variant === "danger" ? "transparent" : "transparent";
  const textColor =
    variant === "gold" ? colors.goldInk : variant === "teal" ? colors.tealInk : variant === "danger" ? colors.red : colors.inkDim;
  const border = variant === "ghost" || variant === "danger" ? colors.line : bg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ text, tone = "dim" }) {
  const map = {
    teal: { bg: "#4fb8a622", fg: colors.teal },
    gold: { bg: "#d4a53722", fg: colors.gold },
    red: { bg: "#c1594f22", fg: colors.red },
    dim: { bg: "#9aa3b222", fg: colors.inkDim },
  };
  const c = map[tone] || map.dim;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Aplicación desarrollada por OJAMA PROGRAMA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10 },
  btnText: { fontSize: 13, fontWeight: "600" },
  btnTextSmall: { fontSize: 11.5 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, alignSelf: "flex-start" },
  badgeText: { fontSize: 10.5, fontWeight: "600" },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  footer: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  footerText: { color: colors.inkDim, fontSize: 10.5, textAlign: "center" },
});
