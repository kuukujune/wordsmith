const vowelPattern = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)[012]?$/;
const similarGroups = [
  ["P", "B"], ["T", "D"], ["K", "G"], ["F", "V"], ["S", "Z"],
  ["SH", "ZH"], ["CH", "JH"], ["M", "N", "NG"], ["IH", "IY"],
  ["EH", "AE"], ["AH", "UH"], ["AA", "AO"], ["EY", "EH"],
  ["AY", "OY"], ["OW", "AO"],
];

export function basePhoneme(value: string) {
  return value.replace(/[012]$/, "");
}

export function isVowel(value: string) {
  return vowelPattern.test(value);
}

export function phonemeStress(value: string) {
  const match = value.match(/([012])$/);
  return match ? Number(match[1]) : undefined;
}

export function phonemeSimilarity(a: string, b: string) {
  const first = basePhoneme(a);
  const second = basePhoneme(b);
  if (first === second) return 1;
  if (similarGroups.some((group) => group.includes(first) && group.includes(second))) return 0.75;
  if (isVowel(a) === isVowel(b)) return 0.18;
  return 0;
}

export function sequenceSimilarity(first: string[], second: string[]) {
  const maxLength = Math.max(first.length, second.length);
  if (maxLength === 0) return 0;
  let score = 0;
  for (let offset = 1; offset <= maxLength; offset += 1) {
    const a = first[first.length - offset];
    const b = second[second.length - offset];
    if (!a || !b) continue;
    const weight = isVowel(a) || isVowel(b) ? 1.35 : 1;
    score += phonemeSimilarity(a, b) * weight;
  }
  const potential = Array.from({ length: maxLength }, (_, index) => {
    const a = first[first.length - 1 - index];
    const b = second[second.length - 1 - index];
    return a && b && (isVowel(a) || isVowel(b)) ? 1.35 : 1;
  }).reduce((sum, value) => sum + value, 0);
  return Math.max(0, Math.min(1, score / potential));
}
