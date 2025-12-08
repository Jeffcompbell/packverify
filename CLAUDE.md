# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PackVerify Pro is a React-based packaging design QA tool that uses AI vision models (Gemini 3 Pro via PackyAPI) to analyze packaging images for quality issues. It performs automated content verification, OCR text extraction, and compares image content against QIL (Quality Inspection List) specifications.

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
VITE_GEMINI_API_KEY=your_packyapi_key_here
VITE_OPENAI_API_KEY=your_zenmux_key_here  # For alternative models
```

The app supports multiple AI providers configured in `services/openaiService.ts`:
- **PackyAPI** (default): `https://api-slb.packyapi.com/v1` - Gemini 3 Pro
- **Zenmux**: `https://zenmux.ai/api/v1` - Gemini 2.5 Pro/Flash, GPT-4o

## Architecture

### Core Components

- **App.tsx** - Main orchestrator: manages images state, user authentication, cloud sync, coordinates AI analysis, handles global drag-drop/paste
- **IssuesPanel.tsx** - Right panel displaying detected issues with tabs for AI-detected and OCR text
- **InfiniteCanvas.tsx** - Zoomable/pannable canvas displaying images with overlay annotations for issues
- **LoginModal.tsx** / **QuotaModal.tsx** - User authentication and quota management
- **AllProductsPage.tsx** - Product/session history management

### Services (`services/`)

- **openaiService.ts** - All AI interactions:
  - `diagnoseImage()` - Single-pass analysis: OCR + issue detection + spec extraction in one API call
  - `analyzeImageSinglePass()` - Core analysis function with industry-specific rules
  - `runDeterministicChecks()` - Local rule-based checks (bracket matching, encoding errors)
  - `parseSourceText()` / `parseQILImage()` - Extract structured fields from text/image QIL
  - `localDiffSpecs()` - Local comparison without API calls
  - `INDUSTRY_RULES` - Industry-specific validation rules (cosmetics, food, pharma, general)
  - `AVAILABLE_MODELS` - Model configurations with baseURL and API key mappings

- **firebase.ts** - Cloud storage and sync:
  - User management: `getOrCreateUser()`, `getUserData()`
  - Session management: `getOrCreateSession()`, `loadSessionFromCloud()`
  - Image storage: `saveImageToCloud()`, `updateImageInCloud()`, `deleteImageFromCloud()`
  - Quota tracking: `useQuotaFirebase()`, `getQuotaUsageHistory()`

- **authService.ts** - Firebase authentication helpers

### Type System (`types.ts`)

Key types:
- `ImageItem` - Image with base64, specs, issues, deterministicIssues, diffs, rotation
- `DiagnosisIssue` - AI-detected issue with original text, problem, suggestion, severity, confidence, box_2d
- `DeterministicCheck` - Rule-based issue (bracket_mismatch, encoding_error, format_error)
- `DiffResult` - QIL comparison result (match/error/warning) with matchType
- `BoundingBox` - Normalized 0-1000 coordinate system for annotations
- `ImageSpec` / `SourceField` - Product specifications with key/value/category
- `IndustryType` - Industry classification (cosmetics, food, pharma, general)

### Data Flow

1. User uploads image → `processFile()` creates `ImageItem` with base64
2. `diagnoseImage()` performs single-pass AI analysis:
   - Step 1: AI vision analysis (OCR + issue detection + spec extraction)
   - Step 2: Local deterministic checks (bracket matching, encoding)
3. User inputs QIL data (text or image) → `parseSourceText()` or `parseQILImage()` extracts `SourceField[]`
4. `localDiffSpecs()` compares QIL fields against image specs locally (no API call)
5. Canvas renders overlays using normalized bounding boxes (0-1000 scale, divide by 10 for CSS %)
6. Cloud sync: All data saved to Firebase Storage + Firestore

### State Management

- **Local Storage**: Images, QIL fields, current index persisted via `utils/helpers.ts:STORAGE_KEY`
- **Cloud Sync**: Firebase Firestore for sessions, Firebase Storage for images
- **User State**: Firebase Auth with Google Sign-In, quota tracking per user
- **Session State**: Product name, images, QIL fields, analysis results

## Tech Stack

- React 19 + TypeScript
- Vite (dev server on port 3000)
- TailwindCSS (via CDN in index.html)
- OpenAI SDK (client-side with `dangerouslyAllowBrowser: true`) - used for OpenAI-compatible APIs
- Firebase (Authentication, Firestore, Storage)
- Lucide React icons

## Key Patterns

- **Path alias**: `@/*` maps to project root (configured in vite.config.ts)
- **Bounding boxes**: Use 0-1000 scale, converted to percentages for CSS positioning (divide by 10)
- **Global paste/drop handlers**: In App.tsx for image upload anywhere, context-aware (QIL vs main canvas)
- **Mobile-first UI**: Bottom navigation tabs for mobile, sidebar layout for desktop
- **Single-pass AI analysis**: One API call returns OCR + issues + specs to minimize latency and cost
- **Local diff computation**: QIL comparison done locally without API calls for instant feedback
- **Industry-specific validation**: Configurable rules in `INDUSTRY_RULES` for different packaging types
- **Deterministic checks**: 100% accurate rule-based validation runs locally after AI analysis

## Important Implementation Details

- **Coordinate system**: box_2d uses [ymin, xmin, ymax, xmax] format with 0-1000 normalized coordinates
- **JSON parsing**: `parseJSON()` handles both raw JSON and markdown-wrapped responses from different models
- **Model switching**: Users can switch between models; retry analysis uses current selected model
- **Quota system**: Each analysis consumes 1 quota unit, tracked in Firebase with usage history
- **Cloud sync**: Automatic sync to Firebase when user is logged in and `cloudSyncEnabled` is true
- **Image rotation**: Per-image rotation state stored in `ImageItem.rotation`
- **QIL input modes**: Supports both text input and image upload (up to 4 images) for QIL data
