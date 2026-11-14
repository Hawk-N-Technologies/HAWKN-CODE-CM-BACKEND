"""
Turn a QR module matrix into a small, crisp SVG.

Kept separate from the qrcode library so it can be tested on its own.
No width/height is set: the SVG fills whatever box the label gives it,
and `crispEdges` keeps module edges sharp at any printer resolution.
"""
from html import escape


def matrix_to_svg(matrix, title="") -> str:
    size = len(matrix)
    parts = []
    for y, row in enumerate(matrix):
        x = 0
        while x < size:
            if row[x]:
                start = x
                while x < size and row[x]:
                    x += 1
                run = x - start
                parts.append(f"M{start} {y}h{run}v1h-{run}z")
            else:
                x += 1
    label = escape(title, quote=True)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'shape-rendering="crispEdges" role="img" aria-label="{label}">'
        f'<rect width="{size}" height="{size}" fill="#fff"/>'
        f'<path d="{"".join(parts)}" fill="#000"/></svg>'
    )
