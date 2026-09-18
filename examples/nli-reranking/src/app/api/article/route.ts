import "@/lib/env";
import { NextResponse } from "next/server";
import { birdsIndex } from "@/lib/pinecone";
import { BODY_FIELDS, SNIPPET_MAX_CHARS, imageFor } from "@/lib/corpus";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const res = await birdsIndex().documents.fetch({
      ids: [id],
      includeFields: ["bird_name", "intro", ...BODY_FIELDS],
    });
    const doc = res.documents?.[id] as Record<string, unknown> | undefined;
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const intro = String(doc.intro ?? "");
    const body = BODY_FIELDS.map((f) => String(doc[f] ?? ""))
      .join("")
      .trim();

    return NextResponse.json({
      id,
      name: String(doc.bird_name ?? id),
      image: imageFor(id),
      intro,
      body,
      gradedChars: Math.min(intro.length, SNIPPET_MAX_CHARS),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
