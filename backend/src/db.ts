import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function initializeDatabase() {
  try {
    const client = await pool.connect();

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        kakao_id BIGINT UNIQUE NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        profile_image VARCHAR(255),
        email VARCHAR(100),
        total_games INT DEFAULT 0,
        total_wins INT DEFAULT 0,
        total_points INT DEFAULT 0,
        current_streak INT DEFAULT 0,
        best_streak INT DEFAULT 0,
        elo_rating INT DEFAULT 1600,
        last_game_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create game_records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_records (
        id SERIAL PRIMARY KEY,
        player_id INT NOT NULL REFERENCES users(id),
        ai_level VARCHAR(20) NOT NULL,
        winner VARCHAR(10) NOT NULL,
        player_walls_used INT,
        ai_walls_used INT,
        total_moves INT,
        game_duration INT,
        points_earned INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
      CREATE INDEX IF NOT EXISTS idx_game_records_player_id ON game_records(player_id);
      CREATE INDEX IF NOT EXISTS idx_game_records_created_at ON game_records(created_at DESC);
    `);

    client.release();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export default pool;
