# Regional land-cover layer

ESA WorldCover 2021 v200 satellite land-cover classes, downsampled with categorical mode from 10 m source data to a 0.001-degree grid (about 80–111 m in this region). Coverage: 30–34°N, 34–36°E. This is historical broad land cover, not current vegetation condition, plant species, or live fuel moisture.

The fixed 8 MB grid compresses to about 600 KB. Browsers download the same regional file regardless of fire location, verify its checksum, classify locally and render Leaflet canvas tiles locally. No coordinates or viewport requests are sent to a land-cover provider. Missing cells and points outside coverage remain unknown.

Nearby percentages summarize a five-by-five display-cell sample (roughly 500 m), not a field survey. The point class represents a majority class in one display cell, not a 10 m point measurement.

Rebuild from complete public source tiles listed in metadata.json:

```
python maps/landcover/build-grid.py --source-dir /path/to/public-source-tiles
```

Source tiles must be named N30E033.tif and N33E033.tif. Python dependencies: numpy and rasterio.

© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium.
Source: https://esa-worldcover.org/en/data-access
License: CC BY 4.0. https://creativecommons.org/licenses/by/4.0/

The displayed fire-spread potential is the application's relative weather/land-cover heuristic. It is not a validated rate-of-spread model, measured movement, or perimeter forecast; no metres/minute are inferred from these inputs.
