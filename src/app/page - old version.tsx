"use client";

import { useState, type FormEvent } from "react";

const relationTypes = [
  "Meaning",
  "Rhymes",
  "Sounds Like",
  "Associated Phrases",
  "Tone / Theme",
];

const samplePhrases = [
  "following the light to new places",
  "seeking what's just beyond",
  "driven by hope not by fear",
  "finding peace in the quiet dawn",
  "starting over with every sunrise",
  "welcoming the new day",
  "greeting the morning light",
  "running toward something better",
  "living for new beginnings",
  "trusting the timing of life",
  "new day, new reason to try",
  "every sunrise is a reminder",
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("chasing the sunrise");
  const [relationType, setRelationType] = useState("Meaning");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedSearchTerm = searchTerm.trim();

    if (cleanedSearchTerm === "") {
      alert("Please enter a word or phrase.");
      return;
    }

    alert(`Search: ${cleanedSearchTerm}\nRelation type: ${relationType}`);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-black">
      <header className="flex items-center justify-between border-b border-neutral-200 px-8 py-4">
        <div>
          <h1 className="font-serif text-3xl tracking-wide">WORDSMITH</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
            Explore. Connect. Express.
          </p>
        </div>

        <nav className="hidden gap-10 text-sm md:flex">
          <a className="border-b-2 border-black pb-2" href="#">
            Explore
          </a>
          <a className="text-neutral-500" href="#">
            Saved
          </a>
          <a className="text-neutral-500" href="#">
            Lists
          </a>
          <a className="text-neutral-500" href="#">
            History
          </a>
        </nav>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black font-bold text-white">
          W
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[240px_1fr_280px]">
        <aside className="hidden rounded-xl border border-neutral-200 bg-white/70 p-4 lg:block">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest">
            Relation Types
          </h2>

          <div className="space-y-2">
            {relationTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRelationType(type)}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm ${
                  relationType === type
                    ? "bg-neutral-200 font-semibold"
                    : "hover:bg-neutral-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-neutral-200 pt-4">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest">
              Filters
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-md border border-neutral-200 px-3 py-2">
                <span>Part of Speech</span>
                <span>All</span>
              </div>

              <div className="flex justify-between rounded-md border border-neutral-200 px-3 py-2">
                <span>Tone</span>
                <span>All</span>
              </div>

              <button className="w-full rounded-md border border-neutral-300 px-3 py-2">
                Reset Filters
              </button>
            </div>
          </div>
        </aside>

        <section>
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-2 shadow-sm"
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Enter a word or phrase..."
              className="min-w-0 flex-1 bg-transparent px-2 py-3 text-lg outline-none"
            />

            <button
              type="submit"
              className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Search
            </button>
          </form>

          <div className="mx-auto mt-5 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Choose an association type
            </p>

            <div className="flex flex-wrap gap-3">
              {relationTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRelationType(type)}
                  className={`rounded-lg border px-6 py-3 text-sm ${
                    relationType === type
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 bg-white hover:bg-neutral-100"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto mt-12 h-[520px] max-w-4xl">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-3xl font-bold leading-tight">
              {searchTerm || "Wordsmith"}
            </div>

            {samplePhrases.map((phrase, index) => {
              const positions = [
                "left-[8%] top-[18%]",
                "left-[25%] top-[8%]",
                "left-[2%] top-[45%]",
                "left-[18%] top-[62%]",
                "left-[28%] top-[78%]",
                "left-[48%] top-[5%]",
                "left-[50%] top-[28%]",
                "right-[15%] top-[18%]",
                "right-[5%] top-[45%]",
                "right-[15%] top-[72%]",
                "right-[28%] bottom-[5%]",
                "left-[38%] bottom-[8%]",
              ];

              return (
                <div
                  key={phrase}
                  className={`absolute max-w-[170px] text-center text-sm ${positions[index]}`}
                >
                  <div className="mx-auto mb-2 h-px w-16 bg-black" />
                  <p>{phrase}</p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="hidden rounded-xl border border-neutral-200 bg-white/70 p-5 lg:block">
          <h2 className="mb-8 text-xs font-bold uppercase tracking-widest">
            Phrase Details
          </h2>

          <h3 className="text-2xl font-bold leading-tight">
            chasing
            <br />
            the sunrise
          </h3>

          <div className="mt-6 space-y-5 text-sm">
            <div>
              <p className="mb-1 font-semibold">Relation</p>
              <span className="rounded-md bg-neutral-200 px-2 py-1 text-xs">
                Core / Center
              </span>
            </div>

            <div>
              <p className="mb-1 font-semibold">Meaning</p>
              <p className="text-neutral-700">
                Pursuing new beginnings, opportunities, or hopes as each day
                starts.
              </p>
            </div>

            <div>
              <p className="mb-1 font-semibold">Example</p>
              <p className="text-neutral-700">
                He is always chasing the sunrise, looking for the next big
                opportunity.
              </p>
            </div>

            <div>
              <p className="mb-1 font-semibold">Tone</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-neutral-200 px-2 py-1 text-xs">
                  Hopeful
                </span>
                <span className="rounded-md bg-neutral-200 px-2 py-1 text-xs">
                  Inspirational
                </span>
                <span className="rounded-md bg-neutral-200 px-2 py-1 text-xs">
                  Optimistic
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="mx-6 mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-white/70 px-6 py-4 text-sm">
        <div>
          <p className="font-bold">12 Nodes</p>
          <p className="text-neutral-500">Static Step 4 preview</p>
        </div>

        <p className="hidden text-neutral-600 md:block">
          Search, choose a relation type, then generate a word web later.
        </p>

        <button className="rounded-lg border border-neutral-300 px-5 py-2">
          Save Web
        </button>
      </footer>
    </main>
  );
}