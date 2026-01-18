import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cronSecret = Deno.env.get("CRON_SECRET") || "";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isValidExpoPushToken = (token: string) =>
  token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken[");

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response("Missing Supabase env vars", { status: 500, headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization") || "";
  const cronHeader = req.headers.get("x-cron-secret") || "";
  let isAuthorized = false;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      isAuthorized = true;
    }
  } else if (cronSecret && cronHeader === cronSecret) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let payload: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    userIds?: string[];
    tokens?: string[];
    sharedTaskId?: string;
    excludeUserId?: string;
  } = {};

  try {
    payload = (await req.json()) || {};
  } catch (_err) {
    return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  if (!title || !body) {
    return new Response("Missing title or body", { status: 400, headers: corsHeaders });
  }

  let targetUserIds = Array.isArray(payload.userIds)
    ? payload.userIds.filter(Boolean)
    : [];

  if (payload.sharedTaskId) {
    const { data, error } = await adminClient
      .from("task_participants")
      .select("user_id")
      .eq("task_id", payload.sharedTaskId);

    if (!error) {
      targetUserIds = (data || []).map((row) => row.user_id).filter(Boolean);
    }
  }

  if (payload.excludeUserId) {
    targetUserIds = targetUserIds.filter((id) => id !== payload.excludeUserId);
  }

  let tokens = Array.isArray(payload.tokens) ? payload.tokens.filter(Boolean) : [];

  if (!tokens.length && targetUserIds.length) {
    const { data, error } = await adminClient
      .from("push_tokens")
      .select("expo_push_token")
      .in("user_id", targetUserIds);

    if (!error) {
      tokens = (data || []).map((row) => row.expo_push_token).filter(Boolean);
    }
  }

  const uniqueTokens = Array.from(new Set(tokens)).filter(isValidExpoPushToken);

  if (!uniqueTokens.length) {
    return new Response(
      JSON.stringify({ sent: 0, reason: "no tokens" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const messages = uniqueTokens.map((token) => ({
    to: token,
    title,
    body,
    data: payload.data || {},
    sound: "default",
  }));

  const chunks = chunkArray(messages, 100);
  const results = [];

  for (const chunk of chunks) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    const json = await response.json().catch(() => ({}));
    results.push({ status: response.status, response: json });
  }

  return new Response(
    JSON.stringify({ sent: uniqueTokens.length, chunks: results.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
