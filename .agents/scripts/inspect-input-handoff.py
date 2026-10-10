from html.parser import HTMLParser
from pathlib import Path
import pymupdf

out = Path("/tmp/eduwai-input-handoff")
out.mkdir(exist_ok=True)
doc = pymupdf.open("attached_assets/EDUwAI-Input-Modes-Mobile-Handoff_1791602508615.pdf")
for i, page in enumerate(doc):
    text = page.get_text()
    print(f"Page {i + 1}: {len(text)} characters, {len(page.get_images())} images; {text[:90]!r}")
    if page.get_images():
        page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3)).save(out / f"page-{i + 1}.png")

class BodyText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_body = False
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag == "body":
            self.in_body = True
        if tag in ("section", "h1", "h2", "h3", "p", "li", "tr", "pre"):
            self.parts.append("\n")
    def handle_data(self, data):
        if self.in_body:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self.parts.append(" | ")
        if tag == "body":
            self.in_body = False

parser = BodyText()
parser.feed(Path("attached_assets/EDUwAI-Input-Modes-Mobile-Handoff_1791602508616.html").read_text())
(out / "handoff.txt").write_text("".join(parser.parts))
