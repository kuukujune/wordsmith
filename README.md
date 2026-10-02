# Wordsmith

Wordsmith is a Next.js word-exploration application with an interactive Cytoscape web. Its rhyme mode uses a server-side phonetic engine rather than spelling matches or fabricated fallback results.

## Meaning engine

Word retrieval also searches a separate precomputed index of **2,500 common words**, selected from SUBTLEX-US frequencies and enriched with WordNet definitions. `words.json` and `word-index.json` use the same model/version/checksum validation and matrix-index interface as the phrase corpus. These single-word entries stay separate from the 5,000-phrase library.

Meaning supports words and complete phrases in All, Synonyms, Related, Broader, More specific, Contrasts, Imagery, and Rephrasings modes. Anything containing more than one normalized token is a phrase. Curly apostrophes, punctuation, whitespace, and dashes are normalized consistently.

Words use Princeton WordNet 3.1 synsets, definitions, usage examples, synonyms, hypernyms, hyponyms, antonyms, similar adjectives, and derivations. A small, explicit Wordsmith usage lexicon supplements dictionary relationships such as freedom/liberty and dog/animal. Datamuse supplies additional candidates only; its numerical score is never used as the final meaning score. Synset relationships describe dictionary categories, while sentence embeddings measure contextual proximity. These signals are complementary: antonyms can have similar embeddings because they occur in similar contexts.

Phrases use sentence embeddings of the entire normalized phrase and a prepared corpus of **5,000** dictionary expressions and original Wordsmith phrases. The server keeps a normalized vector matrix in memory, retrieves up to 250 neighbors and concept-tag matches, independently scores candidates, rejects weak candidates, and reranks for diversity. It never embeds all stored phrases during a request or sends models/vectors to the browser. Exact synonym, hierarchy, and contrast classifications require explicit evidence. Poetic rephrasings and symbolic associations use attributed, curated evidence alongside embedding features; metaphor interpretation remains approximate.

The default provider is **Xenova/all-MiniLM-L6-v2**, quantized ONNX (`q8`), run on CPU through `@huggingface/transformers`, producing **384-dimensional** sentence vectors. The model is downloaded to `.cache/meaning-models` on first initialization and reused across requests/hot reloads. First initialization requires network access and takes longer than warm searches. Prepared phrase vectors are included in the repository, so `npm install` and `npm run dev` are sufficient; preparation predownloads the model and is recommended for offline operation.

Word senses are returned with stable WordNet identifiers. The default financial sense of “bank” is favored for a standalone query; the sidebar offers other senses without requiring a choice before searching. API context is compared against embeddings of dictionary definitions and examples. Choosing a sense reruns the graph with `senseId`. Whole phrases do not undergo independent word-by-word sense selection.

Selecting a meaning node expands its branch. The request excludes current labels, adds at most eight children, retains the original center, and requires at least 35/100 calibrated relevance to that center. Expansion strength combines 75% parent relevance and 25% center relevance. The graph holds at most 50 nodes including its center. The sidebar shows scores, relationship evidence, sources, and sense information. Saved nodes retain their full metadata; saved webs retain mode, sense, edges, and depths. Legacy records without these fields remain supported.

```bash
npm install
npm run prepare:meaning-data
npm run dev
```

Preparation normalizes and deduplicates ordinary WordNet expressions plus original prose, rejects unsuitable entries, batches real model inference, and writes `src/data/meaning/phrases.json` and `phrase-index.json`. The index records model ID, dimensions, corpus SHA-256, data version, and attribution. Rebuild after changing corpus/model settings, and restart an already running server to load the new snapshot. Corpus and index initialization are server-only. `SemanticVectorIndex` can be replaced by pgvector or another vector database as the corpus grows.

Optional server settings, copied from `.env.example` to `.env.local`:

```env
EMBEDDING_API_URL=
EMBEDDING_API_KEY=
EMBEDDING_MODEL=
SEMANTIC_GENERATOR_API_URL=
SEMANTIC_GENERATOR_API_KEY=
SEMANTIC_GENERATOR_MODEL=
```

`EMBEDDING_API_URL` is a full OpenAI-compatible embeddings endpoint returning `data: [{index, embedding}]`. Both URL and model must be supplied; otherwise the local provider is used. Reprepare the phrase index using the configured model. A failed remote provider retains explicit lexical word relationships; phrase queries return a clear 503 rather than synthetic results. The optional generator uses a full OpenAI-compatible chat-completions endpoint and produces at most 12 candidates per search. Generation supplies text only: independently embedded candidates must pass the same relevance/quality gates. No generator is required for ordinary searches. Keys remain on the server.

### Meaning API

Vercel's configured build runs `npm run prepare:meaning-model` before `npm run build`, downloads the sentence model at build time, and traces the CPU runtime plus model into the API functions. Vercel requests load the packaged model using local files only; they do not download or write model files at runtime.

- `POST /api/meaning`: `{query, mode?, limit?, minimumScore?, exclude?, context?, senseId?, originalCenter?}`. Query maximum: 200 characters/25 normalized words. Limit: 1–30, default 16. Minimum score: 0–100, default 55. `originalCenter` enables protected branch expansion.
- `GET /api/meaning/health`: actual lexical/model/index readiness, corpus count, concept count, and dimensions. Responds 503 if required data is unavailable.
- Errors: 400 invalid request, 422 unavailable analysis, 429 rate limit, 500 unexpected failure, 503 missing required semantic data. Responses do not expose stack traces.

Provider failures are isolated with `Promise.allSettled`; diagnostics expose warnings. Requests are capped at 32 KB and candidate pools at 800. The process-local limit is 30 requests per minute per client; deploy behind a trusted proxy that sets `x-real-ip`. Cache keys include normalized query, mode, result limit, threshold, context, sense, exclusions, original center, corpus hash/version, and model ID. Failed/degraded searches are not cached. LRU cache and rate-limit implementations must be replaced with shared storage for multiple server instances.

### Meaning verification and limitations

`npm test` includes genuine local-model integration tests for strong/weak semantic relationships, whole phrases, financial/river context, lexical hierarchy, modes, exclusions, expansion, caching, malformed requests, provider failure, and quotas. Tests mock Datamuse to stay deterministic; they require the prepared phrase index and downloaded local model. Run preparation first on a fresh machine before tests.

Scores are calibrated ranking signals, not probabilities or dictionary equivalence guarantees. Ambiguous language, metaphor, cultural differences, embedding bias, rare slang, and proper nouns may produce sparse or imperfect results. The current library contains 16 curated poetic concept families; general coverage comes from WordNet expressions and embeddings. Not every phrase has a verified paraphrase or antonym, and strict modes can return fewer results. Remote services can affect latency; measured performance targets are goals after initialization, not guarantees. UI desktop/compact visual acceptance still needs a manual browser check when desktop automation is available.

### Meaning attribution

- [Princeton WordNet](https://wordnet.princeton.edu/), distributed by `wordnet-db` 3.1.14. The copied license is in `src/data/meaning/WORDNET-LICENSE.txt`; dictionary definitions/examples retain this attribution.
- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), Apache-2.0; [Xenova ONNX conversion](https://huggingface.co/Xenova/all-MiniLM-L6-v2). Transformer runtime licenses remain in installed dependencies/model cache.
- Wordsmith original phrases and explicitly authored usage/symbolism mappings. No lyrics or modern poetry were copied.
- [SUBTLEX-US word frequencies](https://github.com/words/subtlex-word-frequencies) provide a common-language preference. Datamuse, when available, is a secondary lexical candidate service.

## Rhyme engine

The engine supports single words and multiword phrases in six modes: All, Perfect, Near, Multisyllabic, Assonance, and Consonance.

For each query it:

1. Normalizes text while preserving pronounceable apostrophes.
2. Looks up pronunciations in the locally installed CMU Pronouncing Dictionary.
3. Extracts syllables, stress, vowels, consonants, and the final stressed rhyme tail.
4. Retrieves candidates from rhyme-tail, stressed-vowel, ending, and syllable indexes.
5. Builds bounded phrase candidates from an original phrase library and controlled grammatical templates.
6. Scores complete phoneme and stress sequences, with the final stressed region weighted most heavily.
7. Classifies and diversity-reranks results before returning them to the graph.

Phrase searches analyze the full phrase. The final rhyme region is still the strongest signal, but syllable count, earlier vowels, consonants, and right-to-left stress similarity all affect ranking.

Selecting a rhyme result requests another bounded set of rhymes, excludes existing graph labels, and adds a child ring without removing the original center or earlier branches.

## Setup

```bash
npm install
npm run prepare:rhyme-data
npm run dev
```

The preparation command validates the packaged dictionary and reports the available dictionary and controlled-phrase counts. Runtime indexes are initialized once on the server and retained across development hot reloads.

Optional unknown-word phonemizer settings can be added to `.env.local`:

```bash
PHONEMIZER_API_URL=
PHONEMIZER_API_KEY=
```

These variables are server-only. Ordinary dictionary words and phrases do not require an external service.

## API

- `POST /api/rhyme` performs validated rhyme searches.
- `GET /api/rhyme/health` reports dictionary, phrase, and index readiness.

Example request:

```json
{
  "query": "waiting for daylight",
  "mode": "auto",
  "limit": 16,
  "minimumScore": 55,
  "exclude": []
}
```

Requests are length-checked, result limits are capped at 30, candidate generation is bounded, and the route uses an in-memory per-client rate limit and versioned LRU-style cache.

## Verification

```bash
npm run lint
npm test
npm run build
```

Tests cover normalization, pronunciation, stressed rhyme-tail extraction, phonetic scoring, perfect word rhymes, whole-phrase results, deduplication, and request validation.

## Data attribution

Pronunciations come from the [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict), distributed through the `cmu-pronouncing-dictionary` npm package. CMUdict was created by Carnegie Mellon University's Speech Group and permits unrestricted research and commercial use with acknowledgement requested. The npm package is ISC licensed; its license is included in the installed package.

## Known limitations

- CMUdict primarily represents North American English, so accent-dependent rhymes can differ.
- Proper nouns, new slang, uncommon inflections, and invented spellings may be unknown.
- Homographs currently use the first listed pronunciation rather than contextual sense selection.
- Controlled phrase generation favors grammatical, pronounceable forms but cannot guarantee literary quality.
- The optional external phonemizer interface is configured but no third-party provider is bundled.
- In-memory cache and rate-limit state are per server process; a shared store would be needed for multi-instance deployment.
