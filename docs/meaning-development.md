# Meaning integration notes

Before this change, `/api/word-search` requested Datamuse `ml`, ranked eight first-ring words, requested another set for each parent, and created second-ring nodes. Raw provider scores controlled strength. `page.tsx` also retained unused generated design fixtures. Those fixtures are removed. Other association types retain their existing routes and rhyme engine.

Graph types originally duplicated page and cache definitions. The page's UI/saved graph types now live in `src/lib/graph-types.ts`; the legacy Supabase cache keeps its stricter record types. Meaning uses its own model/version-aware cache rather than the legacy graph cache, so old semantic scores cannot leak into the new pipeline. The deprecated GET meaning path directs clients to POST `/api/meaning`.

Meaning first-ring edges all represent actual center-result relations. Branch edges are created only following an explicit parent query, rather than attaching unrelated first-search results to arbitrary parents. The Cytoscape preset layout uses strength to affect radius and labeled/patterned edges to distinguish semantic classes. Deeper branches receive positions relative to their own parents.

Search cancellation and stale-result checks preserve the previous graph on failure. Expansion uses ref-backed request keys, excludes existing labels, rejects distant branches, checks graph identity before merging, and caps the total graph. Mode/sense metadata is stored with saved webs and full semantic node metadata with saved words. Legacy optional fields are supported; malformed local records are filtered.

The server initializes WordNet buffers, a sentence extraction pipeline, and the vector matrix once. Words get sense-qualified query vectors; phrases get full-phrase vectors. Dictionary relations and curated usage evidence are authoritative only for their specified senses. Cosine similarity is calibrated before independent weighted scoring; diversity penalties affect ordering, not the displayed relevance score. The index model and corpus hash must match runtime settings.

Automated verification includes actual MiniLM inference, not a lexical-overlap stand-in. External candidate traffic is mocked in unit/integration tests. Manual graphical acceptance was blocked by the desktop helper's browser-URL policy check; no subsequent desktop input was issued.
