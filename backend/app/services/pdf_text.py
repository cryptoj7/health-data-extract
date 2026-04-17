"""Extract content from a PDF byte stream.

Two modes:
  - extract_text_from_pdf: returns text (good for digital PDFs)
  - render_pdf_pages_to_png: returns PNG bytes per page (used for scanned/image PDFs
    so they can be passed to a vision LLM)
"""
import io
import logging
from typing import List

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text using pdfplumber, with pypdf as a fallback."""
    text = ""
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                try:
                    pages.append(page.extract_text() or "")
                except Exception as e:  # pragma: no cover
                    logger.warning("pdfplumber page extract failed: %s", e)
            text = "\n".join(pages).strip()
    except Exception as e:
        logger.warning("pdfplumber extraction failed, falling back to pypdf: %s", e)

    if text:
        return text

    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception as e:  # pragma: no cover
                logger.warning("pypdf page extract failed: %s", e)
        text = "\n".join(pages).strip()
    except Exception as e:
        logger.error("pypdf extraction failed: %s", e)
        raise

    return text


def render_pdf_pages_to_png(
    pdf_bytes: bytes, *, max_pages: int = 4, scale: float = 2.0
) -> List[bytes]:
    """Render PDF pages to PNG bytes using pypdfium2 (pure-python wheel; works in serverless).

    Args:
        max_pages: cap on pages rendered (cost / latency control for vision models)
        scale: render scale (1.0 = 72 DPI; 2.0 ~= 144 DPI which is good for OCR)
    """
    try:
        import pypdfium2 as pdfium  # type: ignore
    except ImportError:  # pragma: no cover
        logger.error("pypdfium2 not available; cannot render PDF pages")
        return []

    pages_png: List[bytes] = []
    pdf = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
    try:
        for i in range(min(len(pdf), max_pages)):
            page = pdf[i]
            try:
                pil_image = page.render(scale=scale).to_pil()
                buf = io.BytesIO()
                pil_image.save(buf, format="PNG", optimize=True)
                pages_png.append(buf.getvalue())
            finally:
                page.close()
    finally:
        pdf.close()

    return pages_png
