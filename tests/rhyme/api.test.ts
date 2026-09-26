import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "../../src/app/api/rhyme/route";

function request(body: unknown) {
  return new Request("http://localhost/api/rhyme", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": `test-${Math.random()}` },
    body: JSON.stringify(body),
  });
}

describe("rhyme API", () => {
  it("returns the documented response shape and exclusions", async () => {
    const response = await POST(request({ query: "light", mode: "perfect", limit: 6, exclude: ["night"] }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.center.text).toBe("light");
    expect(payload.results).toHaveLength(6);
    expect(payload.results.some((result: { text: string }) => result.text === "night")).toBe(false);
    expect(payload.diagnostics.returnedCount).toBe(6);
  }, 30_000);

  it.each([
    [{ query: "" }, 400],
    [{ query: "light", mode: "wrong" }, 400],
    [{ query: "light", limit: 49 }, 400],
    [{ query: "xqzzzxq" }, 422],
  ])("rejects invalid input", async (body, status) => {
    const response = await POST(request(body));
    expect(response.status).toBe(status);
  });

  it("marks repeat requests as cache hits", async () => {
    const body = { query: "blue", mode: "auto", limit: 5 };
    await POST(request(body));
    const response = await POST(request(body));
    expect((await response.json()).diagnostics.cacheHit).toBe(true);
  }, 30_000);
});
