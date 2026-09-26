import { NextResponse } from "next/server";
import { getRhymeIndexes } from "@/lib/rhyme/candidate-provider";
import { phrasePotentialCount } from "@/lib/rhyme/phrase-templates";
import { getDictionaryState } from "@/lib/rhyme/pronunciation";

export async function GET() {
  const dictionary = getDictionaryState();
  const indexes = getRhymeIndexes();
  return NextResponse.json({
    ok: true,
    dictionaryLoaded: dictionary.wordCount > 0,
    dictionaryWordCount: dictionary.wordCount,
    phraseCount: phrasePotentialCount,
    indexesReady: indexes.exactTail.size > 0,
  });
}
