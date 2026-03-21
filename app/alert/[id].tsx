import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertsContext, ThemeContext, type AlertItem } from "../_layout";

// 编辑提醒页面主组件
export default function EditAlertScreen() {
  const router = useRouter(); // 获取当前页面的路由控制、提醒 id、提醒数据操作方法，以及主题颜色配置
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, updateAlert, removeAlert } = useContext(AlertsContext);
  const { colors, resolvedScheme } = useContext(ThemeContext);

  // 根据路由参数中的 id，在提醒列表中找到当前要编辑的提醒对象
  const alert = useMemo(() => alerts.find((a) => a.id === id), [alerts, id]);

  // 如果当前提醒不存在，说明它可能已经被删除
  if (!alert) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>Alert not found</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>This alert may have been deleted.</Text>
        <Pressable // 返回上一页
          style={[styles.primaryButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <EditForm
      alert={alert}
      onSave={updateAlert}
      onDelete={removeAlert}
      colors={colors}
      resolvedScheme={resolvedScheme}
    />
  );
}

// 编辑表单组件
function EditForm({
  alert,
  onSave,
  onDelete,
  colors,
  resolvedScheme,
}: {
  alert: AlertItem;
  onSave: (id: string, patch: Partial<Omit<AlertItem, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  colors: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    tint: string;
    danger: string;
  };
  resolvedScheme: "dark" | "light";
}) {
  const router = useRouter();
  const [rule, setRule] = useState<"ABOVE" | "BELOW">(alert.rule); // 表单内部状态
  const [target, setTarget] = useState(String(alert.target));
  const [enabled, setEnabled] = useState(alert.enabled);

  // 根据当前明暗主题计算占位文字颜色和选中按钮背景色
  const placeholder =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.35)";
  const pillActiveBg = resolvedScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  // 编辑页面主体
  return ( 
    // 顶部标题区域
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Edit Alert</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>Symbol: {alert.symbol}</Text>

      <Text style={[styles.label, { color: colors.subtext }]}>Condition</Text> 
      <View style={styles.row}>
        <Pressable // 提醒条件选择区域, 价格高于目标值时触发
          style={[
            styles.pill,
            { borderColor: colors.border },
            rule === "ABOVE" && { backgroundColor: pillActiveBg, borderColor: colors.tint },
          ]}
          onPress={() => setRule("ABOVE")}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>Above</Text>
        </Pressable>

        <Pressable // 价格低于目标值时触发
          style={[
            styles.pill,
            { borderColor: colors.border },
            rule === "BELOW" && { backgroundColor: pillActiveBg, borderColor: colors.tint },
          ]}
          onPress={() => setRule("BELOW")}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>Below</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>Target Price</Text>
      <TextInput // 目标价格输入框
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text, backgroundColor: colors.card },
        ]}
        value={target}
        onChangeText={setTarget}
        placeholder="e.g. 130.00"
        placeholderTextColor={placeholder}
        keyboardType="decimal-pad"
      />

      <View style={[styles.row, { marginTop: 6 }]}> 
        <Pressable
          style={[
            styles.pill,
            { borderColor: colors.border },
            enabled && { backgroundColor: pillActiveBg, borderColor: colors.tint },
          ]}
          onPress={() => setEnabled((v) => !v)}
        >
          <Text style={[styles.pillText, { color: colors.text }]}>{enabled ? "Enabled" : "Disabled"}</Text>
        </Pressable>
      </View>

      <Pressable // 保存按钮
        style={[styles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => {
          const t = Number(target);
          if (!Number.isFinite(t)) return;
          onSave(alert.id, { rule, target: t, enabled });
          router.back();
        }}
      >
        <Text style={styles.primaryButtonText}>Save</Text>
      </Pressable>

      <Pressable // 删除按钮
        style={[styles.primaryButton, { backgroundColor: colors.danger }]}
        onPress={() => {
          onDelete(alert.id);
          router.back();
        }}
      >
        <Text style={styles.primaryButtonText}>Delete</Text>
      </Pressable>

      <Pressable onPress={() => router.back()}> 
        <Text style={[styles.back, { color: colors.subtext }]}>Back</Text>
      </Pressable> 
    </View>
  ); // 底部返回入口，不保存修改，直接回到上一页
}

// 样式定义区
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 } as ViewStyle,
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 } as TextStyle,
  subtitle: { fontSize: 14, marginBottom: 18 } as TextStyle,
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8 } as TextStyle,

  row: { flexDirection: "row", gap: 10, marginBottom: 16 } as ViewStyle,
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  } as ViewStyle,
  pillText: { fontSize: 14, fontWeight: "800" } as TextStyle,

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  } as TextStyle,

  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  } as ViewStyle,
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" } as TextStyle,
  back: { textAlign: "center", marginTop: 6 } as TextStyle,
});
