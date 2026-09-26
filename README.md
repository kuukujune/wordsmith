# Wordsmith

Wordsmith is a Next.js word-exploration application with an interactive Cytoscape web. Its rhyme mode uses a server-side phonetic engine rather than spelling matches or fabricated fallback results.

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
