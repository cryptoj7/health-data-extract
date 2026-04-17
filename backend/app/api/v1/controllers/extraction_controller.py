"""Controller for PDF upload + patient information extraction."""
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.order import OrderStatus
from app.schemas.extraction import ExtractionResponse
from app.schemas.order import OrderCreate
from app.repositories.order_repository import OrderRepository
from app.services.extraction import extract_patient_info
from app.services.pdf_text import extract_text_from_pdf, render_pdf_pages_to_png


class ExtractionController:
    @staticmethod
    async def extract_from_pdf(
        db: Session,
        file: UploadFile,
        create_order: bool = False,
    ) -> ExtractionResponse:
        settings = get_settings()

        # Validate content-type
        content_type = (file.content_type or "").lower()
        if content_type not in settings.allowed_upload_mime_type_list:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Unsupported file type '{content_type}'. "
                    f"Allowed: {', '.join(settings.allowed_upload_mime_type_list)}"
                ),
            )

        # Read with size limit
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        contents = await file.read(max_bytes + 1)
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum size of {settings.max_upload_size_mb} MB",
            )
        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
            )

        # Quick PDF magic-bytes check
        if not contents.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File does not appear to be a valid PDF",
            )

        try:
            text = extract_text_from_pdf(contents)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not read PDF contents: {e}",
            )

        # Render page images for vision fallback when text is empty (scanned PDFs).
        # Resolution and page-count are env-configurable so we can keep the memory
        # footprint small in serverless (Vercel: 1 GB / 30 s) while letting local
        # devs crank it up for sharper OCR on tiny print.
        page_pngs: list[bytes] = []
        if not text.strip() and settings.openai_api_key:
            try:
                page_pngs = render_pdf_pages_to_png(
                    contents,
                    max_pages=settings.vision_max_pages,
                    scale=settings.vision_render_scale,
                )
            except Exception:
                # Non-fatal — we still try the regex/text path
                page_pngs = []

        extracted = extract_patient_info(text, page_pngs=page_pngs)

        order_id: Optional[str] = None
        if create_order:
            if not extracted.first_name or not extracted.last_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        "Cannot create order: patient first or last name could not be extracted. "
                        "Re-upload with create_order=false to inspect the result, or create the "
                        "order manually."
                    ),
                )

            order_payload = OrderCreate(
                patient_first_name=extracted.first_name,
                patient_last_name=extracted.last_name,
                patient_dob=extracted.date_of_birth,
                status=OrderStatus.PENDING,
                source_document_name=file.filename,
                extraction_confidence=extracted.confidence,
            )
            order = OrderRepository(db).create(order_payload)
            order_id = order.id

        return ExtractionResponse(
            extracted=extracted,
            raw_text_preview=(text or "")[:500],
            order_id=order_id,
        )
