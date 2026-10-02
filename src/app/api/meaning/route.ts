import { NextResponse } from "next/server";
import { MeaningError, searchMeaning } from "@/lib/meaning/engine";
import { checkMeaningRateLimit } from "@/lib/meaning/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const key = request.headers.get("x-real-ip") ?? "local-client";
  if (!checkMeaningRateLimit(key)) return NextResponse.json({ error: "Too many meaning searches. Retry in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  if (Number(request.headers.get("content-length") ?? 0) > 32_000) return NextResponse.json({ error: "Request too large." }, { status: 400 });
  try {
    const raw = await request.text(); if (raw.length > 32_000) throw new MeaningError("Request too large.", 400);
    let body; try { body = JSON.parse(raw); } catch { throw new MeaningError("Send a valid JSON request.", 400); }
    return NextResponse.json(await searchMeaning(body));
  } catch (error) {
    if (error instanceof MeaningError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "The meaning engine could not complete this search. Please retry." }, { status: 500 });
  }
}
