# Roger - AI Running Coach

A Strava-aware conversational running coach built with Next.js. The app provides personalized running recommendations based on your training history and goal race.

## Features

- **Conversational Interface**: ChatGPT-like chat interface for natural interaction
- **Data-Driven Recommendations**: Uses your recent Strava runs to suggest next workouts
- **KPI Dashboard**: Track days to goal, weekly mileage, predicted race time, and confidence
- **Smart Validation**: Ensures all recommendations are realistic and safe
- **Single Reasoning Path**: All coaching logic flows through `lib/coachEngine/`

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- OpenAI API (GPT-4o-mini)
- Jest for testing

## Getting Started

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Then edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. **Run the development server:**
```bash
npm run dev
```

4. **Open your browser:**
Navigate to [http://localhost:3000/chat](http://localhost:3000/chat)

## Running Tests

```bash
npm test
```

## Project Structure

```
├── app/
│   ├── api/chat/route.ts    # Chat API endpoint
│   ├── chat/page.tsx         # Chat UI with KPI strip
│   └── layout.tsx            # Root layout
├── lib/
│   ├── coachEngine/          # Single canonical reasoning path
│   │   ├── index.ts          # Main coach engine
│   │   ├── promptBuilder.ts  # Builds prompts for OpenAI
│   │   └── validator.ts      # Validates and sanitizes responses
│   ├── metrics/              # Training metrics calculations
│   └── types.ts              # TypeScript type definitions
├── data/
│   └── stravaMock.json       # Mock Strava data (seeded runs)
└── __tests__/                # Unit tests
```

## How It Works

1. **User sends a message** via the chat interface
2. **API loads recent runs** from mock data (or DB in production)
3. **Metrics are calculated** (weekly mileage, pace distribution, trends)
4. **Coach engine generates response** using OpenAI with structured prompt
5. **Response is validated** and sanitized to ensure safety
6. **KPIs are updated** and displayed in the UI

## Coach Engine Contract

**Input:**
```typescript
{
  goal: { raceDate, distance, targetTime },
  runs: Run[],
  userNotes?: string
}
```

**Output:**
```typescript
{
  assistantMessage: string,
  recommendedNextRun: {
    type: "easy|tempo|interval|long|rest",
    distanceMiles: number,
    paceRangeMinPerMile: [number, number],
    notes: string
  },
  kpis: {
    daysToGoal: number,
    weeklyMiles7d: number,
    predictedTimeMinutes: number,
    confidence: "low|medium|high"
  }
}
```

## Validation Rules

- Distance: 0-30 miles
- Pace range: 5.0-14.0 min/mi, must be increasing
- Predicted time: Must be plausible for distance
- Insufficient data: Recommends conservative easy run/rest

## Notes

- Strava data is currently mocked via `data/stravaMock.json`
- For production, replace mock data loading with database queries
- OAuth integration for real Strava data can be added later
