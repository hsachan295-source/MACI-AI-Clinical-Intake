"""ABDM / ABHA integration - FUTURE / SANDBOX INTERFACE ONLY.

This module defines the *shape* of a future integration with India's Ayushman
Bharat Digital Mission (ABDM): ABHA identity lookup, consent artefacts, FHIR
export and hospital-information-system (HIS) push.

NOTHING here calls a real ABDM endpoint. Every method returns a clearly
labelled stub so the rest of MACI can be wired against a stable interface. The
prototype runs fully without any ABDM credentials.

To implement for real later:
* register a Health Information Provider/User (HIP/HIU) with ABDM sandbox
* obtain client credentials + gateway session token
* replace each ``NotImplemented`` stub body with a real gateway call
* keep the method signatures so callers do not change
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("services.abdm")

INTEGRATION_STATUS = "future-sandbox"  # never "live" in this prototype


@dataclass
class AbdmStubResult:
    ok: bool
    integration_status: str
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AbdmService:
    """Stubbed ABDM client. See module docstring."""

    def __init__(self) -> None:
        # Real impl would read ABDM_CLIENT_ID / ABDM_CLIENT_SECRET / gateway URL.
        self.enabled = False
        self.base_url = "https://dev.abdm.gov.in/gateway"  # sandbox, unused

    def status(self) -> AbdmStubResult:
        return AbdmStubResult(
            ok=True,
            integration_status=INTEGRATION_STATUS,
            message=(
                "ABDM integration is a future/sandbox capability. MACI operates "
                "fully without ABDM credentials."
            ),
            data={"configured": self.enabled, "prototype": True},
        )

    # --- ABHA identity ----------------------------------------------------
    def lookup_abha(self, abha_id: str | None = None, *, mobile: str | None = None) -> AbdmStubResult:
        return AbdmStubResult(
            ok=False,
            integration_status=INTEGRATION_STATUS,
            message="ABHA lookup is not available in the prototype (future/sandbox).",
            data={"requested_abha_id": abha_id, "requested_mobile": bool(mobile)},
        )

    # --- Consent --------------------------------------------------------------
    def request_consent(self, *, patient_id: str, purpose: str, hi_types: list[str] | None = None) -> AbdmStubResult:
        return AbdmStubResult(
            ok=False,
            integration_status=INTEGRATION_STATUS,
            message="ABDM consent request is stubbed (future/sandbox).",
            data={
                "patient_id": patient_id,
                "purpose": purpose,
                "hi_types": hi_types or ["OPConsultation", "DiagnosticReport", "Prescription"],
                "consent_artefact": None,
            },
        )

    # --- FHIR export --------------------------------------------------------
    def to_fhir_bundle(self, *, patient: dict, summary: dict | None, documents: list[dict] | None = None) -> dict:
        """Return a *minimal, illustrative* FHIR R4 Bundle skeleton.

        This is a local transformation only - it is NOT validated against the
        ABDM FHIR profiles and is NOT transmitted anywhere.
        """
        now = datetime.now(timezone.utc).isoformat()
        entries: list[dict] = [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": str(patient.get("id", "unknown")),
                    "name": [{"text": patient.get("full_name", "")}],
                    "gender": patient.get("gender", "unknown"),
                }
            }
        ]
        if summary:
            entries.append(
                {
                    "resource": {
                        "resourceType": "Composition",
                        "status": "preliminary",
                        "type": {"text": "Clinical intake summary (AI draft - requires clinician review)"},
                        "date": now,
                        "title": "MACI AI Clinical Intake Summary",
                        "section": [{"title": "Narrative", "text": {"status": "generated", "div": summary.get("narrative", "")}}],
                    }
                }
            )
        for d in documents or []:
            entries.append(
                {
                    "resource": {
                        "resourceType": "DocumentReference",
                        "status": "current",
                        "type": {"text": d.get("document_type", "other")},
                        "description": d.get("filename", ""),
                    }
                }
            )
        return {
            "resourceType": "Bundle",
            "type": "document",
            "timestamp": now,
            "meta": {"tag": [{"code": "maci-prototype", "display": "Not for clinical exchange"}]},
            "entry": entries,
        }

    # --- HIS push ----------------------------------------------------------
    def push_to_his(self, *, bundle: dict, destination: str = "sandbox") -> AbdmStubResult:
        log.info("ABDM HIS push requested (stub) -> %s, %d entries", destination, len(bundle.get("entry", [])))
        return AbdmStubResult(
            ok=False,
            integration_status=INTEGRATION_STATUS,
            message="HIS/ABDM push is stubbed. No data was transmitted.",
            data={"destination": destination, "entries": len(bundle.get("entry", []))},
        )


_abdm: AbdmService | None = None


def get_abdm() -> AbdmService:
    global _abdm
    if _abdm is None:
        _abdm = AbdmService()
    return _abdm
