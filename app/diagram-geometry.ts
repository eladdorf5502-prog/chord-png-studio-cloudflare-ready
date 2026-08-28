export type DiagramGeometryDesign = {
  markerSize: number;
  stringThickness: number;
  fretLabelSize: number;
  openCircleSize: number;
  openCircleStroke: number;
  xSize: number;
  xThickness: number;
  stringSpacing: number;
  fretSpacing: number;
  panelWidth: number;
  panelHeight: number;
  internalPadding: number;
};

export type DiagramGeometry = {
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  gridLeft: number;
  gridTop: number;
  gridBottom: number;
  gridWidth: number;
  effectiveStringSpacing: number;
  effectiveFretSpacing: number;
  fretLabelX: number;
  effectiveFretLabelSize: number;
  fretLabelPlacement: "outside" | "inside";
  symbolY: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keeps every diagram element inside the 1000 × 1000 export canvas while
 * preserving equal string/fret spacing. Controls are treated as requested
 * values; impossible combinations are fitted into the selected panel.
 */
export function calculateDiagramGeometry(
  design: DiagramGeometryDesign,
  visibleFrets: number,
  topReserve = 0,
): DiagramGeometry {
  const safeVisibleFrets = clamp(Math.round(visibleFrets), 4, 6);
  const requestedPanelWidth = clamp(design.panelWidth, 560, 920);
  const requestedPanelHeight = clamp(design.panelHeight, 700, 860);
  const safeTopReserve = clamp(topReserve, 0, 140);
  // Keep the panel bottom fixed while making room above it for an optional
  // chord name. This prevents large title text from leaving the SVG viewBox.
  const panelHeight = Math.max(560, requestedPanelHeight - safeTopReserve);
  // Fret labels always use a dedicated gutter to the left of the panel. The
  // complete label + panel composition stays centered and inside the canvas.
  const canvasSideMargin = 8;
  const labelPanelGap = 14;
  const labelWidthFactor = 3.6; // Rounded badge plus the longest label, "20 Fr".
  const labelBoxWidth = design.fretLabelSize * labelWidthFactor;
  const maximumPanelWidth = 1000 - canvasSideMargin * 2 - labelPanelGap - labelBoxWidth;
  const panelWidth = clamp(requestedPanelWidth, 560, maximumPanelWidth);
  const compositionWidth = labelBoxWidth + labelPanelGap + panelWidth;
  const compositionLeft = (1000 - compositionWidth) / 2;
  const panelX = compositionLeft + labelBoxWidth + labelPanelGap;

  // A small canvas margin keeps the rounded panel and its stroke in frame.
  // Internal padding used to push the panel upward without a safety limit.
  const canvasBottomMargin = clamp(design.internalPadding * 0.44, 28, 40);
  const panelY = 1000 - panelHeight - canvasBottomMargin;

  const markerRadius = design.markerSize / 2;
  const openExtent = design.openCircleSize + design.openCircleStroke / 2;
  const xExtent = design.xSize + design.xThickness / 2;
  const symbolExtent = Math.max(openExtent, xExtent);
  const sideInset = Math.max(
    markerRadius + 12,
    symbolExtent + 12,
    design.stringThickness * 0.95 + 18,
  );
  const maximumSpacing = Math.max(55, (panelWidth - sideInset * 2) / 5);
  const collisionSafeSpacing = Math.max(
    design.stringSpacing,
    design.markerSize + 12,
    symbolExtent * 2 + 8,
  );
  const effectiveStringSpacing = clamp(collisionSafeSpacing, 55, maximumSpacing);
  const gridWidth = effectiveStringSpacing * 5;
  const gridLeft = panelX + panelWidth / 2 - gridWidth / 2;
  // Round line caps extend by half the stroke width. Insetting both endpoints
  // keeps even the thicker muted-string shadow fully inside the panel.
  const stringEndInset = design.stringThickness * 0.95 + 1;
  const gridTop = panelY + stringEndInset;
  const availableGridHeight = panelHeight - stringEndInset * 2;
  const effectiveFretSpacing = Math.min(
    design.fretSpacing,
    availableGridHeight / safeVisibleFrets,
  );

  // Strings and the last fret area must end at (or before) the panel edge.
  const gridBottom = Math.min(
    panelY + panelHeight - stringEndInset,
    gridTop + effectiveFretSpacing * safeVisibleFrets,
  );

  // Labels never jump into the panel. Fitting the full composition above
  // preserves the requested font size and keeps every badge in the canvas.
  const effectiveFretLabelSize = design.fretLabelSize;
  const fretLabelPlacement = "outside" as const;
  const fretLabelX = panelX - labelPanelGap - effectiveFretLabelSize * 0.38;

  const requestedSymbolGap = clamp(symbolExtent + 12, 44, 56);
  const symbolY = Math.max(symbolExtent, panelY - requestedSymbolGap);

  return {
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    gridLeft,
    gridTop,
    gridBottom,
    gridWidth,
    effectiveStringSpacing,
    effectiveFretSpacing,
    fretLabelX,
    effectiveFretLabelSize,
    fretLabelPlacement,
    symbolY,
  };
}
