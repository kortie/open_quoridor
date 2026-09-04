# Quoridor AI with Claude Haiku - Setup Guide

This guide explains how to set up the AI opponent using Claude Haiku for your Quoridor game.

## Overview

The AI opponent has been upgraded to use **Claude Haiku** (Anthropic's fast and affordable model) for difficulty levels:
- **Easy**: Rule-based random moves (no API needed)
- **Normal**: Claude Haiku with basic strategy
- **Hard**: Claude Haiku with strategic wall placement
- **VeryHard / Expert**: Claude Haiku with advanced planning

## Architecture

The AI logic has been split into frontend and backend:
- **Frontend** (`game/src/utils/aiLogic.ts`): Handles Easy mode, calls backend API for other modes
- **Backend** (`backend/src/services/aiService.ts`): Handles LLM calls to Claude Haiku

This design keeps your API key secure on the backend.

## Setup Steps

### 1. Get Your API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign in with your account or create one
3. Navigate to **API Keys** section
4. Create a new API key (you can use your account: `isaac2.lee@ax.samsung.com`)
5. Copy the API key (keep it safe!)

### 2. Configure Backend

1. In the `backend` directory, create a `.env` file (copy from `.env.example`):
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXXXXXXXXXXXXX
   ```

3. Make sure other required variables are set:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/quoridor
   JWT_SECRET=your_jwt_secret_key_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
   ```

### 3. Install and Run Backend

```bash
cd backend
npm install
npm run dev
```

The backend should start on `http://localhost:3001`.

### 4. Configure Frontend

1. In the `game` directory, create a `.env` file (copy from `.env.example`):
   ```bash
   cd game
   cp .env.example .env
   ```

2. The frontend `.env` should have:
   ```
   VITE_KAKAO_APP_ID=your_kakao_app_id_here
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

The frontend should be available at `http://localhost:5173`.

## Testing

1. Start a game against any difficulty level
2. Watch the AI make decisions based on Claude Haiku:
   - Easy mode will make random moves quickly
   - Normal/Hard/VeryHard modes will call the backend, which consults Claude Haiku

## AI Difficulty Levels Explained

### Easy
- **Strategy**: 80% random piece moves, 20% random wall placement
- **Speed**: Instant (no API call)
- **Cost**: Free

### Normal
- **Strategy**: Claude Haiku analyzes board and suggests reasonable moves
- **Prompt**: Standard Quoridor strategy tips
- **Cost**: ~0.01 USD per move (Haiku is very cheap)

### Hard
- **Strategy**: Claude Haiku focuses on strategic wall placement to block opponents
- **Prompt**: Enhanced with "Analyze positions carefully. Prioritize wall placement to block opponent."
- **Cost**: ~0.01 USD per move

### VeryHard / Expert
- **Strategy**: Claude Haiku uses advanced planning and opponent prediction
- **Prompt**: "Use advanced strategy. Predict opponent's moves and place walls to maximize their detour distance while minimizing your own."
- **Cost**: ~0.01 USD per move

## Costs

Claude Haiku pricing (as of August 2026):
- Input: **$1.00 per 1M tokens**
- Output: **$5.00 per 1M tokens**

Each Quoridor move request costs approximately **0.005-0.01 USD** depending on board complexity.

## Troubleshooting

### Backend not connecting to Claude
- Check that `ANTHROPIC_API_KEY` is set correctly in `backend/.env`
- Verify the API key is valid (hasn't expired)
- Check backend logs: `npm run dev` should show any API errors

### Frontend not connecting to backend
- Ensure backend is running on port 3001
- Check `VITE_API_BASE_URL` in `game/.env` is correct
- Check browser console for CORS errors

### API Key Errors
- `401 Unauthorized`: Invalid API key
- `rate_limit_exceeded`: Too many requests (unlikely for single player)
- `invalid_request_error`: Issue with request format (check backend logs)

## Performance Notes

- Easy mode (random): < 10ms
- Normal/Hard/VeryHard (LLM): 1-3 seconds (includes API latency)
- Consider adding a loading spinner while AI thinks on Normal+ modes

## Security Notes

- **Never commit `.env` files** to git - they contain your API key
- The `.env` files are in `.gitignore` by default
- API key is only used on the backend, not exposed to frontend
- You can rotate your API key at any time from the Anthropic Console

## Next Steps

1. **Monitor costs**: Track API usage in [Anthropic Dashboard](https://console.anthropic.com/dashboard/usage)
2. **Optimize prompts**: Adjust system prompts in `backend/src/services/aiService.ts` for different play styles
3. **Add analytics**: Log AI moves and effectiveness for future improvements
4. **Deploy**: When ready, deploy to production (remember to set `ANTHROPIC_API_KEY` in your environment)

## Support

For issues with:
- Claude API: Check [Anthropic Documentation](https://docs.anthropic.com/)
- Game logic: Check `game/src/utils/gameLogic.ts`
- Backend setup: Check backend README.md

---

Happy gaming! 🎮
