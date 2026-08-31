import { describe, expect, it } from "vitest";
import {
  degreesToRadians,
  metersToMm,
  mmToMeters,
  radiansToDegrees,
} from "../units";

describe("unit conversions", () => {
  it("mmToMeters divides by 1000", () => {
    expect(mmToMeters(1000)).toBe(1);
    expect(mmToMeters(2400)).toBe(2.4);
    expect(mmToMeters(0)).toBe(0);
  });

  it("metersToMm multiplies by 1000", () => {
    expect(metersToMm(1)).toBe(1000);
    expect(metersToMm(2.4)).toBe(2400);
    expect(metersToMm(0)).toBe(0);
  });

  it("mm↔meters round-trips for typical cabinet dimensions", () => {
    for (const mm of [0, 1, 18, 100, 600, 2400, 3600, 999999]) {
      expect(metersToMm(mmToMeters(mm))).toBeCloseTo(mm, 6);
    }
  });

  it("degreesToRadians handles cardinal angles", () => {
    expect(degreesToRadians(0)).toBe(0);
    expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
    expect(degreesToRadians(360)).toBeCloseTo(Math.PI * 2, 10);
  });

  it("radiansToDegrees handles cardinal angles", () => {
    expect(radiansToDegrees(0)).toBe(0);
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
  });

  it("deg↔rad round-trips over a spread of angles including negatives", () => {
    for (const deg of [0, 30, 45, 90, 180, 270, 359.9, -45, -180]) {
      expect(radiansToDegrees(degreesToRadians(deg))).toBeCloseTo(deg, 10);
    }
  });

  it("handles negative dimensions symmetrically", () => {
    expect(mmToMeters(-1500)).toBe(-1.5);
    expect(metersToMm(-1.5)).toBe(-1500);
  });
});
