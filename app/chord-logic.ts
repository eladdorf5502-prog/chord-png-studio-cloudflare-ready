export type BarreValue = {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
};

export type BarreString = {
  number: number;
  state: "open" | "fretted" | "muted";
  fret: number;
  finger: number;
};

export function barreCoversString(barre: BarreValue | null, stringNumber: number) {
  if (!barre) return false;
  const low = Math.min(barre.fromString, barre.toString);
  const high = Math.max(barre.fromString, barre.toString);
  return stringNumber >= low && stringNumber <= high;
}

/**
 * Applies one musically consistent barre. Covered open/muted strings become
 * fretted by the barre, while notes above the barre remain individual notes.
 */
export function applyBarreToChord<
  TChord extends { strings: BarreString[]; barre: BarreValue | null },
>(chord: TChord, barre: BarreValue): TChord {
  const strings = chord.strings.map((string) => {
    if (!barreCoversString(barre, string.number)) return string;
    if (string.state === "fretted" && string.fret > barre.fret) return string;
    return {
      ...string,
      state: "fretted" as const,
      fret: barre.fret,
      finger: barre.finger,
    };
  });
  return { ...chord, barre: { ...barre }, strings };
}

export function stringEditConflictsWithBarre(
  string: BarreString,
  patch: Partial<BarreString>,
  barre: BarreValue | null,
) {
  if (!barreCoversString(barre, string.number) || !barre) return false;
  const next = { ...string, ...patch };
  if (next.state !== "fretted") return true;
  if (next.fret < barre.fret) return true;
  return next.fret === barre.fret && next.finger !== barre.finger;
}
