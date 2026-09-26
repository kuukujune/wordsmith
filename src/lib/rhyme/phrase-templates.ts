import "server-only";

export const phrasePrefixes = [
  "breaking through", "fading from plain", "chasing the stage", "staying out past",
  "waiting through", "turning toward", "running into", "falling through",
  "searching for", "drifting into", "rising with", "walking through",
  "calling from", "reaching for", "holding on through", "moving beyond",
  "lost beneath", "found within", "out beyond", "under the",
  "inside the", "across the", "after the", "before the",
  "a quiet", "the final", "another", "one last",
  "shining through", "hidden from", "caught inside", "dancing under",
  "dreaming past", "waking before", "leaving at", "returning by",
  "alone in", "together through", "far beyond", "close to",
];

export const phraseEndings = [
  "night", "nights", "sight", "light", "lights", "bright", "flight", "height",
  "rain", "pain", "train", "again", "plain", "lane", "chain", "remain",
  "blue", "true", "through", "new", "view", "you", "few", "renew",
  "fire", "desire", "higher", "wire", "choir", "inspire", "tire", "entire",
  "day", "way", "stay", "away", "gray", "play", "say", "today",
  "time", "rhyme", "climb", "chime", "prime", "sublime", "line", "sign",
  "home", "roam", "stone", "alone", "known", "tone", "grown", "unknown",
  "heart", "start", "apart", "art", "part", "depart", "restart", "chart",
  "air", "care", "there", "where", "share", "stare", "rare", "despair",
  "sea", "free", "me", "tree", "be", "key", "three", "memory",
];

export const curatedPhrases = [
  "breaking through late nights", "fading from plain sight", "chasing the stage lights",
  "staying out past midnight", "waiting beneath blue light", "running toward first light",
  "drifting through the rain", "walking through old pain", "rising to begin again",
  "turning down memory lane", "holding on to what is true", "seeing the world anew",
  "falling into ocean blue", "searching for a clearer view", "reaching for a higher fire",
  "carried by a quiet desire", "singing with the midnight choir", "climbing steadily higher",
  "finding another way", "leaving before break of day", "asking the dark to stay",
  "watching the shadows play", "coming home alone", "carving a path in stone",
  "speaking in a softer tone", "walking where the wind has blown",
];

export const phrasePotentialCount = phrasePrefixes.length * phraseEndings.length + curatedPhrases.length;
