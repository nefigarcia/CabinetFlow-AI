import { describe, expect, it } from "vitest";
import {
  GEOMETRY_COMPARE_TOLERANCE_MM,
  RATIO_COMPARE_TOLERANCE,
  deltaMm,
  nearlyEqualMm,
  nearlyEqualRatio,
} from "../tolerance";

describe("parity tolerance policy", () => {
  it("uses 0.01 mm as the geometry comparison tolerance", () => {
    expect(GEOMETRY_COMPARE_TOLERANCE_MM).toBe(0.01);
  });

  it("uses 0.0001 as the ratio comparison tolerance", () => {
    expect(RATIO_COMPARE_TOLERANCE).toBe(0.0001);
  });

  it("nearlyEqualMm considers values within tolerance equal", () => {
    expect(nearlyEqualMm(19, 19.005)).toBe(true);
    expect(nearlyEqualMm(19, 19.009)).toBe(true);
    // Use 0.011 (strictly outside tolerance) — 19.01 sits on the IEEE-754
    // boundary and can round either way depending on subtraction order.
    expect(nearlyEqualMm(19, 19.011)).toBe(false);
    expect(nearlyEqualMm(19, 19.02)).toBe(false);
    expect(nearlyEqualMm(89, 96)).toBe(false);
  });

  it("nearlyEqualRatio considers values within tolerance equal", () => {
    expect(nearlyEqualRatio(0.38, 0.38001)).toBe(true);
    expect(nearlyEqualRatio(0.38, 0.45)).toBe(false);
  });

  it("does NOT hide the known 89 vs 96 mm toe-kick difference", () => {
    expect(nearlyEqualMm(89, 96)).toBe(false);
  });

  it("does NOT hide the known 19 vs 18 mm panel-thickness difference", () => {
    expect(nearlyEqualMm(19, 18)).toBe(false);
  });

  it("deltaMm reports signed delta rounded to 3 dp", () => {
    expect(deltaMm(89, 96)).toBe(7);
    expect(deltaMm(96, 89)).toBe(-7);
    expect(deltaMm(19, 18)).toBe(-1);
    expect(deltaMm(19.0001, 19.0002)).toBe(0);
    expect(deltaMm(19.005, 19.010)).toBe(0.005);
  });
});
