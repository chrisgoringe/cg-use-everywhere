import re, sys
from pathlib import Path

version = "8.0.1"
files   = [r"js/shared.js", "pyproject.toml", "__init__.py"]
out_of_date = {}

for f in files:
    p = Path(f)
    out = []
    for line in p.read_text().splitlines(keepends=True):
        if "sync:version" in line:
            previous = re.search(r'"([^"]*)"', line)
            assert previous, f"No quoted value in {p.name}"
            listed_version = previous.group(1)
            if listed_version!=version:
                line = re.sub(listed_version, version, line, count=1)
                out_of_date[p.name] = listed_version
        out.append(line)

    if p.name in out_of_date:
        if "--check" not in sys.argv:
            p.write_text("".join(out))

if "--check" in sys.argv and out_of_date:
    sys.exit(f"Out of sync: {out_of_date}")