import "@/lib/env";
import { NextResponse } from "next/server";
import { compareStream } from "@/lib/compare";
import type { Query } from "@/lib/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Query>;
  const fts = body.fts?.trim();
  const criteria = body.criteria?.trim();

  if (!fts || !criteria) {
    return NextResponse.json(
      { error: "Both a search query and criteria are required." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const event of compareStream({ fts, criteria })) send(event);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
