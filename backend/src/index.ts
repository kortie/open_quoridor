import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import { initializeDatabase } from './db.js';
import authRouter from './routes/auth.js';
import gameRouter from './routes/game.js';
import leaderboardRouter from './routes/leaderboard.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/game', gameRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
