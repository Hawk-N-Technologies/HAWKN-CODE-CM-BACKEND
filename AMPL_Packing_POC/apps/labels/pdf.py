"""
Box label as a PDF whose page is exactly 100 mm x 50 mm (landscape).

A web page cannot force a printer's paper size (phones print on A4 by
default), but a PDF carries its own page size, so label-printer apps and
drivers print it 1:1. Written by hand (no PDF library): one page, the QR as
filled squares, text in the PDF's built-in fonts.

Layout in mm, measured from the top-left corner (same as the print page):
    QR code            46 x 46, left 2, top 2 (includes its white quiet zone)
    text column        from 49 to 96 (4 mm right margin)
"""

MM = 72 / 25.4  # PDF points per millimetre
LABEL_W_MM, LABEL_H_MM = 100, 50
QR_LEFT_MM, QR_TOP_MM, QR_SIZE_MM = 2, 2, 46
TEXT_LEFT_MM, TEXT_RIGHT_MM = 49, 96

# Helvetica widths (1/1000 em) for printable ASCII 32..126, from the standard AFM.
_HELVETICA = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
_FONTS = {"F1": "Helvetica", "F2": "Helvetica-Bold", "F3": "Courier-Bold"}


def _ascii(text) -> str:
    return "".join(ch if 32 <= ord(ch) < 127 else "?" for ch in str(text))


def _width_pt(text: str, size: float, font: str) -> float:
    if font == "F3":  # Courier: every character is 600/1000 em
        return len(text) * 0.6 * size
    widths = sum(_HELVETICA[ord(ch) - 32] for ch in text)
    return widths / 1000 * size * (1.1 if font == "F2" else 1)  # bold is about 10% wider


def fit(text, size: float, font: str, max_pt: float) -> str:
    """Shorten with '...' so the line never runs past the label edge."""
    text = _ascii(text)
    if _width_pt(text, size, font) <= max_pt:
        return text
    while text and _width_pt(text + "...", size, font) > max_pt:
        text = text[:-1]
    return text + "..."


def _pdf_string(text: str) -> str:
    return "(" + text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"


def _qr_ops(matrix) -> list:
    """One filled rectangle per horizontal run of dark modules."""
    size = len(matrix)
    module = QR_SIZE_MM * MM / size
    left = QR_LEFT_MM * MM
    page_h = LABEL_H_MM * MM
    ops = ["0 g"]
    for row_index, row in enumerate(matrix):
        y = page_h - QR_TOP_MM * MM - (row_index + 1) * module
        col = 0
        while col < size:
            if row[col]:
                start = col
                while col < size and row[col]:
                    col += 1
                ops.append(f"{left + start * module:.3f} {y:.3f} {(col - start) * module:.3f} {module:.3f} re")
            else:
                col += 1
    ops.append("f")
    return ops


def box_label_pdf(*, matrix, box_uid, config_label, total_items, section_code, date_text) -> bytes:
    page_w, page_h = LABEL_W_MM * MM, LABEL_H_MM * MM
    max_pt = (TEXT_RIGHT_MM - TEXT_LEFT_MM) * MM
    # (font, size pt, baseline mm from the top, text)
    lines = [
        ("F1", 8, 11, "BOX ID"),
        ("F3", 16, 18.5, box_uid),
        ("F1", 11, 25, config_label),
        ("F2", 13, 31, f"{total_items} pcs"),
        ("F1", 11, 36.5, f"Section {section_code}"),
        ("F1", 10, 41.5, date_text),
    ]
    ops = ["1 g", f"0 0 {page_w:.3f} {page_h:.3f} re f"]  # white background
    ops += _qr_ops(matrix)
    ops.append("0 g")
    for font, size, baseline_mm, text in lines:
        if not text:
            continue
        shown = fit(text, size, font, max_pt)
        ops.append(
            f"BT /{font} {size} Tf {TEXT_LEFT_MM * MM:.3f} {page_h - baseline_mm * MM:.3f} Td "
            f"{_pdf_string(shown)} Tj ET"
        )
    content = "\n".join(ops).encode("ascii")

    objects = [
        # 1: catalog; PrintScaling None asks viewers not to shrink or enlarge the page when printing
        b"<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w:.3f} {page_h:.3f}] "
            f"/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>"
        ).encode("ascii"),
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream",
    ]
    for key in ("F1", "F2", "F3"):
        objects.append(
            f"<< /Type /Font /Subtype /Type1 /BaseFont /{_FONTS[key]} /Encoding /WinAnsiEncoding >>".encode("ascii")
        )
    objects.append(f"<< /Title {_pdf_string(_ascii(box_uid))} /Producer (AMPL Packing) >>".encode("ascii"))

    out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii")
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info {len(objects)} 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)
