import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBannerUsage } from "@/hooks/useBannerUsage";
import { getBannerUsage } from "@/services/bannerUsage";

/**
 * Subscription plans — UI ONLY for now ("Choose" buttons don't charge anything yet).
 * Plans map to the website's: Beginner = Starter, Pro = Scholar, Unlimited = Achiever.
 * Note: on Android and iOS, selling a subscription must use Google Play Billing /
 * Apple in-app purchase (see constants/storePolicy.ts) when payments are wired up.
 */
type Plan = {
  id: "beginner" | "pro" | "unlimited";
  name: string;
  tagline: string;
  monthly: number;           // ₹ per month
  questions: string;         // per month
  tutor: string;             // tutor explanations per month
  voice: string;             // voice questions per month
  features: string[];
  popular?: boolean;
  badge: readonly [string, string];
};

const PLANS: Plan[] = [
  {
    id: "beginner", name: "Beginner", tagline: "For regular learners", monthly: 149,
    questions: "2,000", tutor: "150", voice: "150",
    features: ["All Free features", "Priority answer quality", "Full question history"],
    badge: ["#f59e0b", "#f97316"],
  },
  {
    id: "pro", name: "Pro", tagline: "For dedicated students", monthly: 249,
    questions: "3,000", tutor: "10", voice: "10",
    features: ["All Beginner features", "Advanced flashcard sets", "Multi-subject support"],
    popular: true, badge: ["#667eea", "#a855f7"],
  },
  {
    id: "unlimited", name: "Unlimited", tagline: "For serious exam prep", monthly: 449,
    questions: "5,000", tutor: "10", voice: "10",
    features: ["All Pro features", "Unlimited personal PDFs", "Detailed answer explanations"],
    badge: ["#7c3aed", "#c026d3"],
  },
];

/* Yearly = 10 × monthly (2 months free, ≈17% saving, matching the website's "Save ~17%"). */
const yearlyPrice = (monthly: number) => monthly * 10;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { usage } = useBannerUsage();
  const bu = getBannerUsage(usage);
  const [yearly, setYearly] = useState(false);
  const [autoPay, setAutoPay] = useState(false);

  const choose = (plan: Plan) => {
    Alert.alert(`${plan.name} plan`, "Payments are coming soon. You'll be able to subscribe here shortly.");
  };

  return (
    <LinearGradient colors={["#24104f", "#1d0c42", "#160832"]} style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={s.back}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={s.title}>Choose your plan</Text>
        </View>

        {/* Current plan */}
        {bu.limit != null && (
          <View style={s.info}>
            <Feather name="info" size={14} color="#a5b4fc" />
            <View style={{ flex: 1 }}>
              <Text style={s.infoTitle}>
                You have {bu.remaining ?? 0} of {bu.limit} questions left on your {usage?.tier_name ?? usage?.plan_name ?? "Free"} plan.
              </Text>
              <Text style={s.infoSub}>Switching to a new plan replaces your current plan and resets your question count from today.</Text>
            </View>
          </View>
        )}

        {/* Monthly / Yearly */}
        <View style={s.toggle} accessibilityRole="tablist">
          {([false, true] as const).map(isYearly => {
            const active = yearly === isYearly;
            return (
              <Pressable key={String(isYearly)} onPress={() => setYearly(isYearly)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                style={[s.toggleBtn, active && s.toggleBtnActive]}>
                {active && <LinearGradient colors={["#667eea", "#764ba2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />}
                <Text style={[s.toggleText, active && { color: "#fff" }]}>{isYearly ? "Yearly" : "Monthly"}</Text>
                {isYearly && <View style={s.save}><Text style={s.saveText}>Save ~17%</Text></View>}
              </Pressable>
            );
          })}
        </View>

        {/* AutoPay */}
        <View style={s.autopay}>
          <View style={{ flex: 1 }}>
            <Text style={s.autopayTitle}>Enable AutoPay</Text>
            <Text style={s.autopaySub}>Off by default. Pay once for this plan; you can turn on AutoPay later in Profile → Payment.</Text>
          </View>
          <Switch value={autoPay} onValueChange={setAutoPay} trackColor={{ false: "rgba(255,255,255,0.2)", true: "#8b5cf6" }} thumbColor="#fff" />
        </View>

        {/* Plans */}
        {PLANS.map(plan => {
          const price = yearly ? yearlyPrice(plan.monthly) : plan.monthly;
          return (
            <View key={plan.id} style={[s.card, plan.popular && s.cardPopular]}>
              {plan.popular && (
                <LinearGradient colors={["#667eea", "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.popular}>
                  <Text style={s.popularText}>⭐ MOST POPULAR</Text>
                </LinearGradient>
              )}
              <View style={s.cardHead}>
                <LinearGradient colors={[...plan.badge]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.planBadge}>
                  <Text style={s.planBadgeText}>{plan.name.toUpperCase()}</Text>
                </LinearGradient>
                <Text style={s.tagline}>{plan.tagline}</Text>
              </View>

              <View style={s.priceRow}>
                <Text style={s.price}>{rupees(price)}</Text>
                <Text style={s.per}>/{yearly ? "year" : "mo"}</Text>
                {yearly && <Text style={s.perMonth}>≈ {rupees(Math.round(price / 12))}/mo</Text>}
              </View>

              <Text style={s.questions}>{plan.questions}</Text>
              <Text style={s.questionsSub}>questions / month</Text>

              <View style={s.limits}>
                <View style={s.limit}><Text style={s.limitLabel}>Tutor explanations</Text><Text style={s.limitValue}>{plan.tutor} / month</Text></View>
                <View style={s.limit}><Text style={s.limitLabel}>Voice questions</Text><Text style={s.limitValue}>{plan.voice} / month</Text></View>
              </View>

              {plan.features.map(f => (
                <View key={f} style={s.feature}>
                  <Feather name="check" size={14} color="#4ade80" />
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}

              <Pressable onPress={() => choose(plan)} accessibilityRole="button" accessibilityLabel={`Choose ${plan.name}, ${rupees(price)} per ${yearly ? "year" : "month"}`}
                style={({ pressed }) => [s.choose, !plan.popular && s.chooseOutline, pressed && { opacity: 0.85 }]}>
                {plan.popular && <LinearGradient colors={["#667eea", "#764ba2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />}
                <Text style={s.chooseText}>Choose {plan.name}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  info: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(165,180,252,0.35)", backgroundColor: "rgba(102,126,234,0.14)" },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  infoSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 3, lineHeight: 16 },
  toggle: { flexDirection: "row", alignSelf: "center", padding: 4, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", gap: 4 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, minHeight: 38, borderRadius: 9, overflow: "hidden" },
  toggleBtnActive: {},
  toggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)" },
  save: { backgroundColor: "rgba(74,222,128,0.2)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saveText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#4ade80" },
  autopay: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" },
  autopayTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  autopaySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 2, lineHeight: 16 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(20,12,52,0.75)", overflow: "hidden" },
  cardPopular: { borderColor: "rgba(167,139,250,0.75)", borderWidth: 1.5, paddingTop: 36 },
  popular: { position: "absolute", top: 0, left: 0, right: 0, paddingVertical: 5, alignItems: "center" },
  popularText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  planBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  planBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.6 },
  tagline: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 12 },
  price: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  per: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  perMonth: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginLeft: 6 },
  questions: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#a78bfa", marginTop: 8 },
  questionsSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  limits: { flexDirection: "row", gap: 8, marginVertical: 12 },
  limit: { flex: 1, padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  limitLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  limitValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", marginTop: 2 },
  feature: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  choose: { marginTop: 14, minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chooseOutline: { borderWidth: 1, borderColor: "rgba(167,139,250,0.6)", backgroundColor: "rgba(167,139,250,0.10)" },
  chooseText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
