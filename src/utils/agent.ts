import { supabase } from "./supabaseClient";

export type AgentResponse = {
  assistantText: string;
  proposals: string[]; // proposal IDs
};

export type ProposalRow = {
  id: string;
  action_type: string;
  action_payload: any;
  status: "pending" | "applied" | "cancelled" | "failed";
  created_at: string;
};

export async function sendToAgent(message: string, conversationId?: string) {
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { message, conversationId },
  });
  if (error) throw error;

  return data as AgentResponse;
}

// Fetch proposal details so you can show cards in the UI
export async function fetchProposalsByIds(ids: string[]) {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("ai_action_proposals")
    .select("id, action_type, action_payload, status, created_at")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as ProposalRow[];
}

export async function applyProposal(proposalId: string) {
  const { data, error } = await supabase.functions.invoke("apply_action", {
    body: { proposal_id: proposalId },
  });
  if (error) throw error;
  return data as { ok: boolean; appliedResult: any };
}

export async function cancelProposal(proposalId: string) {
  // Optional but useful: lets user decline a suggestion
  const { error } = await supabase
    .from("ai_action_proposals")
    .update({ status: "cancelled" })
    .eq("id", proposalId);

  if (error) throw error;
}