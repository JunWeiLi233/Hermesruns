# /auto-hermes-find-shoe

Research and categorize new running shoe models into the Hermes catalog.

## Goals
- Maintain a modern, up-to-date shoe database for the Coach recommendation engine.
- Leverage real-world sentiment from Reddit and YouTube experts.
- Ensure strict data quality (Running shoes only).

## Instructions for the Agent

### 1. Research phase
Use `google_web_search` with specific queries like:
- `site:reddit.com/r/RunningShoeGeeks best new daily trainers 2026`
- `trending running shoes youtube reviews 2026`
- `site:youtube.com "Believe in the Run" latest shoe reviews`

### 2. Extraction phase
Identify:
- **Brand**: (e.g., ASICS, Nike,李宁)
- **Model**: (e.g., Novablast 5)
- **Category**: (Chinese label like '综训', '竞速', '缓震')
- **Type**: (`daily`, `race`, `speed`, `stability`, `trail`)

### 3. File Update phase
Locate `frontend/src/data/shoeCatalog.js`.
Add new models to the existing `brand` arrays or create a new `brand` if missing.

### 4. Verification
Run `npm run lint` in the `frontend` directory.

## Example Output Format
Found 3 new shoes:
- **Brand**: Saucony | **Model**: Endorphin Speed 5 | **Type**: speed
- **Brand**: Nike | **Model**: Pegasus 42 | **Type**: daily
- **Brand**: HOKA | **Model**: Tecton X 3 | **Type**: trail
Updating shoeCatalog.js...
DONE.
