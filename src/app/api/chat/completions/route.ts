import { NextRequest, NextResponse } from "next/server";
import { Logger } from "@/utils/logger";
import OpenAI from "openai";
import { env } from "@/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = new Logger("API:Chat");
const DEFAULT_MODEL = "gemini-2.5-flash";

const gemini = new OpenAI({
  apiKey: env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/** Vapi sends OpenAI model names; Gemini only accepts Gemini ids. Upgrade deprecated 2.0 Flash. */
function resolveGeminiModel(requested: unknown): string {
  if (typeof requested !== "string" || !requested.trim()) return DEFAULT_MODEL;
  const raw = requested.trim();
  const m = raw.toLowerCase();
  if (!m.startsWith("gemini-") && !m.startsWith("models/gemini")) {
    return DEFAULT_MODEL;
  }
  if (
    m === "gemini-2.0-flash" ||
    m === "gemini-2.0-flash-lite" ||
    m.startsWith("gemini-2.0-flash-")
  ) {
    return DEFAULT_MODEL;
  }
  return raw;
}

function normalizeMessages(
  messages: unknown[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((raw) => {
    const m = raw as Record<string, unknown>;
    if (!m || typeof m !== "object" || typeof m.role !== "string") {
      return raw as OpenAI.Chat.ChatCompletionMessageParam;
    }
    if (m.tool_calls || m.function_call) {
      return raw as OpenAI.Chat.ChatCompletionMessageParam;
    }
    const content = m.content;
    if (typeof content === "string" || content == null) {
      return raw as OpenAI.Chat.ChatCompletionMessageParam;
    }
    if (!Array.isArray(content)) {
      return raw as OpenAI.Chat.ChatCompletionMessageParam;
    }
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const p = part as Record<string, unknown>;
        return p.type === "text" && typeof p.text === "string" ? p.text : "";
      })
      .join("")
      .trim();
    return {
      ...m,
      content: text || "(empty)",
    } as OpenAI.Chat.ChatCompletionMessageParam;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, messages, max_tokens, temperature, stream, tools, tool_choice } =
      body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const toolExtras =
      Array.isArray(tools) && tools.length > 0
        ? {
            tools,
            ...(tool_choice != null ? { tool_choice } : {}),
          }
        : {};

    const baseParams = {
      model: resolveGeminiModel(model),
      messages: normalizeMessages(messages),
      max_tokens: typeof max_tokens === "number" ? max_tokens : 1024,
      temperature: typeof temperature === "number" ? temperature : 0.7,
      ...toolExtras,
    };

    if (stream) {
      const completionStream = await gemini.chat.completions.create({
        ...baseParams,
        stream: true,
      } as OpenAI.Chat.ChatCompletionCreateParamsStreaming);

      const encoder = new TextEncoder();
      const streamOut = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completionStream) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            logger.error("Stream error", { error });
            controller.error(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
      });

      return new Response(streamOut, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const completion = await gemini.chat.completions.create({
      ...baseParams,
      stream: false,
    });
    return NextResponse.json(completion);
  } catch (error) {
    logger.error("Chat completion failed", { error });
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `API Error: ${error.message}`, code: error.code },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
