"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SavedWord = {
  id: string;
  word: string;
  relationType: string;
  centerWord: string;
  definition: string;
  example: string;
  savedAt: string;
};

type SavedWeb = {
  id: string;
  title: string;
  centerWord: string;
  relationType: string;
  source: string;
  nodeCount: number;
  nodes: Array<{
    id: string;
    label: string;
    strength: number;
    source?: string;
  }>;
  savedAt: string;
};

const savedWordsStorageKey = "wordsmith.savedWords";
const savedWebsStorageKey = "wordsmith.savedWebs";

function readStoredItems<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedItems = window.localStorage.getItem(key);

  if (!storedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(storedItems) as T[];
    return Array.isArray(parsedItems) ? parsedItems : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function WordBankPage() {
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() =>
    readStoredItems<SavedWord>(savedWordsStorageKey)
  );
  const [savedWebs, setSavedWebs] = useState<SavedWeb[]>(() =>
    readStoredItems<SavedWeb>(savedWebsStorageKey)
  );

  const newestSavedWords = useMemo(
    () =>
      [...savedWords].sort(
        (first, second) =>
          new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime()
      ),
    [savedWords]
  );
  const newestSavedWebs = useMemo(
    () =>
      [...savedWebs].sort(
        (first, second) =>
          new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime()
      ),
    [savedWebs]
  );

  function removeSavedWord(id: string) {
    setSavedWords((currentSavedWords) => {
      const nextSavedWords = currentSavedWords.filter(
        (savedWord) => savedWord.id !== id
      );
      window.localStorage.setItem(
        savedWordsStorageKey,
        JSON.stringify(nextSavedWords)
      );

      return nextSavedWords;
    });
  }

  function removeSavedWeb(id: string) {
    setSavedWebs((currentSavedWebs) => {
      const nextSavedWebs = currentSavedWebs.filter(
        (savedWeb) => savedWeb.id !== id
      );
      window.localStorage.setItem(
        savedWebsStorageKey,
        JSON.stringify(nextSavedWebs)
      );

      return nextSavedWebs;
    });
  }

  return (
    <main className="min-h-screen bg-[#f9f8f4] px-8 py-7 text-black">
      <header className="mx-auto flex max-w-[1320px] items-center justify-between border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-serif text-4xl leading-none tracking-wide">
            WORDSMITH
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.28em] text-neutral-500">
            WordBank
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-neutral-300 bg-white/70 px-5 py-2 text-sm font-semibold hover:bg-neutral-100"
        >
          Explore
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1320px] gap-6 py-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">
              Saved Words
            </h2>
            <p className="text-sm text-neutral-500">
              {newestSavedWords.length} saved
            </p>
          </div>

          <div className="grid gap-3">
            {newestSavedWords.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-white/70 p-5 text-neutral-600">
                No saved words yet.
              </div>
            ) : (
              newestSavedWords.map((savedWord) => (
                <article
                  key={savedWord.id}
                  className="rounded-lg border border-neutral-200 bg-white/75 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold leading-tight">
                        {savedWord.word}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {savedWord.relationType} from {savedWord.centerWord}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSavedWord(savedWord.id)}
                      className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
                    >
                      Remove
                    </button>
                  </div>

                  <p className="mt-4 text-sm text-neutral-700">
                    {savedWord.definition}
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">
                    {savedWord.example}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-widest text-neutral-400">
                    {formatSavedDate(savedWord.savedAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">
              Saved Webs
            </h2>
            <p className="text-sm text-neutral-500">
              {newestSavedWebs.length} saved
            </p>
          </div>

          <div className="grid gap-3">
            {newestSavedWebs.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-white/70 p-5 text-neutral-600">
                No saved webs yet.
              </div>
            ) : (
              newestSavedWebs.map((savedWeb) => (
                <article
                  key={savedWeb.id}
                  className="rounded-lg border border-neutral-200 bg-white/75 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold leading-tight">
                        {savedWeb.centerWord}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {savedWeb.relationType} - {savedWeb.nodeCount} nodes -{" "}
                        {savedWeb.source}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSavedWeb(savedWeb.id)}
                      className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {savedWeb.nodes.slice(0, 12).map((node) => (
                      <span
                        key={node.id}
                        className="rounded-md bg-neutral-200 px-2 py-1 text-xs"
                      >
                        {node.label}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 text-xs uppercase tracking-widest text-neutral-400">
                    {formatSavedDate(savedWeb.savedAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
