"""
Document Preprocessing Service for AI Verification.

Normalizes image resolution, converts PDF pages to images, applies grayscale,
contrast enhancement (CLAHE), noise reduction, and deskewing for optimal OCR.

IMPORTANT: The original uploaded document bytes are NEVER modified — preprocessing
only produces clean transient in-memory images for OCR analysis.
"""

import io
import logging
from typing import List, Tuple
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger("securevault.document_preprocessing")

# Try importing OpenCV & pdf2image
CV2_AVAILABLE = False
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    logger.warning("OpenCV/numpy not available. Preprocessing will use PIL fallback.")

PDF2IMAGE_AVAILABLE = False
try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    logger.warning("pdf2image not available. PDF conversion will attempt basic image load.")


def convert_document_to_images(file_bytes: bytes, mime_type: str) -> List[Image.Image]:
    """
    Convert raw uploaded file bytes (PDF, PNG, JPEG) into a list of PIL Images.
    For PDF, each page becomes a separate image.
    """
    is_pdf = mime_type.lower() == "application/pdf" or file_bytes.startswith(b"%PDF")
    
    if is_pdf:
        if PDF2IMAGE_AVAILABLE:
            try:
                images = convert_from_bytes(file_bytes, dpi=200)
                if images:
                    return images
            except Exception as e:
                logger.error(f"pdf2image conversion failed: {e}. Falling back to basic load.")
        
        # Fallback if pdf2image fails or is missing
        try:
            img = Image.open(io.BytesIO(file_bytes))
            return [img]
        except Exception as e:
            logger.error(f"Failed to load PDF as single image: {e}")
            return []
    else:
        # Standard image (PNG/JPEG/WEBP)
        try:
            img = Image.open(io.BytesIO(file_bytes))
            if img.mode != "RGB":
                img = img.convert("RGB")
            return [img]
        except Exception as e:
            logger.error(f"Failed to open image file: {e}")
            return []


def preprocess_image_cv2(pil_img: Image.Image) -> Tuple[Image.Image, dict]:
    """
    Apply OpenCV preprocessing:
      - Resizing / resolution normalization
      - Grayscale conversion
      - Noise reduction (Gaussian blur)
      - Contrast enhancement (CLAHE)
      - Deskewing angle correction
    Returns preprocessed PIL image and metadata dictionary.
    """
    if not CV2_AVAILABLE:
        return preprocess_image_pil(pil_img)

    meta = {"preprocessed": True, "engine": "OpenCV"}
    try:
        # Convert PIL -> OpenCV (BGR)
        img_np = np.array(pil_img)
        if len(img_np.shape) == 3 and img_np.shape[2] == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        elif len(img_np.shape) == 3 and img_np.shape[2] == 4:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGBA2GRAY)
        else:
            gray = img_np

        meta["original_size"] = [img_np.shape[1], img_np.shape[0]]

        # 1. Normalize resolution if too small/large
        h, w = gray.shape[:2]
        target_w = 1600
        if w < 800 or w > 3000:
            scale = target_w / float(w)
            gray = cv2.resize(gray, (target_w, int(h * scale)), interpolation=cv2.INTER_CUBIC)
            meta["rescaled"] = True

        # 2. Denoise
        denoised = cv2.GaussianBlur(gray, (3, 3), 0)

        # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)

        # 4. Simple Deskewing check via minAreaRect
        try:
            thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) > 0:
                angle = cv2.minAreaRect(coords)[-1]
                if angle < -45:
                    angle = -(90 + angle)
                else:
                    angle = -angle
                if abs(angle) > 0.5 and abs(angle) < 15.0:
                    (h, w) = enhanced.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    enhanced = cv2.warpAffine(enhanced, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                    meta["deskew_angle"] = round(float(angle), 2)
        except Exception as e:
            logger.debug(f"Deskew calculation skipped: {e}")

        # Convert back to PIL
        processed_pil = Image.fromarray(enhanced).convert("RGB")
        return processed_pil, meta

    except Exception as e:
        logger.error(f"CV2 preprocessing error: {e}. Falling back to PIL.")
        return preprocess_image_pil(pil_img)


def preprocess_image_pil(pil_img: Image.Image) -> Tuple[Image.Image, dict]:
    """
    Pure PIL fallback for preprocessing when OpenCV is unavailable.
    """
    meta = {"preprocessed": True, "engine": "PIL"}
    try:
        # Grayscale
        gray = pil_img.convert("L")
        
        # Contrast & Sharpening
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.5)
        sharpened = enhanced.filter(ImageFilter.SHARPEN)

        return sharpened.convert("RGB"), meta
    except Exception as e:
        logger.error(f"PIL preprocessing error: {e}")
        return pil_img, {"preprocessed": False, "error": str(e)}


def preprocess_document_for_ocr(file_bytes: bytes, mime_type: str) -> List[Tuple[Image.Image, dict]]:
    """
    Full document preprocessing pipeline.
    Accepts raw file bytes, returns list of (processed_image, metadata) tuples for each page.
    """
    raw_images = convert_document_to_images(file_bytes, mime_type)
    results = []
    for idx, raw_img in enumerate(raw_images):
        processed_img, meta = preprocess_image_cv2(raw_img)
        meta["page_number"] = idx + 1
        results.append((processed_img, meta))
    return results
