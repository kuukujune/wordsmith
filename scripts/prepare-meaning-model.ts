// Vercel packages the downloaded model at build time; no runtime downloads/writes.
async function main() {
  process.env.WORDSMITH_MODEL_PREPARING = "1";
  const { embeddingProvider } = await import("../src/lib/meaning/embedding-provider");
  await embeddingProvider().embed(["Prepare Wordsmith sentence embeddings."]);
  console.log("Meaning model ready for deployment.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
