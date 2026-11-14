"""
Classify a raw QR value. Product and box formats never overlap:
    product: 6 digits, first digit 1-9      e.g. 483921
    box:     BOX- followed by 6+ digits      e.g. BOX-000001
"""
import re
from dataclasses import dataclass

PRODUCT_PATTERN = re.compile(r"^[1-9][0-9]{5}$")
BOX_PATTERN = re.compile(r"^BOX-[0-9]{6,}$")

PRODUCT = "PRODUCT"
BOX = "BOX"
INVALID = "INVALID"


@dataclass(frozen=True)
class ParsedScan:
    kind: str
    value: str


def parse_scan(raw_value) -> ParsedScan:
    value = "".join(str(raw_value or "").split()).upper()  # drop spaces/newlines from scanners
    if PRODUCT_PATTERN.fullmatch(value):
        return ParsedScan(PRODUCT, value)
    if BOX_PATTERN.fullmatch(value):
        return ParsedScan(BOX, value)
    return ParsedScan(INVALID, value[:32])
