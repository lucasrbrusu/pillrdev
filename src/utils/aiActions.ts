import { supabase } from "../utils/supabaseClient";

export async function approveProposal(proposal_id: string) {
  const { data, error } = await supabase.functions.invoke("apply_action", {
    body: { proposal_id },
  });

  if (error) throw error;
  return data as { ok: true; appliedResult: any };
}

export async function declineProposal(proposal_id: string) {
  const { error } = await supabase
    .from("ai_action_proposals")
    .update({ status: "declined" })
    .eq("id", proposal_id);

  if (error) throw error;
}
