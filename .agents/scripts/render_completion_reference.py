"""Render selected handoff pages for visual review; outputs stay outside Git."""
import argparse
from pathlib import Path
import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument("pdf")
parser.add_argument("--pages", nargs="+", type=int, default=[1, 9])
parser.add_argument("--output", default="/tmp/completion-reference")
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
with pymupdf.open(args.pdf) as document:
    for number in args.pages:
        page = document[number - 1]
        target = output / f"page-{number}.png"
        page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(target)
        print(target)
