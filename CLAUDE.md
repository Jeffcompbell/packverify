# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PackVerify Pro is a React-based packaging design QA tool that uses AI (GPT-4o via OpenAI API) to analyze packaging images for pre-press issues. It performs automated 8-point pre-flight checks and compares image content against source specifications.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run preview    # Preview production build
```

## Environment Setup

Create `.env.local` with:
```
VITE_OPENAI_API_KEY=your_api_key_here
```

The app uses a custom OpenAI-compatible endpoint (zenmux.ai) configured in `services/openaiService.ts`.

## Architecture

### Core Components

- **App.tsx** - Main orchestrator: manages images state, coordinates AI analysis, handles global drag-drop/paste
- **InfiniteCanvas.tsx** - Zoomable/pannable canvas displaying multiple images with overlay annotations for issues and diffs
- **InspectorSidebar.tsx** - Right panel for source text input and analysis results
- **ImageSidebar.tsx** - Left panel thumbnail strip for image management
- **FloatingToolbar.tsx** - Canvas controls (zoom, layers, reset)

### Services (`services/`)

- **openaiService.ts** - All AI interactions:
  - `diagnoseImage()` - 8-point pre-flight analysis returning `DiagnosisIssue[]`
  - `parseSourceText()` - Extracts structured fields from specification text
  - `performSmartDiff()` - Compares source fields against image content
  - `fileToGenerativePart()` - Converts File to base64 for API

### Type System (`types.ts`)

Key types:
- `ImageItem` - Image with associated issues and diffs
- `DiagnosisIssue` - Issue with type, severity, bounding box
- `DiffResult` - Comparison result (match/error/warning)
- `BoundingBox` - Normalized 0-1000 coordinate system for annotations
- `IssueType` - 8 categories: file_setting, font, image_quality, color, bleed, content, annotation, format, compliance

### Data Flow

1. User uploads image → `processFile()` creates `ImageItem` with base64
2. `diagnoseImage()` returns issues with bounding boxes
3. User pastes source text → `parseSourceText()` extracts `SourceField[]`
4. `performSmartDiff()` compares fields against image
5. Canvas renders overlays using normalized bounding boxes (divide by 10 for percentage positioning)

## Tech Stack

- React 19 + TypeScript
- Vite (dev server on port 3000)
- TailwindCSS (via CDN in index.html)
- OpenAI SDK (client-side with `dangerouslyAllowBrowser: true`)
- Lucide React icons

## Key Patterns

- Path alias: `@/*` maps to project root
- Bounding boxes use 0-1000 scale, converted to percentages for CSS positioning
- Global paste/drop handlers in App.tsx for image upload anywhere
- Multiple images displayed in 4-column grid on canvas
