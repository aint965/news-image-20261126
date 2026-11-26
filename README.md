# THE WORLD TODAY — 26 November 2026

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/aint965/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/aint965/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

A program that draws a classic newspaper front page summing up the world
news of **Thursday 26 November 2026** and writes it as a 1024×1024 PNG.

`main.ts` (Node 22, standard library only, no network) renders the whole
page in code — an embedded 5×7 bitmap font, a hand-written PNG encoder
(CRC32 + zlib deflate) — and is fully deterministic: two runs write
byte-identical output.

## The stories

**Lead — US tariffs:** The Trump administration announces sweeping new
tariffs on 14 trading partners: +20% on Chinese goods (some to 45% in
total), 15% for the EU, Japan, South Korea and Taiwan, Brazil singled out
with a 10% duty on aircraft and higher sugar duties. Under Section 301;
public hearing 25 January; markets fell.

**The six stories:**

- **Cairo** — Fuel tanker crash ignites a huge fire on a highway around
  Cairo; at least 30 people killed.
- **Sudan** — Drone strikes in Blue Nile state kill 19 civilians.
- **Gaza** — An Israeli airstrike kills a senior Hamas official and his
  family.
- **Lebanon** — Lebanon plans a second international airport, at Kleiat.
- **North Korea** — North Korea expels a Swiss diplomat in a sanctions row.
- **Indonesia** — Nine miners dead after flooding at a gold mine.

**Footer:** Bangladesh raises garment workers' pay by 36%. Malaysia sues
Google for $146m over YouTube content. Britain moves military aircraft
over drone threats. Thanksgiving Day in the United States.

All stories were first reported Thursday 26 November 2026.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` (1024×1024, under 1 MiB).
