# Weather Data Accuracy Strategy for Hermes

## Key recommendation
Use Open-Meteo as the default global weather layer, omit `models` so the API uses its default auto / Best Match selector, and improve point accuracy with precise `latitude`, `longitude`, `elevation`, and `cell_selection=land` unless the use case is marine or nearest-grid specific. Treat the response as a model-based forecast, not a station observation, and disclose Open-Meteo CC BY 4.0 attribution plus the relevant upstream source attribution when elevation data is involved.

## Findings

1. A single official government API can cover the whole world, but it is not the same as having one official national forecast model for every country.
   - MET Norway’s Locationforecast says it provides weather forecasts for “the whole world” / “any location on earth” and up to nine days ahead.
   - NOAA/NWS is a U.S. government API, so it is not the universal global alternative.
   - Inference: there is no one national-service API that gives Hermes each country’s own official model everywhere; the closest global official-government option I found is MET Norway, but Open-Meteo still gives broader model aggregation.
   - Sources:
     - [MET Norway Locationforecast HOWTO](https://api.met.no/doc/locationforecast/HowTO)
     - [MET Norway Locationforecast documentation](https://api.met.no/weatherapi/locationforecast/2.0/documentation)
     - [NOAA / NWS API documentation](https://www.weather.gov/documentation/services-web-api)

2. Open-Meteo Best Match does automatically choose the most appropriate model per location, but it is not a promise that every point uses that country’s own official national model.
   - Open-Meteo says it combines weather output from multiple national weather services and automatically selects the highest-resolution applicable model for each location.
   - Its model pages also say the default Best Match provides the best forecast for any given location worldwide.
   - Inference: the integrated set includes both local national models and global models, so Best Match is a selector across that pool rather than “always the local government model.”
   - Sources:
     - [Open-Meteo Forecast docs](https://open-meteo.com/en/docs)
     - [Open-Meteo model updates](https://open-meteo.com/en/docs/model-updates)
     - [Open-Meteo MET Norway API page](https://open-meteo.com/en/docs/metno-api)

3. The query parameters that materially affect forecast/location fidelity are `latitude`, `longitude`, `elevation`, `cell_selection`, and sometimes `models`.
   - `latitude` and `longitude` are the primary location inputs; use the most precise coordinates you have.
   - `elevation` is used for statistical downscaling. Open-Meteo says the default is a 90 m DEM; setting `elevation=nan` disables downscaling.
   - `cell_selection=land` is the default and chooses a land grid cell with similar elevation. `sea` prefers sea grid cells, and `nearest` picks the nearest cell.
   - Auto / Best Match is the default when `models` is omitted; manually setting `models` is for forcing or comparing specific model families, not usually for maximizing general accuracy. Hermes' live API check on 2026-08-08 found that sending the literal value `models=auto` is rejected, so the application intentionally omits it.
   - `timezone=auto` improves local time alignment, but it does not change the forecast itself.
   - Sources:
     - [Open-Meteo Forecast docs](https://open-meteo.com/en/docs)

4. Hermes should state a few operational limitations explicitly.
   - The returned grid-cell center may be a few kilometres away from the requested coordinate.
   - Open-Meteo’s servers are eventually consistent; the docs recommend waiting about 10 minutes after a model update for the most recent forecast to be fully available everywhere.
   - Model coverage, spatial resolution, forecast horizon, update frequency, and available variables vary by model and region.
   - For exact archived issue-time forecasts, Open-Meteo points to its Historical Forecast API and Single Runs API rather than Best Match.
   - Sources:
     - [Open-Meteo Forecast docs](https://open-meteo.com/en/docs)
     - [Open-Meteo model updates](https://open-meteo.com/en/docs/model-updates)

5. Hermes should include Open-Meteo attribution, and if it uses elevation-aware data it should also acknowledge Copernicus.
   - Open-Meteo states its API data are under CC BY 4.0 and that attribution is required.
   - The Elevation API says all users of Open-Meteo data must provide clear attribution to the Copernicus program and a reference to Open-Meteo.
   - Practical copy: “Weather data via Open-Meteo (CC BY 4.0). Elevation data via Copernicus DEM / Open-Meteo.”
   - Sources:
     - [Open-Meteo home](https://open-meteo.com/)
     - [Open-Meteo licence](https://open-meteo.com/en/license)
     - [Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api)

## Short version for product copy
“Weather forecasts are provided by Open-Meteo using model data from national and global weather services. Forecasts are model-based estimates, may differ from the exact requested coordinate by a few kilometres, and can update with a short delay after model release. Weather data are licensed under CC BY 4.0; elevation data, where used, are based on Copernicus DEM.”
