import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBarreToChord,
  barreCoversString,
  stringEditConflictsWithBarre,
} from "../app/chord-logic.ts";

const strings = [6, 5, 4, 3, 2, 1].map((number) => ({
  number,
  state: "open",
  fret: 1,
  finger: 1,
}));

test("a barre converts every covered open string to a fretted string", () => {
  const barre = { fret: 1, fromString: 6, toString: 1, finger: 1 };
  const chord = applyBarreToChord({ strings, barre: null }, barre);
  assert.ok(chord.strings.every((string) => string.state === "fretted"));
  assert.ok(chord.strings.every((string) => string.fret === 1));
  assert.ok(chord.strings.every((string) => string.finger === 1));
});

test("notes above the barre stay intact", () => {
  const barre = { fret: 1, fromString: 6, toString: 1, finger: 1 };
  const chord = applyBarreToChord({
    strings: strings.map((string) => string.number === 5
      ? { ...string, state: "fretted", fret: 3, finger: 3 }
      : string),
    barre: null,
  }, barre);
  assert.deepEqual(chord.strings.find((string) => string.number === 5), {
    number: 5,
    state: "fretted",
    fret: 3,
    finger: 3,
  });
});

test("opening a covered string conflicts with its barre", () => {
  const barre = { fret: 1, fromString: 6, toString: 1, finger: 1 };
  const covered = { number: 3, state: "fretted", fret: 1, finger: 1 };
  assert.equal(barreCoversString(barre, 3), true);
  assert.equal(stringEditConflictsWithBarre(covered, { state: "open" }, barre), true);
  assert.equal(stringEditConflictsWithBarre(covered, { fret: 3, finger: 3 }, barre), false);
});
