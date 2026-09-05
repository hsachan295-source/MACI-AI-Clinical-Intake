"""Voice endpoints - transcript intake + TTS parameters."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import RepoDep
from app.schemas.interview import InterviewMessageIn
from app.schemas.voice import (
    VoiceSpeakIn,
    VoiceSpeakOut,
    VoiceTranscriptIn,
    VoiceTranscriptOut,
)
from app.services.clinical_interview_service import process_turn
from app.services.voice_service import normalize_transcript, synthesize, word_count

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/transcript", response_model=VoiceTranscriptOut)
async def submit_transcript(payload: VoiceTranscriptIn, repo: RepoDep) -> VoiceTranscriptOut:
    """Accept a browser ASR transcript, normalise it, and (optionally) feed it
    straight into the adaptive interview so the client makes a single call."""
    normalized = normalize_transcript(payload.transcript)
    language = payload.language.value if payload.language else None

    interview = None
    forwarded = False
    if payload.forward_to_interview and payload.is_final and normalized:
        interview = await process_turn(
            repo,
            InterviewMessageIn(
                session_id=payload.session_id,
                patient_id=payload.patient_id,
                text=normalized,
                language=payload.language,
            ),
        )
        forwarded = True

    return VoiceTranscriptOut(
        session_id=payload.session_id,
        normalized_text=normalized,
        language=language or "en",
        word_count=word_count(normalized),
        forwarded=forwarded,
        interview=interview,
    )


@router.post("/speak", response_model=VoiceSpeakOut)
async def speak(payload: VoiceSpeakIn) -> VoiceSpeakOut:
    result = await synthesize(payload.text, payload.language.value, payload.voice_hint)
    return VoiceSpeakOut(**result)
