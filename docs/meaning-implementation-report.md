# Meaning implementation report

Implemented and integrated a server-side word/phrase meaning engine. Remaining acceptance work is graphical/manual UI verification, which the desktop helper blocked because it could not establish the browser URL with sufficient confidence. No further desktop input was issued after that rejection.

## Data and providers

- Primary lexical source: Princeton WordNet 3.1, distributed by `wordnet-db` 3.1.14. Dictionary definitions, senses, examples, and relation pointers are read locally. Wordsmith's explicit usage lexicon adds sense-qualified everyday equivalence and category mappings; it is labeled in explanations.
- Secondary lexical source: Datamuse candidate retrieval. Its raw scores are discarded. A failed Datamuse provider was observed in live checks; independent lexical/embedding searches continued with a warning.
- Sentence provider: local `@huggingface/transformers` using `Xenova/all-MiniLM-L6-v2`, CPU ONNX `q8`. Remote embeddings and optional candidate generation are configurable but were not exercised against a live paid provider.
- Prepared phrase library: **5,000 phrases**. Separate embedding word library: **2,500 common words**. Curated imagery/concept families: **16**. Vectors: **384 dimensions**, normalized at preparation time. Corpus hashes, model identifiers, versions, and attribution are stored with each index.

## Added files

Paths are relative to the `wordsmith` application directory.

- API: `src/app/api/meaning/route.ts`, `src/app/api/meaning/health/route.ts`.
- Shared graph records: `src/lib/graph-types.ts`.
- Engine: `src/lib/meaning/types.ts`, `normalize.ts`, `input-analysis.ts`, `wordnet-provider.ts`, `datamuse-provider.ts`, `embedding-provider.ts`, `local-embedding-provider.ts`, `candidate-provider.ts`, `generator.ts`, `phrase-library.ts`, `semantic-scoring.ts`, `classification.ts`, `diversity-ranking.ts`, `cache.ts`, `rate-limit.ts`, `graph-adapter.ts`, `engine.ts`.
- Data: `src/data/meaning/curated.json`, `lexical-usage.json`, `concepts.json`, `blocked-terms.json`, `phrases.json`, `phrase-index.json`, `words.json`, `word-index.json`, `WORDNET-LICENSE.txt`.
- Preparation: `scripts/prepare-phrase-library.ts`, `scripts/prepare-semantic-index.ts`.
- Tests: `tests/meaning/normalization.test.ts`, `scoring.test.ts`, `engine.test.ts`, `api.test.ts`.
- Notes: `docs/meaning-development.md`, `docs/meaning-implementation-report.md`.

## Changed files

- `src/app/page.tsx`: new API, mode controls, sense selection, semantic sidebar, protected expansion, loading labels, saved metadata, and semantic edges; obsolete prototype fixtures removed.
- `src/app/wordbank/page.tsx`: safer legacy-record/date handling.
- `src/lib/wordsmith-cache.ts`: semantic fields added to graph records; meaning searches use their own versioned cache.
- `src/app/api/word-search/route.ts`: deprecated Datamuse-only Meaning entry point directs callers to the new API.
- `next.config.ts`: server model packages and data/model tracing.
- `package.json`, `package-lock.json`: model, lexical-data, and validation dependencies; preparation command.
- `.env.example`, `.gitignore`, `README.md`: configuration, cache exclusion, architecture, preparation, attribution, testing, and limitations.

## Verification

- `npm run prepare:meaning-data`: passed; both phrase and word indexes were generated with real MiniLM embeddings.
- `npm run lint`: passed.
- `npm test`: **69 tests passed across 11 files**, including **46 meaning tests** using genuine local embeddings. A subsequent focused run also passed the updated word-index readiness assertions.
- `npm run build`: passed; `/api/meaning` and `/api/meaning/health` are dynamic Node routes.
- Production `GET /api/meaning/health`: healthy WordNet, embeddings, phrase index, and word index; actual counts/dimensions confirmed.
- Production HTTP queries: `freedom` returns liberty/autonomy and classified real relations; `chasing the sunrise` returns 14 meaningful phrases/associations, including following the light and pursuing a new beginning. Financial bank context chooses the financial-institution sense; river context chooses the slope beside water. Hope Synonyms returns optimism, Contrasts returns despair, and Imagery returns first light/opening-door imagery.
- Branch queries preserve parent and center scores and omit excluded labels; graph-adapter tests verify duplicate and node-limit handling. Strong centre-relevance filtering can yield fewer than eight children.
- Representative warm production engine timings in this local environment: freedom about **33 ms**, phrase search about **18 ms**, context-sensitive bank about **25–136 ms**, cached phrase about **0.06 ms**. These are engine timings, not end-to-end browser latency or guaranteed service levels.
- Static browser chunks were checked for model/index identifiers; the sentence model and prepared vectors remain server-side.
- Graphical acceptance: **not verified**. The desktop Computer Use helper rejected browser inspection because it could not confidently establish the active URL. Production HTTP responses and server rendering were verified instead.

## Remaining limitations

Sentence similarity does not prove logical equivalence. Metaphor, language ambiguity, culture, embedding bias, slang, and proper nouns remain approximate. Curated poetic coverage has 16 concept families; broader retrieval uses ordinary dictionary phrases and common words. Strict synonym/rephrasing/hierarchy/contrast modes return only supported evidence and can be sparse. Local model initialization requires a first download; remote providers and optional generation depend on availability. Cache/quotas are process-local, and large deployments should replace them and the matrix search with shared stores/vector infrastructure. Manual desktop/compact-layout, saved-web interaction, and failure-visibility checks remain outstanding.

See `README.md` for setup and `docs/meaning-development.md` for integration details.
