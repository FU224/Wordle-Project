import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 5000;
const SECRET_KEY = 'your_secret_key_change_in_production';

app.use(cors());
app.use(express.json());

const users = new Map();

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (users.has(username)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.set(username, { password: hashedPassword, stats: { wins: 0, plays: 0 } });

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = users.get(username);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/profile', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    const user = users.get(decoded.username);
    
    res.json({ username: decoded.username, stats: user.stats });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
