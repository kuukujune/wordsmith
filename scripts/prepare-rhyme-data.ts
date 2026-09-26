import { dictionary } from "cmu-pronouncing-dictionary";
import { phrasePotentialCount } from "../src/lib/rhyme/phrase-templates";

const uniqueWords = new Set(Object.keys(dictionary).map((word) => word.replace(/\(\d+\)$/, "")));
if (!dictionary.light || !dictionary.night) throw new Error("CMUdict validation failed.");

console.log(`CMUdict ready: ${uniqueWords.size.toLocaleString()} words.`);
console.log(`Controlled phrase space ready: ${phrasePotentialCount.toLocaleString()} phrases.`);
console.log("Runtime indexes are created once per server process and reused across requests.");
