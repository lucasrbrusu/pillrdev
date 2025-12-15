import { supabase } from "../utils/supabaseClient";

export async function sendToAgent(message: string, conversationId?: string) {
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { message, conversationId },
  });

  if (error) throw error;
  return data as {
    assistantText: string;
    proposed_actions: Array<{ type: string; payload: any }>;
  };
}