"""Schemas for the document extraction endpoint."""
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class PatientExtraction(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    confidence: str = Field(default="low", description="One of: high, medium, low")
    source: str = Field(default="regex", description="Extraction source: 'llm' or 'regex'")


class ExtractionResponse(BaseModel):
    extracted: PatientExtraction
    raw_text_preview: str = Field(default="", description="First 500 chars of extracted document text")
    order_id: Optional[str] = Field(
        default=None, description="If create_order=true, the id of the persisted order"
    )
