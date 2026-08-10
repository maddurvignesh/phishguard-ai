"""
schemas.py — Pydantic request/response models for the API.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .config import MAX_URL_LENGTH, MIN_URL_LENGTH


class URLInput(BaseModel):
    """Payload for POST /predict."""

    url: str = Field(
        ...,
        min_length=MIN_URL_LENGTH,
        max_length=MAX_URL_LENGTH,
        description="The website URL to analyze",
        examples=["https://example.com"],
    )


class BulkURLInput(BaseModel):
    """Optional array input for POST /predict/batch."""

    urls: list[URLInput] = Field(..., max_length=50)


class HistoryParams(BaseModel):
    limit: int = Field(20, ge=1, le=100)