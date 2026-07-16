# Wordsmith MVP Deployment

This file covers Steps 14-16 from the MVP instructions.

## 1. Create The Supabase Tables

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open `supabase/schema.sql` from this repo.
4. Paste the whole file into Supabase SQL Editor.
5. Run it.

The schema creates:

- `entries`: words and phrases.
- `relations`: links between entries, including cached graph relationships.
- `saved_items`: future account-based saved words.
- `saved_webs`: future account-based saved graphs.
- `feedback`: beta feedback.

The app still uses browser local storage for WordBank saves right now. Supabase is currently used by the API route as an optional cache for searched graphs.

## 2. Add Environment Variables

Create a local `.env.local` file by copying `.env.example`.

Required for Supabase caching:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Beginner note:

- `SUPABASE_URL` tells the app which Supabase project to use.
- `SUPABASE_ANON_KEY` is the public project key.
- `SUPABASE_SERVICE_ROLE_KEY` is private and should only be used on the server. In this app it is read only by the API route.

If these are missing, Wordsmith still works. It simply calls Datamuse directly and skips Supabase caching.

## 3. How The Cache Works

When a user searches:

1. The browser calls `/api/word-search`.
2. The API checks Supabase for an existing cached graph.
3. If it finds one, it returns that cached graph.
4. If it does not find one, it calls Datamuse.
5. The API normalizes Datamuse results into Wordsmith nodes and edges.
6. The API writes those entries and relations to Supabase.
7. The API returns the graph to the browser.

This means the first search may be slower, but later identical searches can come from Supabase.

## 4. Push To GitHub

From the `wordsmith` folder:

```bash
git status
git add .
git commit -m "Complete MVP steps 13-16"
git push
```

## 5. Deploy On Vercel

1. Open Vercel.
2. Import the GitHub repo.
3. Set Framework Preset to Next.js if Vercel does not detect it automatically.
4. Add the same environment variables from `.env.local`.
5. Deploy.

## 6. Test The Live Site

After Vercel deploys:

1. Open the live URL on desktop.
2. Search a word like `lonely`.
3. Confirm the graph loads.
4. Click a node and confirm the details panel opens.
5. Save a word.
6. Save a web.
7. Open `/wordbank` and confirm saved items appear.
8. Open the live URL on mobile and confirm the layout changes to top settings, middle graph, bottom details.
