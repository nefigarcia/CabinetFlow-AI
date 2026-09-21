import { describe, expect, it } from "vitest";
import {
  assertUpdateOperationInvariant,
  interiorComponentOperationSchema,
  type InteriorComponentOperation,
} from "../";

// ═══════════════════════════════════════════════════════════════════════
// AI operation schema — contract-only tests. AI wiring is deferred to
// Phase 3.x. These tests lock the shape of the operation the Copilot
// will emit and the server will dispatch.
// ═══════════════════════════════════════════════════════════════════════

const validComponent = {
  id: "c1",
  enabled: true,
  type: "trash_pullout" as const,
  bins: 2,
};

describe("interiorComponentOperationSchema", () => {
  it("accepts add_interior_component with a valid component", () => {
    const op = {
      op: "add_interior_component",
      cabinetId: "cab1",
      component: validComponent,
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(true);
  });

  it("accepts update_interior_component with a COMPLETE replacement (never Partial)", () => {
    const op = {
      op: "update_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
      component: validComponent,
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(true);
  });

  it("accepts remove_interior_component", () => {
    const op = {
      op: "remove_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(true);
  });

  it("accepts reorder_interior_components with an id sequence", () => {
    const op = {
      op: "reorder_interior_components",
      cabinetId: "cab1",
      orderedIds: ["c1", "c2", "c3"],
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(true);
  });

  it("rejects unknown op discriminant", () => {
    const op = { op: "delete_all", cabinetId: "cab1" };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(false);
  });

  it("rejects update op with invalid inner component", () => {
    const op = {
      op: "update_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
      component: { id: "c1", enabled: true, type: "trash_pullout" }, // missing bins
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(false);
  });

  it("rejects add op with invalid inner component", () => {
    const op = {
      op: "add_interior_component",
      cabinetId: "cab1",
      component: { id: "c1", enabled: true, type: "custom" }, // missing required label
    };
    expect(interiorComponentOperationSchema.safeParse(op).success).toBe(false);
  });
});

describe("assertUpdateOperationInvariant — component.id must equal componentId (§E)", () => {
  it("no-op on non-update operations", () => {
    const op: InteriorComponentOperation = {
      op: "remove_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
    };
    expect(() => assertUpdateOperationInvariant(op)).not.toThrow();
  });

  it("passes when component.id === componentId", () => {
    const op: InteriorComponentOperation = {
      op: "update_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
      component: validComponent,
    };
    expect(() => assertUpdateOperationInvariant(op)).not.toThrow();
  });

  it("throws when component.id !== componentId", () => {
    const op: InteriorComponentOperation = {
      op: "update_interior_component",
      cabinetId: "cab1",
      componentId: "c1",
      component: { ...validComponent, id: "c2" },
    };
    expect(() => assertUpdateOperationInvariant(op)).toThrow(/component\.id \(c2\) must equal componentId \(c1\)/);
  });
});
