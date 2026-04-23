import dotenv from 'dotenv'
dotenv.config()
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initializeDatabase, pool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const SECRET_KEY = process.env.SECRET_KEY || 'SecretKey';

app.use(cors());
app.use(express.json());

// jwn token
function createToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
}

//User inf
async function findUserByUsername(username) {
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        COALESCE(s.plays, 0) AS plays,
        COALESCE(s.wins, 0) AS wins,
        COALESCE(s.current_streak, 0) AS current_streak,
        COALESCE(s.best_streak, 0) AS best_streak,
        s.last_played_at
      FROM users u
      LEFT JOIN user_stats s ON s.user_id = u.id
      WHERE u.username = $1
    `,
    [username]
  );

  return rows[0] || null;
}

// Rebuilds the current user's profile from the database using the id from the token.
async function getUserProfileById(userId) {
  // Used after token validation to rebuild the current user from the database.
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        COALESCE(s.plays, 0) AS plays,
        COALESCE(s.wins, 0) AS wins,
        COALESCE(s.current_streak, 0) AS current_streak,
        COALESCE(s.best_streak, 0) AS best_streak,
        s.last_played_at
      FROM users u
      LEFT JOIN user_stats s ON s.user_id = u.id
      WHERE u.id = $1
    `,
    [userId]
  );

  return rows[0] || null;
}

// Rnadom word fetch
async function getRandomWord() {
  const { rows } = await pool.query(
    `
      SELECT word
      FROM wordle_words
      WHERE is_active = TRUE
      ORDER BY RANDOM()
      LIMIT 1
    `
  );

  return rows[0]?.word || null;
}

// DB => JSON file
function formatProfile(user) {
  // DB => React understandable info
  const plays = Number(user.plays || 0);
  const wins = Number(user.wins || 0);

  return {
    id: user.id,
    username: user.username,
    stats: {
      plays,
      wins,
      losses: plays - wins,
      winRate: plays ? Math.round((wins / plays) * 100) : 0,
      currentStreak: Number(user.current_streak || 0),
      bestStreak: Number(user.best_streak || 0),
      lastPlayedAt: user.last_played_at,
    },
  };
}

// JWT check and connecting it with a user
async function authenticate(req, res, next) {
  try {
    // request token       // splits string from Bearer and token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {         //User not logged (if there is no token)
      return res.status(401).json({ error: 'No token' });
    }
      //                  jsonwebtoken exten. function to check if JWT correct and was created by server
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await getUserProfileById(decoded.userId);

    if (!user) {          //JWT token exists but user dont
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;        //Attach. user to request
    next(); //Check competed
  } catch (error) { //If error...
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Creates a new account, hashes the password, and returns token + profile
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await findUserByUsername(username.trim());
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING id, username
      `,
      [username.trim(), hashedPassword]
    );

    const user = rows[0];

    // Linked stats
    await pool.query(
      `
        INSERT INTO user_stats (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [user.id]
    );
      //JWT Token function
    const token = createToken(user);
      //
    const profile = await getUserProfileById(user.id);
      //translate profile data from DB to JSON file
    res.json({ token, ...formatProfile(profile) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticates an existing user by comparing the submitted password with the stored hash.
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await findUserByUsername(username?.trim());
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }
        //JWT Token function
    const token = createToken(user);
          //translate profile data from DB to JSON file
    res.json({ token, ...formatProfile(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Returns logged in user profile when the frontend reloads with a saved token.
app.get('/profile', authenticate, (req, res) => {
        //translate profile data from DB to JSON file
  res.json(formatProfile(req.user));
});

// Gives the frontend a random word so game selection happens on the server, not in React.
app.get('/words/random', async (req, res) => {
  try {
    const word = await getRandomWord();

    if (!word) {
      return res.status(404).json({ error: 'No active words found' });
    }

    res.json({ word });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Saves the result of a finished game and recalculates plays, wins, and streak values.
app.post('/stats', authenticate, async (req, res) => {
  try {
    const { won } = req.body;

    if (typeof won !== 'boolean') {
      return res.status(400).json({ error: 'The "won" field must be a boolean' });
    }

    // Upsert lets us handle both first-ever game and normal updates in one statement.
    await pool.query(
      `
        INSERT INTO user_stats (user_id, plays, wins, current_streak, best_streak, last_played_at)
        VALUES ($1, 1, $2, $3, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          plays = user_stats.plays + 1,
          wins = user_stats.wins + $2,
          current_streak = CASE
            WHEN $4 THEN user_stats.current_streak + 1
            ELSE 0
          END,
          best_streak = GREATEST(
            user_stats.best_streak,
            CASE
              WHEN $4 THEN user_stats.current_streak + 1
              ELSE user_stats.best_streak
            END
          ),
          last_played_at = NOW()
      `,
      [req.user.id, won ? 1 : 0, won ? 1 : 0, won]
    );

    const updatedUser = await getUserProfileById(req.user.id);
    res.json(formatProfile(updatedUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initializes the database first, then starts Express so routes only run against a ready schema.
initializeDatabase()
  .then(() => {
    // Only start accepting requests after the DB schema is ready.
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
