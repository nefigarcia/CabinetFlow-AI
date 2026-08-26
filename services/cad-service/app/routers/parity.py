"""Diagnostic parity router (V2.1A).

Exposes a single POST /parity/snapshot endpoint that returns a normalized
GeometryParitySnapshot for a given cabinet spec. Consumed by future CI
integration jobs and by manual parity verification against real shop
measurements. NOT called from any production code path.

The endpoint reuses the existing production `compute_parts()` — no
behavioral fork. If parametric.py changes the physical result of a
cabinet, this endpoint will reflect the change automatically.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.cabinet import CabinetGeometryRequest
from app.services.parity import build_parity_snapshot

router = APIRouter()


@router.post("/snapshot")
def parity_snapshot(req: CabinetGeometryRequest) -> dict:
    """Return a normalized geometry parity snapshot for the cabinet.

    The shape mirrors packages/shared/src/domain/parity/snapshot.ts so
    callers can diff Python-live output against the TS-side snapshot.
    """
    try:
        return build_parity_snapshot(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
