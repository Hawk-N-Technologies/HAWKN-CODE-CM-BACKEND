"""
QR codes for labels, generated on demand from the identifier (never stored).

Payload is exactly the identifier: "483921" for a product, "BOX-000001" for
a box. Error correction level M. Both fit in a version-1 QR (21 x 21
modules) plus a 4-module quiet zone = 29 x 29.
"""
import qrcode
from qrcode.constants import ERROR_CORRECT_M

from .svg import matrix_to_svg

QUIET_ZONE = 4


def qr_svg(data: str) -> str:
    code = qrcode.QRCode(
        version=None, error_correction=ERROR_CORRECT_M, box_size=1, border=QUIET_ZONE
    )
    code.add_data(data)
    code.make(fit=True)
    return matrix_to_svg(code.get_matrix(), title=data)
