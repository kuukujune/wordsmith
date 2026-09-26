import { NextResponse } from "next/server";
import { RhymeRequestError, searchRhymes, validateRhymeRequest } from "@/lib/rhyme/engine";
import { checkRhymeRateLimit } from "@/lib/rhyme/rate-limit";

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-real-ip") ?? "local-client";
  if (!checkRhymeRateLimit(clientKey, process.env.NODE_ENV === "test" ? 500 : 30)) {
    return NextResponse.json({ error: "Too many rhyme searches. Try again in a minute." }, { status: 429 });
  }
  try {
    const body = await request.json().catch(() => null);
    const input = validateRhymeRequest(body);
    return NextResponse.json(await searchRhymes(input));
  } catch (error) {
    if (error instanceof RhymeRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "The rhyme engine could not complete this search." }, { status: 500 });
  }
}
