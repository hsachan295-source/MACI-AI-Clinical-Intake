"""Voice layer schemas.

The MVP uses the browser Web Speech API for ASR/TTS. These schemas keep a
clean server-side seam so a multilingual ASR/TTS provider can be added later
without changing the frontend contract.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, Language
from app.schemas.interview import InterviewMessageOut


class VoiceTranscriptIn(ApiModel):
    session_id: UUID
    patient_id: UUID
    transcript: str = Field(min_length=1, max_length=4000, description="Raw ASR transcript from the client")
    language: Language | None = None
    is_final: bool = True
    forward_to_interview: bool = True


class VoiceTranscriptOut(ApiModel):
    session_id: UUID
    normalized_text: str
    language: str = Language.EN.value
    word_count: int = 0
    provider: str = "browser-web-speech"
    forwarded: bool = False
    interview: InterviewMessageOut | None = None


class VoiceSpeakIn(ApiModel):
    text: str = Field(min_length=1, max_length=4000)
    language: Language = Language.EN
    voice_hint: str | None = None


class VoiceSpeakOut(ApiModel):
    text: str
    language: str
    provider: str = "browser-speech-synthesis"
    # Placeholder for a future server-side TTS provider returning audio.
    audio_base64: str | None = None
    rate: float = 1.0
    pitch: float = 1.0
