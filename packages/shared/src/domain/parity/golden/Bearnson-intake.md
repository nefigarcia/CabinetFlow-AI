# Bearnson production measurement intake — V2.1B baseline

**Purpose:** capture the minimum set of physical shop measurements required to lock the first canonical `BearnsonProductionProfileV1`.

**Who fills this out:** designer, CNC operator, or shop lead — anyone with access to a completed cabinet and a caliper.

**Where measurements go:** paste this file into a new copy at `packages/shared/src/domain/parity/golden/bearnson/intake-YYYY-MM-DD.md`, fill in every blank, then hand it back to engineering. Do NOT delete this template — it stays here for future intakes.

---

## Verification header

- **Verified by (full name):**
- **Role:**
- **Date measured (YYYY-MM-DD):**
- **Cabinet(s) built date:**
- **Measurement tool + model:** _(e.g. Mitutoyo digital caliper, 0.02 mm resolution; Starrett tape, 1 mm)_
- **Location / job reference:**
- **General notes:**

_All measurements in millimeters unless a field explicitly says otherwise._
_Round to the nearest 0.5 mm unless you can confidently resolve finer._

---

## 1. Standard frameless base cabinet

Cabinet as-built to current shop production standard. If width/height/depth vary between jobs, measure whichever one you actually built most recently.

**Cabinet identity**
- Overall width (mm):
- Overall height (mm):
- Overall depth (mm):

**Structural panels**
- Left side panel thickness:
- Right side panel thickness:
- Bottom panel thickness:
- Top / nailer construction: _(circle one)_ full top panel · dual nailers · other:
- Top / nailer thickness:
- Top / nailer width (each nailer, if applicable):

**Back panel**
- Back panel material: _(circle one)_ 6 mm HDF · 3 mm HDF · plywood · other:
- Back panel thickness:
- Back panel attachment: _(circle one)_ dado · rabbet · groove · applied to rear · other:
- Dado / rabbet depth (if applicable):

**Toe kick**
- Toe-kick height (top of floor to bottom of cabinet body):
- Toe-kick setback from front (front face of toe kick to front of cabinet):
- Kickboard thickness:
- Kickboard attachment: _(freeform)_

**Doors**
- Door slab thickness:
- Door width (visible face):
- Door height (visible face):
- Reveal — left side (mm):
- Reveal — right side (mm):
- Reveal — top (mm):
- Reveal — bottom (mm):
- Overlay onto carcass opening (mm):
- Any counter/finished top attachment considerations:

**Notes for this fixture:**

---

## 2. 3-drawer base cabinet

Standard 3-drawer bank as built to shop production standard.

**Cabinet identity**
- Overall width (mm):
- Overall height (mm):
- Overall depth (mm):

**Drawer fronts (fill for each of the 3 drawers, top to bottom)**

| Drawer | Front width | Front height | Front thickness | Reveal above | Reveal below |
|---|---|---|---|---|---|
| Top |  |  |  |  |  |
| Middle |  |  |  |  |  |
| Bottom |  |  |  |  |  |

- Reveal at left (mm):
- Reveal at right (mm):

**Drawer boxes**
- Drawer box side thickness:
- Drawer box back thickness:
- Drawer box bottom thickness + material: _(e.g. 6 mm plywood)_
- Drawer box joinery method: _(circle one)_ dovetail · dado · rabbet · dowel · other:

**Slides**
- Slide manufacturer + model: _(e.g. Blum Tandem Plus Blumotion 563H)_
- Slide part number:
- Total side clearance between drawer box + carcass (mm):
- Rear clearance (drawer box back to carcass back, mm):
- Slide length used on this cabinet (mm):
- Length increment shop rounds to (mm): _(e.g. 50)_

**Notes for this fixture:**

---

## 3. Standard wall cabinet with adjustable shelves

Standard wall cabinet as built to shop production standard.

**Cabinet identity**
- Overall width (mm):
- Overall height (mm):
- Overall depth (mm):
- Shelf count:

**Structural panels** (same fields as base cabinet — repeat only if wall cabinet uses different specs)
- Panel thickness (if different from base):
- Back panel thickness / attachment (if different):
- Any structural difference vs base:

**Shelves**
- Shelf thickness:
- Shelf front setback (mm from front edge to shelf front):
- Shelf rear setback (mm from back panel):
- Shelf is fully adjustable: yes / no
- Shelf material: _(if different from carcass)_

**Shelf-pin pattern**
- Pin spacing along column (mm): _(e.g. 32)_
- Pin diameter (mm): _(e.g. 5)_
- Row inset from front edge (mm): _(e.g. 37)_
- Row inset from back edge (mm):
- Number of pin rows per side panel: _(e.g. 2)_
- First pin distance from top of interior (mm):
- Last pin distance from bottom of interior (mm):
- Boring pattern: _(circle one)_ 32 mm system line · custom · manual · other:

**Notes for this fixture:**

---

## 4. Face-frame base cabinet — ONLY if your shop actually builds face-frame cabinets

Skip this section entirely if current production is frameless-only. Write "N/A — shop is frameless" in the notes below.

- Face-frame stile width (vertical rails, mm):
- Face-frame rail width (horizontal, mm):
- Face-frame thickness:
- Face-frame material:
- Face-frame joinery: _(circle one)_ pocket screw · dowel · mortise-tenon · biscuit · other:
- Reveal from face-frame opening to door edge (mm):
- Attach method (face frame to carcass):

**Notes for this fixture:**

---

## 5. Hinge boring sample

Fill this from any recently built cabinet whose door(s) have 2+ hinges. Use the tallest door available.

**Hinge product**
- Hinge manufacturer + model: _(e.g. Blum Clip Top Blumotion 71B3550)_
- Hinge part number:
- Overlay type: _(circle one)_ full · half · inset

**Boring**
- Cup diameter (mm): _(e.g. 35)_
- Cup boring depth (mm): _(e.g. 13.5)_
- Cup center distance from door edge, inward (mm): _(e.g. 22.5)_

**Positioning (from the top of the door slab downward, in mm)**
- Distance from door top to TOP hinge cup CENTER:
- Distance from door bottom to BOTTOM hinge cup CENTER:
- For doors that need a middle hinge — at what door height do you add one? (mm)
- Spacing rule between hinges when 3+ hinges are used: _(freeform)_

**Plate**
- Plate model:
- Plate inset from door edge onto carcass (mm):

**Notes for this fixture:**

---

## 6. Current CNC sheet size + kerf

- CNC machine make + model:
- Post-processor: _(e.g. HOLZ-HER Dynestic 7507)_
- Standard sheet width (mm): _(e.g. 1220)_
- Standard sheet height (mm): _(e.g. 2440)_
- Standard sheet material: _(e.g. 18 mm plywood)_
- Kerf (mm): _(e.g. 3.2)_
- Kerf source: _(measured with test cuts / documented from tooling / operator practice)_
- Grain direction convention: _(freeform — is sheet height "with grain" or "across"?)_
- Any per-material overrides (different sheet size for HDF backs, etc.):

**Notes:**

---

## After completing this form

1. Save at `packages/shared/src/domain/parity/golden/bearnson/intake-YYYY-MM-DD.md`.
2. Send a note to engineering (whoever asked you to fill this out).
3. Engineering will convert this into JSON fixtures under `packages/shared/src/domain/parity/golden/bearnson/*.json` matching `SCHEMA.md`.

Thank you — this is the last blocker before we can start building geometry parity into the shop-specific production profile.
