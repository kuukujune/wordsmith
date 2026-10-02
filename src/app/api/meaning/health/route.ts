import { NextResponse } from "next/server";
import { meaningHealth } from "@/lib/meaning/engine";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() { try { const health = await meaningHealth(); return NextResponse.json(health, { status: health.ok ? 200 : 503 }); } catch { return NextResponse.json({ ok: false, error: "Meaning data unavailable." }, { status: 503 }); } }
