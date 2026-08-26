"""Geometry parity normalization (V2.1A — diagnostic only).

Translates the production `compute_parts()` output into the parity snapshot
shape shared with the TypeScript side. NEVER modifies production behavior
and never mutates its input.

Consumers:
- /parity/snapshot endpoint (services/cad-service/app/routers/parity.py)

Not consumed by:
- Production /cabinets/geometry endpoint (unchanged)
- STEP/STL/SVG builders (unchanged)
- Nesting (unchanged)
"""

from __future__ import annotations

from typing import Any

from app.models.cabinet import CabinetGeometryRequest, PartDimensions
from app.services.parametric import compute_parts


# Roles emitted by the cad-service that the parity schema recognizes.
# Any Python part_type not in this map is passed through unchanged (a diff
# on the TypeScript side will still flag it).
_ROLE_MAP: dict[str, str] = {
    "left_panel": "left_panel",
    "right_panel": "right_panel",
    "top_panel": "top_panel",
    "bottom_panel": "bottom_panel",
    "back_panel": "back_panel",
    "shelf": "shelf",
    "toe_kick": "toe_kick",
    "door": "door",
    "drawer_front": "drawer_front",
    "drawer_box_side": "drawer_box_side",
    "drawer_box_back": "drawer_box_back",
    "drawer_box_bottom": "drawer_box_bottom",
    "face_frame_stile": "face_frame_stile",
    "face_frame_rail": "face_frame_rail",
    "face_frame_mullion": "face_frame_mullion",
    "sink_stretcher": "sink_stretcher",
    "blind_panel": "blind_panel",
}


def _needs_toe_kick(cab_type: str) -> bool:
    return cab_type in ("base", "drawer_base", "sink_base", "island", "tall")


def _map_part(part: PartDimensions) -> dict[str, Any]:
    role = _ROLE_MAP.get(part.part_type, "custom")
    out: dict[str, Any] = {
        "role": role,
        "name": part.name,
        "widthMm": part.width,
        "heightMm": part.height,
        "thicknessMm": part.thickness,
        "quantity": part.quantity,
    }
    if part.cut_params:
        out["tags"] = {k: v for k, v in part.cut_params.items() if isinstance(v, (str, int, float))}
    return out


def build_parity_snapshot(req: CabinetGeometryRequest) -> dict[str, Any]:
    """Return a GeometryParitySnapshot-shaped dict for the given cabinet.

    Uses live cad-service computation via `compute_parts()`. Does not touch
    the STEP/STL/SVG or nesting pipelines. Read-only against production
    logic.
    """
    parts = compute_parts(req)
    mapped_parts = [_map_part(p) for p in parts]

    params = req.parameters or {}
    toe_kick_height = float(params.get("toeKickHeight", 96.0)) if _needs_toe_kick(req.type) else 0.0

    features: dict[str, Any] = {
        "toeKick": {
            "present": _needs_toe_kick(req.type),
            "heightMm": toe_kick_height if _needs_toe_kick(req.type) else None,
        },
        # cad-service does not model countertops, handles, or open-shelf grid.
        "countertop": None,
        "faceFrame": None,
    }

    # Face-frame indicator (parametric.py enables when constructionMethod=='face_frame').
    if params.get("constructionMethod") == "face_frame":
        features["faceFrame"] = {
            "stileWidthMm": float(params.get("stileWidth", 38.0)),
            "railWidthMm": float(params.get("railWidth", 38.0)),
            "thicknessMm": float(params.get("faceFrameThickness", 19.0)),
        }

    return {
        "cabinetId": req.cabinet_id,
        "source": "python-live",
        "cabinetType": req.type,
        "units": "mm",
        "boundingBox": {
            "widthMm": req.width,
            "heightMm": req.height,
            "depthMm": req.depth,
        },
        "parts": mapped_parts,
        "features": features,
        "notes": [
            "Live cad-service snapshot for parity diagnostics. Do not rely on this endpoint in production paths.",
        ],
    }
