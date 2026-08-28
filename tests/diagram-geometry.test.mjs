import assert from "node:assert/strict";
import test from "node:test";

import { calculateDiagramGeometry } from "../app/diagram-geometry.ts";

const baseDesign = {
  markerSize: 50,
  stringThickness: 8,
  fretLabelSize: 24,
  openCircleSize: 20,
  openCircleStroke: 4,
  xSize: 18,
  xThickness: 5,
  stringSpacing: 110,
  fretSpacing: 215,
  panelWidth: 630,
  panelHeight: 860,
  internalPadding: 90,
};

test("strings never extend beyond the panel", () => {
  for (const visibleFrets of [4, 5, 6]) {
    for (const panelHeight of [700, 780, 860, 940]) {
      for (const fretSpacing of [80, 160, 240]) {
        const geometry = calculateDiagramGeometry(
          { ...baseDesign, panelHeight, fretSpacing },
          visibleFrets,
        );
        const capExtent = baseDesign.stringThickness * 0.95;
        assert.ok(geometry.gridTop - capExtent >= geometry.panelY);
        assert.ok(geometry.gridBottom + capExtent <= geometry.panelY + geometry.panelHeight);
      }
    }
  }
});

test("large markers keep a dedicated gap from fret labels", () => {
  for (const markerSize of [28, 40, 41, 60, 78]) {
    for (const panelWidth of [560, 630, 920]) {
      for (const stringSpacing of [55, 80, 110]) {
        const geometry = calculateDiagramGeometry(
          { ...baseDesign, markerSize, panelWidth, stringSpacing },
          4,
        );
        const firstMarkerLeft = geometry.gridLeft - markerSize / 2;
        assert.ok(
          firstMarkerLeft - geometry.fretLabelX >= 18,
          `marker ${markerSize}, panel ${panelWidth}, spacing ${stringSpacing}`,
        );
      }
    }
  }
});

test("fret labels always stay outside the panel and inside the canvas", () => {
  for (const panelWidth of [560, 630, 760, 920]) {
    for (const markerSize of [28, 50, 78]) {
      for (const fretLabelSize of [16, 24, 42, 64]) {
        const geometry = calculateDiagramGeometry(
          { ...baseDesign, panelWidth, markerSize, fretLabelSize },
          4,
        );
        const reservedBadgeWidth = geometry.effectiveFretLabelSize * 3.6;
        const badgeRight = geometry.panelX - 14;
        assert.equal(geometry.fretLabelPlacement, "outside");
        assert.ok(geometry.fretLabelX < geometry.panelX);
        assert.ok(badgeRight - reservedBadgeWidth >= 8 - 1e-9);
        assert.ok(geometry.panelX + geometry.panelWidth <= 992 + 1e-9);
      }
    }
  }
});

test("all six strings remain equally spaced and inside the panel", () => {
  const extremes = [
    { markerSize: 28, panelWidth: 560, stringSpacing: 55 },
    { markerSize: 78, panelWidth: 560, stringSpacing: 110 },
    { markerSize: 78, panelWidth: 920, stringSpacing: 110 },
  ];

  for (const values of extremes) {
    const geometry = calculateDiagramGeometry({ ...baseDesign, ...values }, 6);
    const xs = Array.from(
      { length: 6 },
      (_, index) => geometry.gridLeft + index * geometry.effectiveStringSpacing,
    );
    for (let index = 1; index < xs.length; index += 1) {
      assert.ok(
        Math.abs((xs[index] - xs[index - 1]) - geometry.effectiveStringSpacing) < 1e-9,
      );
    }
    assert.ok(xs[0] - values.markerSize / 2 >= geometry.panelX);
    assert.ok(
      xs[5] + values.markerSize / 2 <= geometry.panelX + geometry.panelWidth,
    );
  }
});

test("a chord-name reserve moves the panel down without changing its bottom edge", () => {
  const normal = calculateDiagramGeometry(baseDesign, 4);
  const named = calculateDiagramGeometry(baseDesign, 4, 96);

  assert.equal(
    named.panelY + named.panelHeight,
    normal.panelY + normal.panelHeight,
  );
  assert.equal(named.panelY, normal.panelY + 96);
  assert.equal(named.panelHeight, normal.panelHeight - 96);
  assert.ok(named.gridTop >= named.panelY);
  assert.ok(named.gridBottom <= named.panelY + named.panelHeight);
});
