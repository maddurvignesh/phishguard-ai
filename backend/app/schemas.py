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


class FeatureSimulationInput(BaseModel):
    """Payload for POST /predict/simulate (What-if analysis)."""

    features: dict[str, float] = Field(
        ..., description="Feature vector to score (typically the observed "
                         "features with one or two edited values)."
    )
    model: str | None = Field(
        None, description="Optional model name (defaults to the deployed best model)."
    )


class HistoryParams(BaseModel):
    limit: int = Field(20, ge=1, le=100)