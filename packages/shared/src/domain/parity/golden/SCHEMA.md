# Golden Parity Fixtures — JSON schema

**Purpose**: hold verified physical measurements of real cabinets built by real shops. Each golden fixture pins the DIMENSIONAL TRUTH against which the TypeScript / Python parity harness can be evaluated during milestone V2.1B (Geometry Parity).

**Status**: empty by design in V2.1A. Do not populate speculative or fake values. A file lives here only when it represents an actual measurement taken from a physical, shop-built cabinet.

## Directory layout

```
packages/shared/src/domain/parity/golden/
├── SCHEMA.md              (this file)
├── README.md
└── <shop-slug>/
    └── <fixture-id>.json
```

Example filename: `golden/bearnson/frameless-base-600-v1.json`

## JSON shape

```jsonc
{
  "$schema": "1.0",
  "source": "physical_measurement",
  "shop": "Bearnson",
  "verifiedBy": "Full name of the person who measured the cabinet",
  "verifiedAt": "2026-11-14T10:00:00.000Z",
  "measurementNotes": [
    "Measured with Mitutoyo digital calipers, 0.02 mm resolution.",
    "Cabinet built 2026-11-10 using shop standard 18 mm plywood."
  ],
  "cabinet": {
    "id": "bearnson-base-600-v1",
    "type": "base",
    "widthMm": 600,
    "heightMm": 870,
    "depthMm": 580,
    "parameters": { "role": "cabinet", "doorCount": 1 }
  },
  "expected": {
    "cabinetId": "bearnson-base-600-v1",
    "source": "physical_measurement",
    "cabinetType": "base",
    "units": "mm",
    "boundingBox": { "widthMm": 600, "heightMm": 870, "depthMm": 580 },
    "parts": [
      { "role": "left_panel", "widthMm": 580, "heightMm": 870, "thicknessMm": 18, "quantity": 1 },
      { "role": "right_panel", "widthMm": 580, "heightMm": 870, "thicknessMm": 18, "quantity": 1 },
      { "role": "top_panel", "widthMm": 564, "heightMm": 18, "thicknessMm": 18, "quantity": 1 },
      { "role": "bottom_panel", "widthMm": 564, "heightMm": 18, "thicknessMm": 18, "quantity": 1 },
      { "role": "back_panel", "widthMm": 564, "heightMm": 870, "thicknessMm": 6, "quantity": 1 },
      { "role": "toe_kick", "widthMm": 564, "heightMm": 96, "thicknessMm": 18, "quantity": 1 },
      { "role": "door", "widthMm": 594, "heightMm": 690, "thicknessMm": 18, "quantity": 1 }
    ],
    "features": {
      "toeKick": { "present": true, "heightMm": 96, "depthMm": 60 },
      "faceFrame": null,
      "countertop": null
    }
  }
}
```

The `expected.*` block MUST validate against `geometryParitySnapshotSchema` (see `packages/shared/src/domain/parity/snapshot.ts`).

## Adding a golden fixture

1. Physically measure the cabinet. Record every value in millimeters.
2. Copy the template above.
3. Fill in `cabinet.*` with the intent as it existed at manufacturing time.
4. Fill in `expected.*` with actual measured values (parts, features).
5. Add the file under `golden/<shop-slug>/`.
6. Add a corresponding test case in `__tests__/golden.test.ts` (to be added in V2.1B).

## What NOT to put here

- Predicted values (the TS or Python snapshot builders already produce those).
- Design intent alone (use the fixture registry in `../fixtures.ts`).
- Nominal specs from a PDF cut list (must be a physical measurement).
- Any value tagged with uncertainty > 1 mm — capture the measurement uncertainty in `measurementNotes` and pick a single canonical value.
