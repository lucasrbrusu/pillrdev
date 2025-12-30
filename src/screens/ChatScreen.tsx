import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { useNavigation } from "@react-navigation/native";

import {
  applyProposal,
  cancelProposal,
  fetchProposalsByIds,
  type ProposalRow,
  sendToAgent,
} from "../utils/agent";


type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposals?: ProposalRow[];
};




function prettyActionTitle(actionType: string) {
  switch (actionType) {
    case "create_task":
      return "Create task";
    case "update_task":
      return "Update task";
    case "create_habit":
      return "Create habit";
    case "complete_habit":
      return "Complete habit";
    case "create_note":
      return "Create note";
    case "log_health_daily":
      return "Log health (daily)";
    case "add_food_entry":
      return "Add food entry";
    case "create_routine":
      return "Create routine";
    case "add_routine_task":
      return "Add routine task";
    case "create_reminder":
      return "Create reminder";
    case "create_chore":
      return "Create chore";
    case "create_grocery":
      return "Add grocery item";
    default:
      return actionType;
  }
}

export default function ChatScreen() {
  const { profile, themeColors } = useApp();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isPremium = !!profile?.isPremium;
  const backgroundColor = themeColors?.background ?? "#0f0f0f";
  const surfaceColor = themeColors?.card ?? "#1a1a1a";
  const textColor = themeColors?.text ?? "white";
  const mutedTextColor = themeColors?.textSecondary ?? "#888";
  const userBubbleColor = themeColors?.primary ?? "#2b2b2b";
  const assistantBubbleColor = surfaceColor;
  const borderColor = themeColors?.border ?? "#333";
  const inputBackground = themeColors?.inputBackground ?? surfaceColor;
  const placeholderTextColor = themeColors?.placeholder ?? "#777";
  const primaryColor = themeColors?.primary ?? "#4b2cff";
  const disabledButtonColor = surfaceColor;
  const buttonTextColor = "#fff";
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "m0",
      role: "assistant",
      text: "Tell me what you want to do: tasks, habits, routines, reminders, groceries, health logs, or notes.",
    },
  ]);

  const [pendingProposals, setPendingProposals] = useState<ProposalRow[]>([]);
  const horizontalPadding = 12;
  const bottomInset = Math.max(insets.bottom, 12);

  async function onSend() {
    if (!isPremium) return;
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await sendToAgent(text);

      const botMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.assistantText || "(no response)",
      };
      setMessages((prev) => [...prev, botMsg]);

      if (res.proposals?.length) {
        // proposals are already full rows
        setPendingProposals((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of res.proposals) {
            if (!seen.has(p.id)) merged.push(p);
          }
          return merged;
        });
      }
    } catch (e: any) {
      setMessages((prev) => [
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Error: ${e?.message ?? String(e)}`,
        },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }

  async function onApprove(proposalId: string) {
    setPendingProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "applied" } : p))
    );

    try {
      await applyProposal(proposalId);
      setMessages((prev) => [
        ...prev,
        { id: `ok-${Date.now()}`, role: "assistant", text: "Done. Saved to your account." },
      ]);
    } catch (e: any) {
      setPendingProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: "failed" as any } : p))
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `fail-${Date.now()}`,
          role: "assistant",
          text: `Couldn't apply that: ${e?.message ?? String(e)}`,
        },
      ]);
    }
  }

  async function onCancel(proposalId: string) {
    setPendingProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "declined" } : p))
    );
    try {
      await cancelProposal(proposalId);
    } catch {
      // ignore
    }
  }

  if (!isPremium) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor }}>
        <View
          style={{
            flex: 1,
            padding: 20,
            paddingBottom: bottomInset + 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 460,
              padding: 20,
              borderRadius: 16,
              backgroundColor: surfaceColor,
              borderWidth: 1,
              borderColor: "#222",
            }}
          >
            <Text style={{ color: textColor, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              Premium required
            </Text>
            <Text style={{ color: mutedTextColor, fontSize: 15, lineHeight: 22 }}>
              Upgrade to a premium plan to unlock the PillarUp AI agent and start chatting.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Paywall", { source: "chat" })}
              activeOpacity={0.9}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: primaryColor,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>View PillarUp Premium</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor }}>
        <View
          style={{
            flex: 1,
            paddingTop: 12,
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomInset,
          }}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: bottomInset + 12 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View
                style={{
                  alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                  backgroundColor: item.role === "user" ? userBubbleColor : assistantBubbleColor,
                  padding: 10,
                  borderRadius: 12,
                  marginVertical: 6,
                  maxWidth: "85%",
                }}
              >
                <Text style={{ color: item.role === "user" ? "#fff" : textColor }}>{item.text}</Text>
              </View>
            )}
          />

          {/* Proposal cards */}
          {pendingProposals.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: textColor, marginBottom: 6, fontWeight: "600" }}>
                Suggested actions
              </Text>

              {pendingProposals
                .slice()
                .reverse()
                .filter((p) => p.status === "pending")
                .map((p) => (
                  <View
                    key={p.id}
                    style={{
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ color: textColor, fontWeight: "700" }}>
                      {prettyActionTitle(p.action_type)}
                    </Text>

                    <Text style={{ color: mutedTextColor, marginTop: 6 }}>
                      {JSON.stringify(p.action_payload, null, 2)}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                      <TouchableOpacity
                        onPress={() => onApprove(p.id)}
                        style={{
                          backgroundColor: "#4b2cff",
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "700" }}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onCancel(p.id)}
                        style={{
                          backgroundColor: "#333",
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {/* Input */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="e.g. Create a task tomorrow at 5pm to submit coursework"
              placeholderTextColor={placeholderTextColor}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor,
                borderRadius: 12,
                padding: 12,
                color: textColor,
                backgroundColor: inputBackground,
              }}
              multiline
              blurOnSubmit={false}
              onSubmitEditing={onSend}
            />
            <TouchableOpacity
              onPress={onSend}
              disabled={sending}
              style={{
                width: 90,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: sending ? disabledButtonColor : primaryColor,
                borderRadius: 12,
              }}
            >
              {sending ? (
                <ActivityIndicator color={buttonTextColor} />
              ) : (
                <Text style={{ color: buttonTextColor, fontWeight: "700" }}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
