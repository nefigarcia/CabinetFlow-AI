import { describe, expect, it } from "vitest";
import {
  mergeCabinetSystemAssignments,
  mergeMetadataAssignmentsPatch,
  readAssignmentsFromMetadata,
} from "../";

describe("mergeCabinetSystemAssignments — three-state per key", () => {
  const existing = {
    familyRuleIdsByCabinetType: { base: "b1", wall: "w1" },
    preferredFrontSystemId: "f1",
    preferredDrawerSystemId: "d1",
  };

  it("patch === undefined → preserve existing", () => {
    expect(mergeCabinetSystemAssignments(existing, undefined)).toEqual(existing);
  });

  it("patch === null → clear the whole blob", () => {
    expect(mergeCabinetSystemAssignments(existing, null)).toBeNull();
  });

  it("familyRuleIdsByCabinetType.base = null clears only that sub-key", () => {
    const out = mergeCabinetSystemAssignments(existing, {
      familyRuleIdsByCabinetType: { base: null },
    });
    expect(out?.familyRuleIdsByCabinetType).toEqual({ wall: "w1" });
    expect(out?.preferredFrontSystemId).toBe("f1");
    expect(out?.preferredDrawerSystemId).toBe("d1");
  });

  it("familyRuleIdsByCabinetType.base = 'new' sets that sub-key", () => {
    const out = mergeCabinetSystemAssignments(existing, {
      familyRuleIdsByCabinetType: { base: "b2" },
    });
    expect(out?.familyRuleIdsByCabinetType).toEqual({ base: "b2", wall: "w1" });
  });

  it("familyRuleIdsByCabinetType = null clears the whole map, leaves others", () => {
    const out = mergeCabinetSystemAssignments(existing, {
      familyRuleIdsByCabinetType: null,
    });
    expect(out?.familyRuleIdsByCabinetType).toBeUndefined();
    expect(out?.preferredFrontSystemId).toBe("f1");
  });

  it("preferredFrontSystemId = null clears just that key", () => {
    const out = mergeCabinetSystemAssignments(existing, { preferredFrontSystemId: null });
    expect(out?.preferredFrontSystemId).toBeUndefined();
    expect(out?.preferredDrawerSystemId).toBe("d1");
  });

  it("empty resulting map normalizes to null", () => {
    const out = mergeCabinetSystemAssignments(
      { familyRuleIdsByCabinetType: { base: "b1" } },
      { familyRuleIdsByCabinetType: { base: null } },
    );
    expect(out).toBeNull();
  });

  it("absent sub-keys are preserved", () => {
    const out = mergeCabinetSystemAssignments(existing, {
      preferredDrawerSystemId: "d2",
    });
    expect(out?.familyRuleIdsByCabinetType).toEqual({ base: "b1", wall: "w1" });
    expect(out?.preferredFrontSystemId).toBe("f1");
    expect(out?.preferredDrawerSystemId).toBe("d2");
  });
});

describe("mergeMetadataAssignmentsPatch — container merge preserves sibling keys", () => {
  it("does not touch other metadata keys", () => {
    const existing = {
      cabinetSystemAssignments: { preferredFrontSystemId: "f1" },
      otherFeature: { foo: "bar" },
    };
    const out = mergeMetadataAssignmentsPatch(existing, { preferredFrontSystemId: "f2" });
    expect(out?.otherFeature).toEqual({ foo: "bar" });
    expect(readAssignmentsFromMetadata(out)?.preferredFrontSystemId).toBe("f2");
  });

  it("drops cabinetSystemAssignments key when merged result is empty", () => {
    const existing = {
      cabinetSystemAssignments: { preferredFrontSystemId: "f1" },
      otherFeature: 42,
    };
    const out = mergeMetadataAssignmentsPatch(existing, { preferredFrontSystemId: null });
    expect("cabinetSystemAssignments" in (out ?? {})).toBe(false);
    expect(out?.otherFeature).toBe(42);
  });

  it("returns null when the entire metadata bag ends up empty", () => {
    const existing = { cabinetSystemAssignments: { preferredFrontSystemId: "f1" } };
    const out = mergeMetadataAssignmentsPatch(existing, { preferredFrontSystemId: null });
    expect(out).toBeNull();
  });
});

describe("readAssignmentsFromMetadata — safe parse of unknown shapes", () => {
  it("returns null for missing metadata", () => {
    expect(readAssignmentsFromMetadata(null)).toBeNull();
    expect(readAssignmentsFromMetadata(undefined)).toBeNull();
    expect(readAssignmentsFromMetadata({})).toBeNull();
  });

  it("ignores unknown family-map keys and non-string values", () => {
    const meta = {
      cabinetSystemAssignments: {
        familyRuleIdsByCabinetType: {
          base: "b1",
          nonsense: "x",
          wall: 42,
        },
      },
    };
    const out = readAssignmentsFromMetadata(meta);
    expect(out?.familyRuleIdsByCabinetType).toEqual({ base: "b1" });
  });
});
