# PackVerify Pro

AI-powered packaging design quality assurance tool that automatically detects content errors, performs OCR text extraction, and compares against QIL specifications.

## Features

- **Multi-Model AI Analysis**: Support for Gemini 3 Pro, GPT-4o, GPT-4.1, and GPT-5.1
- **Automated Quality Checks**: Vision analysis + OCR + deterministic rule validation
- **QIL Comparison**: Compare packaging content against Quality Inspection Lists
- **Industry-Specific Rules**: Specialized validation for cosmetics, food, pharma, and general products
- **Cloud Sync**: Firebase-based session management and image storage
- **Multi-Image Support**: Batch analysis with per-image model selection
- **Visual Annotations**: Bounding box overlays for detected issues

## Tech Stack

- React 19 + TypeScript
- Vite
- TailwindCSS
- Firebase (Auth, Firestore, Storage)
- OpenAI SDK (for API compatibility)

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env.local`:
   ```
   VITE_GEMINI_API_KEY=your_packyapi_key
   VITE_OPENAI_API_KEY=your_zenmux_key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

- `App.tsx` - Main application orchestrator
- `components/` - React components (IssuesPanel, InfiniteCanvas, QilPanel, etc.)
- `services/` - API services (openaiService, firebase, authService)
- `types.ts` - TypeScript type definitions
- `utils/` - Helper functions

## API Configuration

The app supports multiple AI providers configured in `services/openaiService.ts`:

- **PackyAPI** (default): Gemini 3 Pro via `https://api-slb.packyapi.com/v1`
- **Zenmux**: GPT models via `https://zenmux.ai/api/v1`

## License

MIT
