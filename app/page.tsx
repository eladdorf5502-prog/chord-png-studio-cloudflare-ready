"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { applyBarreToChord, barreCoversString, stringEditConflictsWithBarre } from "./chord-logic";
import { calculateDiagramGeometry } from "./diagram-geometry";

type StringState = "open" | "fretted" | "muted";
type NutMode = "auto" | "show" | "hide";
type PreviewBackground = "checkerboard" | "light" | "dark" | "photo";
type PhotoDiagramPosition = { x: number; y: number };

type GuitarString = {
  number: number;
  note: string;
  state: StringState;
  fret: number;
  finger: number;
};

type Barre = {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
};

type ChordState = {
  name: string;
  showName: boolean;
  strings: GuitarString[];
  barre: Barre | null;
  startingFret: number;
  visibleFrets: 4 | 5 | 6;
  nutMode: NutMode;
};

type DesignState = {
  purple: string;
  muted: string;
  panelOpacity: number;
  markerSize: number;
  stringThickness: number;
  fretThickness: number;
  fretLabelSize: number;
  fretLabelBackground: boolean;
  fretLabelBackgroundOpacity: number;
  fretLabelOutline: boolean;
  panelColor: string;
  panelRadius: number;
  panelShadow: number;
  normalStringColor: string;
  stringOpacity: number;
  fretColor: string;
  openCircleSize: number;
  openCircleStroke: number;
  xSize: number;
  xThickness: number;
  nutThickness: number;
  fontSize: number;
  fontWeight: number;
  stringSpacing: number;
  fretSpacing: number;
  panelWidth: number;
  panelHeight: number;
  internalPadding: number;
};

const STRING_META = [
  { number: 6, note: "E" },
  { number: 5, note: "A" },
  { number: 4, note: "D" },
  { number: 3, note: "G" },
  { number: 2, note: "B" },
  { number: 1, note: "e" },
];

const DEFAULT_DESIGN: DesignState = {
  purple: "#75627A",
  muted: "#802729",
  panelOpacity: 0.52,
  markerSize: 50,
  stringThickness: 8,
  fretThickness: 7,
  fretLabelSize: 32,
  fretLabelBackground: true,
  fretLabelBackgroundOpacity: 0.68,
  fretLabelOutline: false,
  panelColor: "#484848",
  panelRadius: 28,
  panelShadow: 18,
  normalStringColor: "#C2C2C2",
  stringOpacity: 1,
  fretColor: "#7D6D61",
  openCircleSize: 20,
  openCircleStroke: 4,
  xSize: 18,
  xThickness: 5,
  nutThickness: 14,
  fontSize: 24,
  fontWeight: 700,
  stringSpacing: 110,
  fretSpacing: 215,
  panelWidth: 630,
  panelHeight: 860,
  internalPadding: 90,
};

type Shape = [StringState, number?, number?];

const PRESET_SHAPES: Record<string, Shape[]> = {
  C: [
    ["muted"], ["fretted", 3, 3], ["fretted", 2, 2],
    ["open"], ["fretted", 1, 1], ["open"],
  ],
  A: [
    ["muted"], ["open"], ["fretted", 2, 1],
    ["fretted", 2, 2], ["fretted", 2, 3], ["open"],
  ],
  Am: [
    ["muted"], ["open"], ["fretted", 2, 2],
    ["fretted", 2, 3], ["fretted", 1, 1], ["open"],
  ],
  G: [
    ["fretted", 3, 2], ["fretted", 2, 1], ["open"],
    ["open"], ["open"], ["fretted", 3, 3],
  ],
  E: [
    ["open"], ["fretted", 2, 2], ["fretted", 2, 3],
    ["fretted", 1, 1], ["open"], ["open"],
  ],
  Em: [
    ["open"], ["fretted", 2, 2], ["fretted", 2, 3],
    ["open"], ["open"], ["open"],
  ],
  D: [
    ["muted"], ["muted"], ["open"],
    ["fretted", 2, 1], ["fretted", 3, 3], ["fretted", 2, 2],
  ],
  Dm: [
    ["muted"], ["muted"], ["open"],
    ["fretted", 2, 2], ["fretted", 3, 3], ["fretted", 1, 1],
  ],
  F: [
    ["fretted", 1, 1], ["fretted", 3, 3], ["fretted", 3, 4],
    ["fretted", 2, 2], ["fretted", 1, 1], ["fretted", 1, 1],
  ],
};

function stringsFromShape(shape: Shape[]): GuitarString[] {
  return STRING_META.map((meta, index) => ({
    ...meta,
    state: shape[index][0],
    fret: shape[index][1] ?? 1,
    finger: shape[index][2] ?? 1,
  }));
}

function chordFromPreset(name: string): ChordState {
  return {
    name,
    showName: true,
    strings: stringsFromShape(PRESET_SHAPES[name]),
    barre: name === "F"
      ? { fret: 1, fromString: 6, toString: 1, finger: 1 }
      : null,
    startingFret: 1,
    visibleFrets: 4,
    nutMode: "auto",
  };
}

function blankChord(): ChordState {
  return {
    name: "",
    showName: true,
    strings: STRING_META.map((meta) => ({
      ...meta,
      state: "open" as const,
      fret: 1,
      finger: 1,
    })),
    barre: null,
    startingFret: 1,
    visibleFrets: 4,
    nutMode: "auto",
  };
}

const CHORD_STORAGE = "elad-chord-editor-v1";
const DESIGN_STORAGE = "elad-chord-design-v5";
const STANDARD_DESIGN_STORAGE = "elad-chord-standard-design-v1";
const EXPORT_STORAGE = "elad-chord-export-v1";
const PREVIEW_BACKGROUND_STORAGE = "elad-chord-preview-background-v1";
const PHOTO_DIAGRAM_POSITION_STORAGE = "elad-chord-photo-diagram-position-v1";
const PHOTO_DIAGRAM_SIZE_STORAGE = "elad-chord-photo-diagram-size-v1";
const PHOTO_SOCIAL_UI_STORAGE = "elad-chord-photo-social-ui-v1";
const DISPLAY_DEFAULTS_MIGRATION = "elad-chord-display-defaults-v1";
const FRET_LABEL_BADGE_MIGRATION = "elad-chord-fret-label-badge-v1";
const PHOTO_DIAGRAM_DEFAULT_SIZE = 68;
const PHOTO_DIAGRAM_MIN_SIZE = 28;
const PHOTO_DIAGRAM_MAX_SIZE = 96;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clampPhotoDiagramPosition(x: number, y: number, size: number): PhotoDiagramPosition {
  const xBoundary = size / 2;
  const yBoundary = size * (9 / 16) / 2;
  return {
    x: clamp(x, xBoundary, 100 - xBoundary),
    y: clamp(y, yBoundary, 100 - yBoundary),
  };
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function savedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function savedColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function restoreDesign(value: unknown): DesignState {
  const raw = recordFrom(value);
  const savedNutThickness = savedNumber(raw.nutThickness, DEFAULT_DESIGN.nutThickness, 4, 36);
  return {
    purple: savedColor(raw.purple, DEFAULT_DESIGN.purple),
    muted: savedColor(raw.muted, DEFAULT_DESIGN.muted),
    panelOpacity: savedNumber(raw.panelOpacity, DEFAULT_DESIGN.panelOpacity, 0.2, 1),
    markerSize: savedNumber(raw.markerSize, DEFAULT_DESIGN.markerSize, 28, 78),
    stringThickness: savedNumber(raw.stringThickness, DEFAULT_DESIGN.stringThickness, 2, 12),
    fretThickness: savedNumber(raw.fretThickness, DEFAULT_DESIGN.fretThickness, 1, 10),
    fretLabelSize: savedNumber(raw.fretLabelSize, DEFAULT_DESIGN.fretLabelSize, 16, 64),
    fretLabelBackground: raw.fretLabelBackground !== false,
    fretLabelBackgroundOpacity: savedNumber(raw.fretLabelBackgroundOpacity, DEFAULT_DESIGN.fretLabelBackgroundOpacity, 0.2, 0.95),
    fretLabelOutline: raw.fretLabelOutline === true,
    panelColor: savedColor(raw.panelColor, DEFAULT_DESIGN.panelColor),
    panelRadius: savedNumber(raw.panelRadius, DEFAULT_DESIGN.panelRadius, 0, 140),
    panelShadow: savedNumber(raw.panelShadow, DEFAULT_DESIGN.panelShadow, 0, 40),
    normalStringColor: savedColor(raw.normalStringColor, DEFAULT_DESIGN.normalStringColor),
    stringOpacity: savedNumber(raw.stringOpacity, DEFAULT_DESIGN.stringOpacity, 0.2, 1),
    fretColor: savedColor(raw.fretColor, DEFAULT_DESIGN.fretColor),
    openCircleSize: savedNumber(raw.openCircleSize, DEFAULT_DESIGN.openCircleSize, 10, 38),
    openCircleStroke: savedNumber(raw.openCircleStroke, DEFAULT_DESIGN.openCircleStroke, 2, 12),
    xSize: savedNumber(raw.xSize, DEFAULT_DESIGN.xSize, 8, 32),
    xThickness: savedNumber(raw.xThickness, DEFAULT_DESIGN.xThickness, 2, 12),
    nutThickness: savedNutThickness <= 4 ? DEFAULT_DESIGN.nutThickness : savedNutThickness,
    fontSize: savedNumber(raw.fontSize, DEFAULT_DESIGN.fontSize, 14, 42),
    fontWeight: Math.round(savedNumber(raw.fontWeight, DEFAULT_DESIGN.fontWeight, 400, 900) / 100) * 100,
    stringSpacing: savedNumber(raw.stringSpacing, DEFAULT_DESIGN.stringSpacing, 55, 110),
    fretSpacing: savedNumber(raw.fretSpacing, DEFAULT_DESIGN.fretSpacing, 80, 240),
    panelWidth: savedNumber(raw.panelWidth, DEFAULT_DESIGN.panelWidth, 560, 920),
    panelHeight: savedNumber(raw.panelHeight, DEFAULT_DESIGN.panelHeight, 700, 860),
    internalPadding: savedNumber(raw.internalPadding, DEFAULT_DESIGN.internalPadding, 55, 140),
  };
}

function restoreChord(value: unknown): ChordState {
  const fallback = chordFromPreset("C");
  const raw = recordFrom(value);
  const rawStrings = Array.isArray(raw.strings) ? raw.strings : [];
  const strings = STRING_META.map((meta, index) => {
    const saved = recordFrom(rawStrings.find((candidate) => recordFrom(candidate).number === meta.number) ?? rawStrings[index]);
    const fallbackString = fallback.strings[index];
    const state = saved.state === "open" || saved.state === "fretted" || saved.state === "muted"
      ? saved.state
      : fallbackString.state;
    return {
      ...meta,
      state,
      fret: Math.round(savedNumber(saved.fret, fallbackString.fret, 1, 24)),
      finger: Math.round(savedNumber(saved.finger, fallbackString.finger, 1, 4)),
    };
  });
  const rawBarre = raw.barre === null ? null : recordFrom(raw.barre);
  const barre = raw.barre === null || Object.keys(rawBarre ?? {}).length === 0
    ? null
    : {
        fret: Math.round(savedNumber(rawBarre?.fret, 1, 1, 24)),
        fromString: Math.round(savedNumber(rawBarre?.fromString, 6, 1, 6)),
        toString: Math.round(savedNumber(rawBarre?.toString, 1, 1, 6)),
        finger: Math.round(savedNumber(rawBarre?.finger, 1, 1, 4)),
      };
  const visibleFretsValue = Number(raw.visibleFrets);
  const visibleFrets: 4 | 5 | 6 = visibleFretsValue === 5 ? 5 : visibleFretsValue === 6 ? 6 : 4;
  const nutMode: NutMode = raw.nutMode === "show" || raw.nutMode === "hide" ? raw.nutMode : "auto";

  const restored: ChordState = {
    name: typeof raw.name === "string" ? raw.name.slice(0, 18) : fallback.name,
    showName: typeof raw.showName === "boolean" ? raw.showName : fallback.showName,
    strings,
    barre,
    startingFret: Math.round(savedNumber(raw.startingFret, fallback.startingFret, 1, 20)),
    visibleFrets,
    nutMode,
  };
  return barre ? applyBarreToChord(restored, barre) : restored;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const inputId = useId();
  return (
    <label className="range-field" htmlFor={inputId}>
      <span className="range-label">{label}<output htmlFor={inputId}>{value}{suffix}</output></span>
      <input
        id={inputId}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChordDiagram({
  chord,
  design,
  onCellToggle,
  onSymbolToggle,
  onBarreCreate,
  onBarreRemove,
}: {
  chord: ChordState;
  design: DesignState;
  onCellToggle: (stringNumber: number, fret: number) => void;
  onSymbolToggle: (stringNumber: number) => void;
  onBarreCreate: (barre: Barre) => void;
  onBarreRemove: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [barreDrag, setBarreDrag] = useState<{
    fret: number;
    startString: number;
    currentString: number;
  } | null>(null);
  const chordNameFontSize = Math.min(design.fontSize * 1.9, 72);
  // SVG text uses a baseline, so its visible height extends both above and
  // below the y coordinate. Reserve that full height plus breathing room.
  const nameTopReserve = chord.showName
    ? Math.ceil(20 + chordNameFontSize * 1.02)
    : 0;
  const {
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    gridLeft,
    gridTop,
    gridBottom,
    effectiveStringSpacing,
    effectiveFretSpacing,
    fretLabelX,
    effectiveFretLabelSize,
    fretLabelPlacement,
    symbolY,
  } = calculateDiagramGeometry(design, chord.visibleFrets, nameTopReserve);
  const fingerFontSize = Math.min(design.fontSize, design.markerSize * 0.58);
  const symbolExtent = Math.max(
    design.openCircleSize + design.openCircleStroke / 2,
    design.xSize + design.xThickness / 2,
  );
  const minimumNameBaseline = 8 + chordNameFontSize * 0.82;
  const maximumNameBaseline = symbolY - symbolExtent - 12 - chordNameFontSize * 0.2;
  const chordNameY = Math.max(minimumNameBaseline, maximumNameBaseline);
  const showNut = chord.nutMode === "show" || (chord.nutMode === "auto" && chord.startingFret === 1);
  const nutHeight = design.nutThickness <= 4 ? DEFAULT_DESIGN.nutThickness : design.nutThickness;
  const nutX = panelX;
  const nutY = panelY - nutHeight * 0.45;
  const nutWidth = panelWidth;
  const nutRadius = Math.min(4, nutHeight * 0.28);
  const safePanelRadius = Math.min(design.panelRadius, panelWidth / 2, panelHeight / 2);
  const panelRight = panelX + panelWidth;
  const panelBottom = panelY + panelHeight;
  const panelPath = showNut
    ? `M ${panelX} ${panelY} H ${panelRight} V ${panelBottom - safePanelRadius} Q ${panelRight} ${panelBottom} ${panelRight - safePanelRadius} ${panelBottom} H ${panelX + safePanelRadius} Q ${panelX} ${panelBottom} ${panelX} ${panelBottom - safePanelRadius} V ${panelY} Z`
    : `M ${panelX + safePanelRadius} ${panelY} H ${panelRight - safePanelRadius} Q ${panelRight} ${panelY} ${panelRight} ${panelY + safePanelRadius} V ${panelBottom - safePanelRadius} Q ${panelRight} ${panelBottom} ${panelRight - safePanelRadius} ${panelBottom} H ${panelX + safePanelRadius} Q ${panelX} ${panelBottom} ${panelX} ${panelBottom - safePanelRadius} V ${panelY + safePanelRadius} Q ${panelX} ${panelY} ${panelX + safePanelRadius} ${panelY} Z`;
  const fretEdgeInset = (design.fretThickness + 4) / 2;
  const fretLeft = panelX + fretEdgeInset;
  const fretRight = panelX + panelWidth - fretEdgeInset;
  const xForString = (stringNumber: number) => gridLeft + (6 - stringNumber) * effectiveStringSpacing;
  const yForFret = (fret: number) => gridTop + (fret - chord.startingFret + 0.5) * effectiveFretSpacing;
  const isVisibleFret = (fret: number) => fret >= chord.startingFret && fret < chord.startingFret + chord.visibleFrets;
  const isCoveredByBarre = (string: GuitarString) => {
    if (!chord.barre || string.state !== "fretted") return false;
    return barreCoversString(chord.barre, string.number) && string.fret === chord.barre.fret && string.finger === chord.barre.finger;
  };
  const stringFromPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return 6;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const localPoint = point.matrixTransform(matrix.inverse());
    const stringIndex = clamp(Math.round((localPoint.x - gridLeft) / effectiveStringSpacing), 0, 5);
    return 6 - stringIndex;
  };

  return (
    <svg
      ref={svgRef}
      id="chord-diagram"
      className="chord-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width="1000"
      height="1000"
      role="img"
      aria-label={`${chord.name || "Custom"} guitar chord diagram`}
    >
      <defs>
        <filter id="panel-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy={Math.max(4, design.panelShadow * 0.82)} stdDeviation={design.panelShadow} floodColor="#000000" floodOpacity="0.42" />
        </filter>
        <filter id="fine-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2.5" stdDeviation="2.2" floodColor="#3C343E" floodOpacity="0.24" />
        </filter>
        <filter id="marker-shadow" x="-35%" y="-35%" width="170%" height="180%">
          <feDropShadow dx="1" dy="5" stdDeviation="4.5" floodColor="#332C37" floodOpacity="0.26" />
        </filter>
        <filter id="nut-shadow" x="-5%" y="-50%" width="110%" height="220%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#111111" floodOpacity="0.2" />
        </filter>
        <linearGradient id="panel-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="marker-sheen" cx="33%" cy="22%" r="82%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="0.68" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#241E27" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      <path
        d={panelPath}
        fill={design.panelColor}
        fillOpacity={design.panelOpacity}
        filter={design.panelShadow > 0 ? "url(#panel-shadow)" : undefined}
      />
      <path
        d={panelPath}
        fill="url(#panel-sheen)"
        fillOpacity={design.panelOpacity}
        stroke="#111111"
        strokeOpacity="0.18"
        strokeWidth="2"
      />

      {chord.showName && (
        <text
          x={panelX + panelWidth / 2}
          y={chordNameY}
          textAnchor="middle"
          fill="#E2E2E2"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={chordNameFontSize}
          fontWeight={design.fontWeight}
        >
          {chord.name || "Custom"}
        </text>
      )}

      {Array.from({ length: Math.max(0, chord.visibleFrets - 1) }, (_, fretIndex) => {
        const index = fretIndex + 1;
        const y = gridTop + index * effectiveFretSpacing;
        return (
          <g key={`fret-${index}`}>
            <line
              x1={fretLeft + 1}
              y1={y + 6}
              x2={fretRight + 1}
              y2={y + 3}
              stroke="#000000"
              strokeOpacity="0.4"
              strokeWidth={design.fretThickness + 4}
              strokeLinecap="round"
            />
            <line
              x1={fretLeft}
              y1={y}
              x2={fretRight}
              y2={y}
              stroke={design.fretColor}
              strokeWidth={design.fretThickness}
              strokeLinecap="round"
            />
            <line
              x1={fretLeft + 1}
              y1={y - 1}
              x2={fretRight - 1}
              y2={y - 1}
              stroke="#A39489"
              strokeOpacity="0.22"
              strokeWidth={Math.max(1, design.fretThickness * 0.2)}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {showNut && (
        <g data-element="nut">
          <rect
            x={nutX}
            y={nutY}
            width={nutWidth}
            height={nutHeight}
            rx={nutRadius}
            fill="#F8F7F8"
            stroke="#D8D6D8"
            strokeOpacity="0.58"
            strokeWidth="1"
            filter="url(#nut-shadow)"
          />
        </g>
      )}

      {chord.strings.map((string) => {
        const x = xForString(string.number);
        const shadowWidth = string.state === "muted" ? design.stringThickness * 1.9 : design.stringThickness + 4;
        const mainWidth = string.state === "muted" ? design.stringThickness * 1.7 : design.stringThickness;
        const shadowTop = showNut ? nutY : gridTop;
        const mainTop = showNut ? nutY : gridTop;
        const stringLineCap = showNut ? "butt" : "round";
        return (
          <g key={`string-${string.number}`}>
            <line
              x1={x + (string.state === "muted" ? 6 : 4)}
              y1={shadowTop}
              x2={x + (string.state === "muted" ? 6 : 4)}
              y2={gridBottom}
              stroke="#000000"
              strokeOpacity="0.34"
              strokeWidth={shadowWidth}
              strokeLinecap={stringLineCap}
            />
            <line
              x1={x}
              y1={mainTop}
              x2={x}
              y2={gridBottom}
              stroke={string.state === "muted" ? design.muted : design.normalStringColor}
              strokeOpacity={string.state === "muted" ? 0.9 : design.stringOpacity}
              strokeWidth={mainWidth}
              strokeLinecap={stringLineCap}
            />
          </g>
        );
      })}

      <g data-fret-label-placement={fretLabelPlacement}>
        {Array.from({ length: chord.visibleFrets }, (_, index) => {
          const fret = chord.startingFret + index;
          const label = index === 0 ? `${fret} Fr` : String(fret);
          const labelY = gridTop + (index + 0.5) * effectiveFretSpacing;
          const badgeRightPadding = effectiveFretLabelSize * 0.38;
          const badgeWidth = effectiveFretLabelSize * (label.length * 0.55 + 0.76);
          const badgeHeight = effectiveFretLabelSize * 1.5;
          return (
            <g key={`label-${fret}`} data-element="fret-label">
              {design.fretLabelBackground && (
                <rect
                  data-element="fret-label-badge"
                  x={fretLabelX + badgeRightPadding - badgeWidth}
                  y={labelY - badgeHeight / 2}
                  width={badgeWidth}
                  height={badgeHeight}
                  rx={badgeHeight / 2}
                  fill="#171419"
                  fillOpacity={design.fretLabelBackgroundOpacity}
                  stroke="#FFFFFF"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                  filter="url(#fine-shadow)"
                />
              )}
              <text
                x={fretLabelX}
                y={labelY}
                dominantBaseline="middle"
                textAnchor="end"
                fill="#FFFFFF"
                stroke={design.fretLabelOutline ? "#111111" : "none"}
                strokeWidth={design.fretLabelOutline ? Math.max(2, effectiveFretLabelSize * 0.12) : 0}
                strokeLinejoin="round"
                paintOrder="stroke"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize={effectiveFretLabelSize}
                fontWeight="800"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>

      {chord.strings.map((string) => {
        const x = xForString(string.number);
        const pressedByBarre = chord.barre
          && barreCoversString(chord.barre, string.number)
          && (string.state !== "fretted" || string.fret <= chord.barre.fret);
        if (pressedByBarre) return null;
        if (string.state === "open") {
          return <circle key={`symbol-${string.number}`} cx={x} cy={symbolY} r={design.openCircleSize} fill="none" stroke={design.normalStringColor} strokeWidth={design.openCircleStroke} filter="url(#fine-shadow)" />;
        }
        if (string.state === "muted") {
          return (
            <g key={`symbol-${string.number}`} stroke={design.normalStringColor} strokeWidth={design.xThickness} strokeLinecap="round" filter="url(#fine-shadow)">
              <line x1={x - design.xSize} y1={symbolY - design.xSize} x2={x + design.xSize} y2={symbolY + design.xSize} />
              <line x1={x + design.xSize} y1={symbolY - design.xSize} x2={x - design.xSize} y2={symbolY + design.xSize} />
            </g>
          );
        }
        if (!isVisibleFret(string.fret) || isCoveredByBarre(string)) return null;
        return (
          <g key={`symbol-${string.number}`}>
            <circle cx={x} cy={yForFret(string.fret)} r={design.markerSize / 2} fill={design.purple} filter="url(#marker-shadow)" />
            <circle cx={x} cy={yForFret(string.fret)} r={design.markerSize / 2} fill="url(#marker-sheen)" />
            <text
              x={x}
              y={yForFret(string.fret)}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={fingerFontSize}
              fontWeight={design.fontWeight}
            >
              {string.finger}
            </text>
          </g>
        );
      })}

      {Array.from({ length: chord.visibleFrets }, (_, fretIndex) => {
        const fret = chord.startingFret + fretIndex;
        return chord.strings.map((string) => {
          const x = xForString(string.number);
          const y = gridTop + fretIndex * effectiveFretSpacing;
          const isActive = string.state === "fretted" && string.fret === fret;
          const activate = () => onCellToggle(string.number, fret);
          return (
            <g key={`hit-${string.number}-${fret}`} className={isActive ? "interactive-cell active" : "interactive-cell"}>
              <circle
                className="cell-hover"
                cx={x}
                cy={y + effectiveFretSpacing / 2}
                r={design.markerSize / 2 + 7}
                fill="none"
                stroke={isActive ? design.muted : design.purple}
                strokeWidth="4"
                strokeDasharray={isActive ? "7 6" : "5 7"}
                opacity="0"
                pointerEvents="none"
              />
              <rect
                x={x - effectiveStringSpacing / 2}
                y={y}
                width={effectiveStringSpacing}
                height={effectiveFretSpacing}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={isActive ? `Remove note from string ${string.number}, fret ${fret}; drag to create barre` : `Add note to string ${string.number}, fret ${fret}; drag to create barre`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setBarreDrag({ fret, startString: string.number, currentString: string.number });
                }}
                onPointerMove={(event) => {
                  if (!barreDrag || barreDrag.fret !== fret) return;
                  const currentString = stringFromPointer(event);
                  if (currentString !== barreDrag.currentString) {
                    setBarreDrag((current) => current ? { ...current, currentString } : current);
                  }
                }}
                onPointerUp={(event) => {
                  if (!barreDrag || barreDrag.fret !== fret) return;
                  const currentString = stringFromPointer(event);
                  if (currentString === barreDrag.startString) {
                    activate();
                  } else {
                    onBarreCreate({
                      fret: barreDrag.fret,
                      fromString: barreDrag.startString,
                      toString: currentString,
                      finger: 1,
                    });
                  }
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  setBarreDrag(null);
                }}
                onPointerCancel={() => setBarreDrag(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                  }
                }}
              />
            </g>
          );
        });
      })}

      {barreDrag && barreDrag.currentString !== barreDrag.startString && (() => {
        const x1 = xForString(barreDrag.startString);
        const x2 = xForString(barreDrag.currentString);
        const y = yForFret(barreDrag.fret);
        return (
          <g className="drag-preview" pointerEvents="none">
            <line x1={x1 + 1} y1={y + 6} x2={x2 + 1} y2={y + 6} stroke="#000000" strokeOpacity="0.34" strokeWidth={design.markerSize + 2} strokeLinecap="round" />
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={design.purple} strokeOpacity="0.82" strokeWidth={design.markerSize} strokeLinecap="round" strokeDasharray="10 7" />
            <text x={(x1 + x2) / 2} y={y} dominantBaseline="middle" textAnchor="middle" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontSize={fingerFontSize} fontWeight={design.fontWeight}>1</text>
          </g>
        );
      })()}

      {chord.strings.map((string) => {
        if (string.state === "fretted" || barreCoversString(chord.barre, string.number)) return null;
        const x = xForString(string.number);
        const activate = () => onSymbolToggle(string.number);
        return (
          <circle
            key={`symbol-hit-${string.number}`}
            className="diagram-symbol-hit"
            cx={x}
            cy={symbolY}
            r={Math.max(design.openCircleSize, design.xSize) + 14}
            fill="transparent"
            stroke="transparent"
            role="button"
            tabIndex={0}
            aria-label={string.state === "open" ? `Mute string ${string.number}` : `Open string ${string.number}`}
            onClick={activate}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }}
          />
        );
      })}

      {chord.barre && isVisibleFret(chord.barre.fret) && (() => {
        const x1 = xForString(chord.barre.fromString);
        const x2 = xForString(chord.barre.toString);
        const y = yForFret(chord.barre.fret);
        return (
          <g
            className="interactive-barre"
            role="button"
            tabIndex={0}
            aria-label={`Remove barre at fret ${chord.barre.fret}`}
            onClick={onBarreRemove}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onBarreRemove();
              }
            }}
          >
            <line x1={x1 + 1} y1={y + 6} x2={x2 + 1} y2={y + 6} stroke="#332C37" strokeOpacity="0.25" strokeWidth={design.markerSize + 1} strokeLinecap="round" />
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={design.purple} strokeWidth={design.markerSize} strokeLinecap="round" />
            <line x1={x1} y1={y - 2} x2={x2} y2={y - 2} stroke="#FFFFFF" strokeOpacity="0.09" strokeWidth={Math.max(1, design.markerSize - 7)} strokeLinecap="round" />
            <text
              x={(x1 + x2) / 2}
              y={y}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={fingerFontSize}
              fontWeight={design.fontWeight}
            >
              {chord.barre.finger}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

export default function Home() {
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const photoDiagramDrag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    position: PhotoDiagramPosition;
  } | null>(null);
  const [chord, setChord] = useState<ChordState>(() => chordFromPreset("C"));
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [resolution, setResolution] = useState(2048);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>("dark");
  const [photoDiagramPosition, setPhotoDiagramPosition] = useState<PhotoDiagramPosition>({ x: 50, y: 50 });
  const [photoDiagramSize, setPhotoDiagramSize] = useState(PHOTO_DIAGRAM_DEFAULT_SIZE);
  const [showPhotoSocialUi, setShowPhotoSocialUi] = useState(true);
  const [movePhotoDiagram, setMovePhotoDiagram] = useState(false);
  const [photoDiagramDragging, setPhotoDiagramDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const savedChord = localStorage.getItem(CHORD_STORAGE);
        const savedDesign = localStorage.getItem(DESIGN_STORAGE);
        const savedStandardDesign = localStorage.getItem(STANDARD_DESIGN_STORAGE);
        const savedExport = localStorage.getItem(EXPORT_STORAGE);
        const savedPreviewBackground = localStorage.getItem(PREVIEW_BACKGROUND_STORAGE);
        const savedPhotoDiagramPosition = localStorage.getItem(PHOTO_DIAGRAM_POSITION_STORAGE);
        const savedPhotoDiagramSize = localStorage.getItem(PHOTO_DIAGRAM_SIZE_STORAGE);
        const savedPhotoSocialUi = localStorage.getItem(PHOTO_SOCIAL_UI_STORAGE);
        const displayDefaultsMigrated = localStorage.getItem(DISPLAY_DEFAULTS_MIGRATION) === "1";
        const fretLabelBadgeMigrated = localStorage.getItem(FRET_LABEL_BADGE_MIGRATION) === "1";
        if (savedChord) {
          const restoredChord = restoreChord(JSON.parse(savedChord));
          setChord(displayDefaultsMigrated ? restoredChord : { ...restoredChord, showName: true });
        }
        let currentDesign = DEFAULT_DESIGN;
        if (savedDesign) {
          const restoredDesign = restoreDesign(JSON.parse(savedDesign));
          const displayReadyDesign = displayDefaultsMigrated
            ? restoredDesign
            : { ...restoredDesign, fretLabelSize: Math.max(restoredDesign.fretLabelSize, DEFAULT_DESIGN.fretLabelSize) };
          currentDesign = fretLabelBadgeMigrated
            ? displayReadyDesign
            : { ...displayReadyDesign, fretLabelSize: Math.max(displayReadyDesign.fretLabelSize, 32), fretLabelBackground: true };
          setDesign(currentDesign);
        } else if (savedStandardDesign) {
          currentDesign = restoreDesign(JSON.parse(savedStandardDesign));
          setDesign(currentDesign);
        }
        if (!savedStandardDesign) {
          localStorage.setItem(STANDARD_DESIGN_STORAGE, JSON.stringify(currentDesign));
        }
        localStorage.setItem(DISPLAY_DEFAULTS_MIGRATION, "1");
        localStorage.setItem(FRET_LABEL_BADGE_MIGRATION, "1");
        const parsedResolution = Number(savedExport);
        if (parsedResolution === 1024 || parsedResolution === 2048 || parsedResolution === 4096) {
          setResolution(parsedResolution);
        }
        if (savedPreviewBackground === "checkerboard" || savedPreviewBackground === "light" || savedPreviewBackground === "dark" || savedPreviewBackground === "photo") {
          setPreviewBackground(savedPreviewBackground);
        }
        const restoredPhotoDiagramSize = savedPhotoDiagramSize === null
          ? PHOTO_DIAGRAM_DEFAULT_SIZE
          : savedNumber(savedPhotoDiagramSize, PHOTO_DIAGRAM_DEFAULT_SIZE, PHOTO_DIAGRAM_MIN_SIZE, PHOTO_DIAGRAM_MAX_SIZE);
        setPhotoDiagramSize(restoredPhotoDiagramSize);
        if (savedPhotoSocialUi === "0" || savedPhotoSocialUi === "1") {
          setShowPhotoSocialUi(savedPhotoSocialUi === "1");
        }
        if (savedPhotoDiagramPosition) {
          const restoredPosition = recordFrom(JSON.parse(savedPhotoDiagramPosition));
          setPhotoDiagramPosition(clampPhotoDiagramPosition(
            savedNumber(restoredPosition.x, 50, 0, 100),
            savedNumber(restoredPosition.y, 50, 0, 100),
            restoredPhotoDiagramSize,
          ));
        }
      } catch {
        // Corrupt local settings should never prevent the editor from opening.
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CHORD_STORAGE, JSON.stringify(chord));
  }, [chord, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DESIGN_STORAGE, JSON.stringify(design));
  }, [design, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(EXPORT_STORAGE, String(resolution));
  }, [resolution, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREVIEW_BACKGROUND_STORAGE, previewBackground);
  }, [previewBackground, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PHOTO_DIAGRAM_POSITION_STORAGE, JSON.stringify(photoDiagramPosition));
  }, [photoDiagramPosition, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PHOTO_DIAGRAM_SIZE_STORAGE, String(photoDiagramSize));
  }, [photoDiagramSize, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PHOTO_SOCIAL_UI_STORAGE, showPhotoSocialUi ? "1" : "0");
  }, [showPhotoSocialUi, hydrated]);

  const activePreset = useMemo(() => Object.keys(PRESET_SHAPES).find((name) => chord.name === name), [chord.name]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const updateString = (number: number, patch: Partial<GuitarString>) => {
    setChord((current) => {
      const editedString = current.strings.find((string) => string.number === number);
      const removeBarre = editedString
        ? stringEditConflictsWithBarre(editedString, patch, current.barre)
        : false;
      return {
        ...current,
        barre: removeBarre ? null : current.barre,
        strings: current.strings.map((string) => string.number === number ? { ...string, ...patch } : string),
      };
    });
  };

  const toggleDiagramCell = (stringNumber: number, fret: number) => {
    setChord((current) => {
      let removeBarre = false;
      const strings = current.strings.map((string) => {
        if (string.number !== stringNumber) return string;
        if (string.state === "fretted" && string.fret === fret) {
          removeBarre = stringEditConflictsWithBarre(string, { state: "open" }, current.barre);
          return { ...string, state: "open" };
        }
        const next = {
          ...string,
          state: "fretted" as const,
          fret,
          finger: string.state === "fretted" ? string.finger : 1,
        };
        removeBarre = stringEditConflictsWithBarre(string, next, current.barre);
        return next;
      });
      return { ...current, strings, barre: removeBarre ? null : current.barre };
    });
  };

  const toggleDiagramSymbol = (stringNumber: number) => {
    setChord((current) => {
      const editedString = current.strings.find((string) => string.number === stringNumber);
      const nextState = editedString?.state === "open" ? "muted" : "open";
      const removeBarre = editedString
        ? stringEditConflictsWithBarre(editedString, { state: nextState }, current.barre)
        : false;
      return {
        ...current,
        barre: removeBarre ? null : current.barre,
        strings: current.strings.map((string) => string.number === stringNumber
          ? { ...string, state: nextState }
          : string),
      };
    });
  };

  const createDiagramBarre = (barre: Barre) => {
    setChord((current) => applyBarreToChord(current, barre));
  };

  const updateBarre = (barre: Barre) => {
    setChord((current) => applyBarreToChord(current, barre));
  };

  const updateDesign = <K extends keyof DesignState>(key: K, value: DesignState[K]) => {
    setDesign((current) => ({ ...current, [key]: value }));
  };

  const saveDesignAsStandard = () => {
    const serializedDesign = JSON.stringify(design);
    localStorage.setItem(STANDARD_DESIGN_STORAGE, serializedDesign);
    localStorage.setItem(DESIGN_STORAGE, serializedDesign);
    flash("Current design saved as standard");
  };

  const resetToStandardDesign = () => {
    try {
      const savedStandardDesign = localStorage.getItem(STANDARD_DESIGN_STORAGE);
      const standardDesign = savedStandardDesign
        ? restoreDesign(JSON.parse(savedStandardDesign))
        : DEFAULT_DESIGN;
      setDesign(standardDesign);
      localStorage.setItem(DESIGN_STORAGE, JSON.stringify(standardDesign));
      flash("Saved standard restored");
    } catch {
      setDesign(DEFAULT_DESIGN);
      localStorage.setItem(DESIGN_STORAGE, JSON.stringify(DEFAULT_DESIGN));
      flash("Factory design restored");
    }
  };

  const beginPhotoDiagramDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!movePhotoDiagram || previewBackground !== "photo") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    photoDiagramDrag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position: photoDiagramPosition,
    };
    setPhotoDiagramDragging(true);
  };

  const movePhotoDiagramDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = photoDiagramDrag.current;
    const stage = previewStageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    const bounds = stage.getBoundingClientRect();
    setPhotoDiagramPosition(clampPhotoDiagramPosition(
      drag.position.x + ((event.clientX - drag.clientX) / bounds.width) * 100,
      drag.position.y + ((event.clientY - drag.clientY) / bounds.height) * 100,
      photoDiagramSize,
    ));
  };

  const endPhotoDiagramDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (photoDiagramDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    photoDiagramDrag.current = null;
    setPhotoDiagramDragging(false);
  };

  const exportPng = () => {
    const svg = document.getElementById("chord-diagram") as SVGSVGElement | null;
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = resolution;
      canvas.height = resolution;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, resolution, resolution);
      context.drawImage(image, 0, 0, resolution, resolution);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const downloadUrl = URL.createObjectURL(pngBlob);
        const anchor = document.createElement("a");
        const safeName = (chord.name || "custom-chord").trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "custom-chord";
        anchor.href = downloadUrl;
        anchor.download = `${safeName}-${resolution}.png`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        flash(`${resolution} × ${resolution} PNG exported`);
      }, "image/png");
    };
    image.src = objectUrl;
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="eyebrow">Personal chord utility</div>
          <h1>Chord PNG Studio</h1>
          <p>Choose a chord, tune the details, export a perfectly consistent PNG.</p>
        </div>
        <div className="header-actions">
          <span className="preset-pill"><span /> Elad Default</span>
          <button type="button" className="secondary-button" onClick={() => setChord(blankChord())}>New Chord</button>
        </div>
      </header>

      <div className="workspace">
        <div className="controls-column">
          <section className="control-card">
            <div className="section-heading">
              <div><span className="step-number">01</span><h2>Chord Presets</h2></div>
              <span className="section-hint">One-click starting points</span>
            </div>
            <div className="preset-grid">
              {Object.keys(PRESET_SHAPES).map((name) => (
                <button
                  type="button"
                  key={name}
                  className={activePreset === name ? "preset-button active" : "preset-button"}
                  onClick={() => setChord(chordFromPreset(name))}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="name-row">
              <label className="text-field">
                <span>Chord Name</span>
                <input type="text" value={chord.name} placeholder="Custom" maxLength={18} onChange={(event) => setChord((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="switch-field">
                <span>Show Name</span>
                <input type="checkbox" checked={chord.showName} onChange={(event) => setChord((current) => ({ ...current, showName: event.target.checked }))} />
                <i aria-hidden="true" />
              </label>
            </div>
          </section>

          <section className="control-card">
            <div className="section-heading">
              <div><span className="step-number">02</span><h2>String Editor</h2></div>
              <span className="section-hint">6 → 1, left to right</span>
            </div>
            <div className="string-list">
              {chord.strings.map((string) => (
                <div className="string-row" key={string.number}>
                  <div className="string-identity">
                    <strong>{string.number}</strong><span>{string.note}</span>
                  </div>
                  <Segmented
                    label={`String ${string.number} state`}
                    value={string.state}
                    options={[
                      { value: "open", label: "Open" },
                      { value: "fretted", label: "Fretted" },
                      { value: "muted", label: "Muted" },
                    ]}
                    onChange={(state) => updateString(string.number, { state })}
                  />
                  {string.state === "fretted" ? (
                    <div className="fretted-controls">
                      <label className="mini-number"><span>Fret</span><input type="number" min="1" max="24" value={string.fret} onChange={(event) => updateString(string.number, { fret: clamp(Number(event.target.value), 1, 24) })} /></label>
                      <div className="finger-picker" role="group" aria-label={`String ${string.number} finger`}>
                        <span>Finger</span>
                        {[1, 2, 3, 4].map((finger) => <button type="button" key={finger} className={string.finger === finger ? "active" : ""} onClick={() => updateString(string.number, { finger })}>{finger}</button>)}
                      </div>
                    </div>
                  ) : <div className="string-state-note">{string.state === "open" ? "Rings open" : "Not played"}</div>}
                </div>
              ))}
            </div>
          </section>

          <section className="control-card">
            <div className="section-heading">
              <div><span className="step-number">03</span><h2>Barre</h2></div>
              <span className="section-hint">One barre supported</span>
            </div>
            {!chord.barre ? (
              <button type="button" className="add-button" onClick={() => updateBarre({ fret: 1, fromString: 6, toString: 1, finger: 1 })}>+ Add Barre</button>
            ) : (
              <div className="barre-editor">
                <NumberField label="Fret" value={chord.barre.fret} min={1} max={24} onChange={(value) => chord.barre && updateBarre({ ...chord.barre, fret: value })} />
                <label className="field"><span>From String</span><select value={chord.barre.fromString} onChange={(event) => chord.barre && updateBarre({ ...chord.barre, fromString: Number(event.target.value) })}>{[6,5,4,3,2,1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label className="field"><span>To String</span><select value={chord.barre.toString} onChange={(event) => chord.barre && updateBarre({ ...chord.barre, toString: Number(event.target.value) })}>{[6,5,4,3,2,1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label className="field"><span>Finger</span><select value={chord.barre.finger} onChange={(event) => chord.barre && updateBarre({ ...chord.barre, finger: Number(event.target.value) })}>{[1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <button type="button" className="remove-button" aria-label="Remove barre" onClick={() => setChord((current) => ({ ...current, barre: null }))}>Remove</button>
              </div>
            )}
            <div className="divider" />
            <div className="subheading-row"><h3>Neck position</h3><span>Nut is automatic by default</span></div>
            <div className="neck-grid">
              <NumberField label="Starting Fret" value={chord.startingFret} min={1} max={20} onChange={(startingFret) => setChord((current) => ({ ...current, startingFret }))} />
              <div className="labeled-control"><span>Visible Frets</span><Segmented label="Visible frets" value={chord.visibleFrets} options={[4,5,6].map((value) => ({ value: value as 4|5|6, label: String(value) }))} onChange={(visibleFrets) => setChord((current) => ({ ...current, visibleFrets }))} /></div>
              <div className="labeled-control nut-control"><span>Nut</span><Segmented label="Nut visibility" value={chord.nutMode} options={[{value:"auto",label:"Auto"},{value:"show",label:"Show"},{value:"hide",label:"Hide"}]} onChange={(nutMode) => setChord((current) => ({ ...current, nutMode }))} /></div>
            </div>
          </section>

          <section className="control-card">
            <div className="section-heading">
              <div><span className="step-number">04</span><h2>Design</h2></div>
              <span className="section-hint">Everyday controls</span>
            </div>
            <div className="color-row">
              <label className="color-field"><span>Purple Color</span><span className="color-input"><input type="color" value={design.purple} onChange={(event) => updateDesign("purple", event.target.value)} /><b>{design.purple.toUpperCase()}</b></span></label>
              <label className="color-field"><span>Muted Color</span><span className="color-input"><input type="color" value={design.muted} onChange={(event) => updateDesign("muted", event.target.value)} /><b>{design.muted.toUpperCase()}</b></span></label>
            </div>
            <div className="range-grid">
              <RangeField label="Panel Opacity" value={Math.round(design.panelOpacity * 100)} min={20} max={100} suffix="%" onChange={(value) => updateDesign("panelOpacity", value / 100)} />
              <RangeField label="Marker Size" value={design.markerSize} min={28} max={78} onChange={(value) => updateDesign("markerSize", value)} />
              <RangeField label="String Thickness" value={design.stringThickness} min={2} max={12} onChange={(value) => updateDesign("stringThickness", value)} />
              <RangeField label="Fret Thickness" value={design.fretThickness} min={1} max={10} onChange={(value) => updateDesign("fretThickness", value)} />
              <RangeField label="Fret Number Size" value={design.fretLabelSize} min={16} max={64} onChange={(value) => updateDesign("fretLabelSize", value)} />
              <RangeField label="Fret Badge Opacity" value={Math.round(design.fretLabelBackgroundOpacity * 100)} min={20} max={95} suffix="%" onChange={(value) => updateDesign("fretLabelBackgroundOpacity", value / 100)} />
            </div>
            <div className="design-switches">
              <label className="switch-field design-switch">
                <span>Dark Fret Number Badge</span>
                <input type="checkbox" checked={design.fretLabelBackground} onChange={(event) => updateDesign("fretLabelBackground", event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <label className="switch-field design-switch">
                <span>Black Fret Number Outline</span>
                <input type="checkbox" checked={design.fretLabelOutline} onChange={(event) => updateDesign("fretLabelOutline", event.target.checked)} />
                <i aria-hidden="true" />
              </label>
            </div>
            <div className="design-actions">
              <button type="button" className="primary-quiet" onClick={saveDesignAsStandard}>Save as Standard</button>
              <button type="button" className="text-button" onClick={resetToStandardDesign}>Reset to Standard</button>
            </div>
          </section>

          <details className="control-card advanced-card">
            <summary><span><span className="step-number">05</span><strong>Advanced Design</strong></span><i aria-hidden="true">+</i></summary>
            <div className="advanced-content">
              <div className="color-row three-colors">
                <label className="color-field"><span>Panel Color</span><span className="color-input"><input type="color" value={design.panelColor} onChange={(event) => updateDesign("panelColor", event.target.value)} /><b>{design.panelColor.toUpperCase()}</b></span></label>
                <label className="color-field"><span>String Color</span><span className="color-input"><input type="color" value={design.normalStringColor} onChange={(event) => updateDesign("normalStringColor", event.target.value)} /><b>{design.normalStringColor.toUpperCase()}</b></span></label>
                <label className="color-field"><span>Fret Color</span><span className="color-input"><input type="color" value={design.fretColor} onChange={(event) => updateDesign("fretColor", event.target.value)} /><b>{design.fretColor.toUpperCase()}</b></span></label>
              </div>
              <div className="range-grid">
                <RangeField label="Panel Corner Radius" value={design.panelRadius} min={0} max={140} onChange={(value) => updateDesign("panelRadius", value)} />
                <RangeField label="Panel Shadow" value={design.panelShadow} min={0} max={40} onChange={(value) => updateDesign("panelShadow", value)} />
                <RangeField label="String Opacity" value={Math.round(design.stringOpacity * 100)} min={20} max={100} suffix="%" onChange={(value) => updateDesign("stringOpacity", value / 100)} />
                <RangeField label="Open Circle Size" value={design.openCircleSize} min={10} max={38} onChange={(value) => updateDesign("openCircleSize", value)} />
                <RangeField label="Open Circle Stroke" value={design.openCircleStroke} min={2} max={12} onChange={(value) => updateDesign("openCircleStroke", value)} />
                <RangeField label="X Size" value={design.xSize} min={8} max={32} onChange={(value) => updateDesign("xSize", value)} />
                <RangeField label="X Thickness" value={design.xThickness} min={2} max={12} onChange={(value) => updateDesign("xThickness", value)} />
                <RangeField label="Nut Thickness" value={design.nutThickness} min={4} max={36} onChange={(value) => updateDesign("nutThickness", value)} />
                <RangeField label="Font Size" value={design.fontSize} min={14} max={42} onChange={(value) => updateDesign("fontSize", value)} />
                <RangeField label="Font Weight" value={design.fontWeight} min={400} max={900} step={100} onChange={(value) => updateDesign("fontWeight", value)} />
                <RangeField label="String Spacing" value={design.stringSpacing} min={55} max={110} onChange={(value) => updateDesign("stringSpacing", value)} />
                <RangeField label="Fret Spacing" value={design.fretSpacing} min={80} max={240} onChange={(value) => updateDesign("fretSpacing", value)} />
                <RangeField label="Panel Width" value={design.panelWidth} min={560} max={920} onChange={(value) => updateDesign("panelWidth", value)} />
                <RangeField label="Panel Height" value={design.panelHeight} min={700} max={860} onChange={(value) => updateDesign("panelHeight", value)} />
                <RangeField label="Internal Padding" value={design.internalPadding} min={55} max={140} onChange={(value) => updateDesign("internalPadding", value)} />
              </div>
            </div>
          </details>
        </div>

        <aside className="preview-column">
          <div className="preview-card">
            <div className="preview-heading">
              <div><span className="live-dot" /><span>Live preview</span></div>
              <div className="preview-background-control">
                <span>Preview background</span>
                <div className="preview-background-options" role="group" aria-label="Preview background">
                  {([
                    ["checkerboard", "Grid"],
                    ["light", "Light"],
                    ["dark", "Dark"],
                    ["photo", "Photo"],
                  ] as const).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={previewBackground === value ? "active" : ""}
                      aria-pressed={previewBackground === value}
                      onClick={() => {
                        setPreviewBackground(value);
                        if (value !== "photo") setMovePhotoDiagram(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {previewBackground === "photo" && (
              <div className="photo-position-toolbar">
                <div className="photo-position-copy"><strong>Full 9:16 photo</strong><span>{movePhotoDiagram ? "Drag the diagram on the image" : "Switch to Move to position the overlay"}</span></div>
                <div className="photo-position-actions">
                  <button type="button" className={movePhotoDiagram ? "active" : ""} aria-pressed={movePhotoDiagram} onClick={() => setMovePhotoDiagram((current) => !current)}>
                    {movePhotoDiagram ? "Done moving" : "Move diagram"}
                  </button>
                  <button type="button" onClick={() => setPhotoDiagramPosition({ x: 50, y: 50 })}>Center</button>
                </div>
                <label className="photo-size-control">
                  <span>Diagram size <output>{photoDiagramSize}%</output></span>
                  <input
                    type="range"
                    min={PHOTO_DIAGRAM_MIN_SIZE}
                    max={PHOTO_DIAGRAM_MAX_SIZE}
                    value={photoDiagramSize}
                    onChange={(event) => {
                      const nextSize = Number(event.target.value);
                      setPhotoDiagramSize(nextSize);
                      setPhotoDiagramPosition((current) => clampPhotoDiagramPosition(current.x, current.y, nextSize));
                    }}
                  />
                </label>
                <label className="switch-field photo-social-switch">
                  <span>Social UI</span>
                  <input type="checkbox" checked={showPhotoSocialUi} onChange={(event) => setShowPhotoSocialUi(event.target.checked)} />
                  <i aria-hidden="true" />
                </label>
              </div>
            )}
            <div ref={previewStageRef} className={previewBackground === "photo" ? "preview-stage photo-mode" : "preview-stage"}>
              <div className={`preview-surface ${previewBackground}`} aria-hidden="true" />
              <div
                className={`diagram-layer ${previewBackground === "photo" ? `photo ${movePhotoDiagram ? "move-mode" : ""} ${photoDiagramDragging ? "dragging" : ""}` : "standard"}`}
                style={previewBackground === "photo" ? {
                  left: `${photoDiagramPosition.x}%`,
                  top: `${photoDiagramPosition.y}%`,
                  width: `${photoDiagramSize}%`,
                } : undefined}
                onPointerDown={beginPhotoDiagramDrag}
                onPointerMove={movePhotoDiagramDrag}
                onPointerUp={endPhotoDiagramDrag}
                onPointerCancel={endPhotoDiagramDrag}
              >
                <ChordDiagram
                  chord={chord}
                  design={design}
                  onCellToggle={toggleDiagramCell}
                  onSymbolToggle={toggleDiagramSymbol}
                  onBarreCreate={createDiagramBarre}
                  onBarreRemove={() => setChord((current) => ({ ...current, barre: null }))}
                />
              </div>
              {previewBackground === "photo" && showPhotoSocialUi && (
                <div className="social-ui-preview" aria-hidden="true">
                  <div className="social-safe-area"><span>Safe content area</span></div>
                  <div className="social-ui-top"><span>Following</span><strong>For You</strong></div>
                  <div className="social-ui-actions">
                    <div><i className="social-avatar" /></div>
                    <div><b>♥</b><small>12K</small></div>
                    <div><b>◯</b><small>245</small></div>
                    <div><b>↗</b><small>Share</small></div>
                    <div><b>•••</b></div>
                  </div>
                  <div className="social-ui-caption">
                    <strong>@username</strong>
                    <span>Caption and hashtags appear here…</span>
                    <span>♫ Original audio</span>
                  </div>
                  <div className="social-ui-bottom"><span>Home</span><span>Discover</span><b>＋</b><span>Inbox</span><span>Profile</span></div>
                </div>
              )}
            </div>
            <p className="diagram-tip">{previewBackground === "photo" && movePhotoDiagram ? "Drag the diagram to test its position in the video frame" : "Click to add/remove a note · drag across strings to create a barre · click ○ / × to toggle"}</p>
            <div className="preview-footer">
              <div className="export-size">
                <label htmlFor="resolution">PNG size</label>
                <select id="resolution" value={resolution} onChange={(event) => setResolution(Number(event.target.value))}>
                  <option value="1024">1024 × 1024</option>
                  <option value="2048">2048 × 2048</option>
                  <option value="4096">4096 × 4096</option>
                </select>
              </div>
              <button type="button" className="export-button" onClick={exportPng}>
                <span>Export PNG</span><span aria-hidden="true">↓</span>
              </button>
            </div>
            <p className="export-note">The preview background is never exported. Your PNG stays transparent.</p>
          </div>
        </aside>
      </div>
      <div className={notice ? "toast visible" : "toast"} role="status" aria-live="polite">{notice}</div>
    </main>
  );
}
