// Supabase Edge Function — morning-checkin
// Deploy: supabase functions deploy morning-checkin
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Brand {
  id: string;
  name: string;
  description: string | null;
  active_deliverables: string | null;
}

interface SessionData {
  energyLevel: number;
  focusBrands: string[];
  notes: string;
}

interface RequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  brands: Brand[];
  sessionData: SessionData;
  date: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY secret not set" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { messages, brands, sessionData, date }: RequestBody = await req.json();
    const { energyLevel, focusBrands, notes } = sessionData;

    const brandContext =
      brands.length > 0
        ? brands
            .map(
              (b) =>
                `- ${b.name} (ID: ${b.id})${b.description ? ": " + b.description : ""}${b.active_deliverables ? " | Active: " + b.active_deliverables : ""}`
            )
            .join("\n")
        : "No brands configured yet.";

    const systemPrompt = `You are a morning productivity assistant for a design agency founder. The user just completed their morning check-in. Generate a focused, realistic task list for today (${date}).

Client brands:
${brandContext}

Check-in summary:
- Energy: ${energyLevel}/10
- Focus brands today: ${focusBrands.length > 0 ? focusBrands.join(", ") : "not specified"}
- Deadlines/notes: ${notes || "none"}

Return ONLY a valid JSON array — no markdown, no preamble, no trailing text:
[{"title":"string","brand_id":"exact-uuid-or-null","priority":3,"energy_required":"medium","deadline":null,"status":"todo"}]

Rules:
- 5–8 tasks max
- Prioritise the stated focus brands
- Calibrate cognitive demand to energy: low energy (1–4) → fewer high-priority tasks, simpler work
- priority: 1–5 (5 = critical today)
- energy_required: "low" | "medium" | "high"
- deadline: "YYYY-MM-DD" only if user mentioned a hard deadline, otherwise null
- brand_id: exact UUID from the list above, or null
- status: always "todo"`;

    // Use the conversation for context; append a clean generation trigger
    const claudeMessages = [
      ...messages,
      {
        role: "user" as const,
        content: "Based on our conversation, please generate my task list for today as a JSON array.",
      },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error ${res.status}: ${errText}` }),
        { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const completion = await res.json();
    const rawText: string = completion?.content?.[0]?.text ?? "";

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "No JSON array found in AI response", raw: rawText }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let tasks;
    try {
      tasks = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse task JSON", raw: rawText }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
