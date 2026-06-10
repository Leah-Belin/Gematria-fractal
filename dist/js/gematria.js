// Shared computation engine — runs in both browser (ES module) and Node.js generator

export const LETTER_VALUES = {
  'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
  'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,
  'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,'ר':200,
  'ש':300,'ת':400
};

export const LETTER_NAMES = {
  'א':'אלף','ב':'בית','ג':'גימל','ד':'דלת','ה':'הה','ו':'ואו',
  'ז':'זין','ח':'חית','ט':'טית','י':'יוד','כ':'כף','ך':'כף',
  'ל':'למד','מ':'מם','ם':'מם','נ':'נון','ן':'נון','ס':'סמך',
  'ע':'עין','פ':'פה','ף':'פה','צ':'צדי','ץ':'צדי','ק':'קוף',
  'ר':'ריש','ש':'שין','ת':'תו'
};

export function stripNikud(s) {
  return s.replace(/[֑-ׇ]/g, '');
}

export function letterValue(ch) {
  return LETTER_VALUES[ch] || 0;
}

export function wordGematria(word) {
  return [...word].reduce((s, c) => s + letterValue(c), 0);
}

export function iterateLetter(ch, maxIter) {
  const val = letterValue(ch);
  if (!val) return { steps: [], cycleStart: 0, cycleLength: 0, attractor: [], escapeIter: 0 };

  let currentLetters = [ch];
  const steps = [];
  const seen = new Map();

  for (let i = 0; i < maxIter; i++) {
    const next = currentLetters.flatMap(c => {
      const name = LETTER_NAMES[c];
      if (!name) return [c];
      return [...name].filter(x => letterValue(x) > 0);
    });

    const vals = next.map(letterValue);
    const sum = vals.reduce((a, b) => a + b, 0);
    const key = vals.slice().sort((a, b) => a - b).join(',');
    steps.push({ vals, sum });

    if (seen.has(key)) {
      const cycleStart = seen.get(key);
      const cycleLength = i - cycleStart;
      return { steps, cycleStart, cycleLength, attractor: steps[cycleStart].vals, escapeIter: i };
    }
    seen.set(key, i);

    if (next.length > 64) {
      return { steps, cycleStart: i, cycleLength: 1, attractor: vals.slice(0, 8), escapeIter: i };
    }
    currentLetters = next;
  }

  return {
    steps,
    cycleStart: steps.length - 1,
    cycleLength: 0,
    attractor: steps[steps.length - 1]?.vals || [val],
    escapeIter: maxIter
  };
}

export function expandWord(word, maxIter) {
  const letters = [...word].filter(c => letterValue(c) > 0);
  const analyzed = letters.map(ch => ({
    ch,
    val: letterValue(ch),
    ...iterateLetter(ch, maxIter)
  }));
  return { word, total: wordGematria(word), letters: analyzed };
}

export function analyzeText(text, maxIter = 20) {
  const stripped = stripNikud(text);
  const tokens = stripped.split(/\s+/).filter(w => [...w].some(c => letterValue(c) > 0));
  return tokens.map(w => expandWord(w, maxIter));
}
