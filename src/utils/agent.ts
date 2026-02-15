import { supabase } from "../utils/supabaseClient"; // adjust import

export type Proposal = {
  id: string;
  action_type:
    | "create_task" | "update_task"
    | "create_habit" | "complete_habit"
    | "create_note"
    | "log_health_daily" | "add_food_entry"
    | "create_routine" | "add_routine_task"
    | "create_reminder"
    | "create_chore"
    | "create_grocery";
  action_payload: any;
  status: "pending" | "applied" | "declined";
  created_at?: string;
};

export type ProposalRow = Proposal;

export async function callAgent(message: string, conversationId?: string | null) {
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { message, conversationId }, // <--- add this
  });

  if (error) throw error;

  return data as {
    assistantText: string;
    proposals?: Proposal[];
    conversationId?: string | null;
  };
}


// ChatScreen expects sendToAgent, so make it an alias
export async function sendToAgent(message: string, conversationId?: string | null) {
  return callAgent(message, conversationId);
}

// If you ever return proposal IDs from the agent, ChatScreen uses this
export async function fetchProposalsByIds(ids: string[]) {
  const { data, error } = await supabase
    .from("ai_action_proposals")
    .select("id, action_type, action_payload, status, created_at")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as ProposalRow[];
}

// Approve = call your apply_action edge function
export async function applyProposal(proposalId: string) {
  const { data, error } = await supabase.functions.invoke("apply_action", {
    body: { proposal_id: proposalId },
  });

  if (error) throw error;
  return data as { ok: true; appliedResult: any };
}

// Decline = update status directly (requires correct RLS)
export async function cancelProposal(proposalId: string) {
  const { error } = await supabase
    .from("ai_action_proposals")
    .update({ status: "declined" })
    .eq("id", proposalId);

  if (error) throw error;
}
