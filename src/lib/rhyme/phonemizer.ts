import "server-only";

export interface PhonemizerProvider {
  pronounce(text: string): Promise<string[] | null>;
}

export const configuredPhonemizer: PhonemizerProvider = {
  async pronounce(text) {
    const url = process.env.PHONEMIZER_API_URL;
    if (!url) return null;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PHONEMIZER_API_KEY ? { Authorization: `Bearer ${process.env.PHONEMIZER_API_KEY}` } : {}),
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { phonemes?: unknown } | null;
    if (!payload || !Array.isArray(payload.phonemes) || !payload.phonemes.every((item) => typeof item === "string")) return null;
    return payload.phonemes as string[];
  },
};
