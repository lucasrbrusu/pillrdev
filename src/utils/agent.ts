import { supabase } from "./supabaseClient";

/**
 * Calls https://<project>.supabase.co/functions/v1/agent
 */
export async function sendToAgent(message: string, conversationId?: string) {
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { message, conversation_id: conversationId ?? null },
  });

  if (error) {
    console.log("AGENT invoke error:", JSON.stringify(error, null, 2));
    throw new Error(
      `${error.message}${error.context?.status ? ` (status ${error.context.status})` : ""}`
    );
  }

  return data as { assistantText: string; proposals?: any[] };
}

/**
 * Calls https://<project>.supabase.co/functions/v1/apply_action
 */
export async function applyProposal(proposalId: string) {
  const { data, error } = await supabase.functions.invoke("apply_action", {
    body: { proposal_id: proposalId },
  });

  if (error) {
    console.log("APPLY_ACTION invoke error:", JSON.stringify(error, null, 2));
    throw new Error(
      `${error.message}${error.context?.status ? ` (status ${error.context.status})` : ""}`
    );
  }

  return data as { ok: boolean; appliedResult?: any };
}
