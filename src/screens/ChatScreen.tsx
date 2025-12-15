import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  applyProposal,
  cancelProposal,
  fetchProposalsByIds,
  ProposalRow,
  sendToAgent,
} from "../utils/agent";

type ChatMsg = { id: string; role: "user" | "assistant"; text: string };

function prettyActionTitle(actionType: string) {
  switch (actionType) {
    case "create_task": return "Create task";
    case "update_task": return "Update task";
    case "create_habit": return "Create habit";
    case "complete_habit": return "Complete habit";
    case "create_note": return "Create note";
    case "log_health_daily": return "Log health (daily)";
    case "add_food_entry": return "Add food entry";
    case "create_routine": return "Create routine";
    case "add_routine_task": return "Add routine task";
    case "create_reminder": return "Create reminder";
    case "create_chore": return "Create chore";
    case "create_grocery": return "Add grocery item";
    default: return actionType;
  }
}

export default function AIAgentScreen() {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "m0", role: "assistant", text: "Tell me what you want to do — tasks, habits, routines, reminders, groceries, health logs, notes." },
  ]);

  const [pendingProposals, setPendingProposals] = useState<ProposalRow[]>([]);
  const hasPending = pendingProposals.some((p) => p.status === "pending");

  const listData = useMemo(() => {
    // Show chat first, then proposal cards
    return { messages, proposals: pendingProposals };
  }, [messages, pendingProposals]);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [userMsg, ...prev]);

    try {
      const res = await sendToAgent(text);

      const botMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", text: res.assistantText || "(no response)" };
      setMessages((prev) => [botMsg, ...prev]);

      if (res.proposals?.length) {
        const proposalRows = await fetchProposalsByIds(res.proposals);

        // Keep any older proposals; add new ones
        setPendingProposals((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of proposalRows) {
            if (!seen.has(p.id)) merged.push(p);
          }
          return merged;
        });
      }
    } catch (e: any) {
      setMessages((prev) => [
        { id: `err-${Date.now()}`, role: "assistant", text: `Error: ${e?.message ?? String(e)}` },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }

  async function onApprove(proposalId: string) {
    // Optimistic UI
    setPendingProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "applied" } : p)));

    try {
      const res = await applyProposal(proposalId);
      setMessages((prev) => [
        { id: `ok-${Date.now()}`, role: "assistant", text: "✅ Done. Saved to your account." },
        ...prev,
      ]);
    } catch (e: any) {
      // Revert if failed
      setPendingProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "failed" as any } : p)));
      setMessages((prev) => [
        { id: `fail-${Date.now()}`, role: "assistant", text: `❌ Couldn’t apply that: ${e?.message ?? String(e)}` },
        ...prev,
      ]);
    }
  }

  async function onCancel(proposalId: string) {
    setPendingProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "cancelled" } : p)));
    try {
      await cancelProposal(proposalId);
    } catch {
      // If policy disallows update, this might fail—UI will still hide it. You can ignore or show a warning.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 12 }}>
        <FlatList
          inverted
          data={listData.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                backgroundColor: item.role === "user" ? "#2b2b2b" : "#1a1a1a",
                padding: 10,
                borderRadius: 12,
                marginVertical: 6,
                maxWidth: "85%",
              }}
            >
              <Text style={{ color: "white" }}>{item.text}</Text>
            </View>
          )}
        />

        {/* Proposal cards */}
        {pendingProposals.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: "white", marginBottom: 6, fontWeight: "600" }}>
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
                    borderColor: "#333",
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {prettyActionTitle(p.action_type)}
                  </Text>

                  <Text style={{ color: "#bbb", marginTop: 6 }}>
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
            placeholderTextColor="#777"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#333",
              borderRadius: 12,
              padding: 12,
              color: "white",
            }}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={sending}
            style={{
              width: 90,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sending ? "#222" : "#4b2cff",
              borderRadius: 12,
            }}
          >
            {sending ? <ActivityIndicator /> : <Text style={{ color: "white", fontWeight: "700" }}>Send</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}