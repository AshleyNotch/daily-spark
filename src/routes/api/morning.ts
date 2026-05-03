import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";

export const Route = createFileRoute("/api/morning")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const { energyLevel, focusBrandIds, notes, brands } =
          (await request.json()) as {
            energyLevel: number;
            focusBrandIds: string[];
            notes: string;
            brands: Array<{
              id: string;
              name: string;
              description: string | null;
              active_deliverables: string | null;
            }>;
          };

        const focusBrandNames = brands
          .filter((b) => focusBrandIds.includes(b.id))
          .map((b) => b.name);

        const brandContext =
          brands.length > 0
            ? brands
                .map(
                  (b) =>
                    `- ${b.name} (ID: ${b.id})${b.description ? ": " + b.description : ""}${b.active_deliverables ? " | Active: " + b.active_deliverables : ""}`
                )
                .join("\n")
            : "No brands configured yet.";

        const systemPrompt = `You are a morning productivity assistant for a design agency founder. Generate a focused, realistic task list for today based on their morning check-in.

Client brands the user manages:
${brandContext}

Return ONLY a valid JSON array — no markdown fences, no preamble, no trailing text. Exact format:
[{"title":"string","brand_id":"exact-uuid-or-null","priority":3,"energy_required":"medium","deadline":null,"status":"todo"}]

Rules:
- 5–8 tasks max
- Prioritise the user's stated focus brands
- Calibrate to energy: low energy (1–4) → fewer high-priority tasks, lighter cognitive load
- priority: integer 1–5 (5 = critical)
- energy_required: "low" | "medium" | "high"
- deadline: "YYYY-MM-DD" only if the user named a hard deadline, otherwise null
- brand_id: exact UUID from the brand list above, or null for internal tasks
- status: always "todo"`;

        const userMessage = `Energy today: ${energyLevel}/10
Focus brands: ${focusBrandNames.length > 0 ? focusBrandNames.join(", ") : "none specified"}
Hard deadlines in next 48h: ${notes.trim() || "none"}`;

        const client = new Anthropic({ apiKey });
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            try {
              const anthropicStream = client.messages.stream({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2048,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }],
              });

              let fullText = "";

              for await (const event of anthropicStream) {
                if (
                  event.type === "content_block_delta" &&
                  event.delta.type === "text_delta"
                ) {
                  fullText += event.delta.text;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`
                    )
                  );
                }
              }

              const jsonMatch = fullText.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  const tasks = JSON.parse(jsonMatch[0]);
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "done", tasks })}\n\n`
                    )
                  );
                } catch {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "error", message: "Failed to parse task JSON from response" })}\n\n`
                    )
                  );
                }
              } else {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", message: "No task list found in response" })}\n\n`
                  )
                );
              }
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Unknown error";
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "error", message })}\n\n`
                )
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
