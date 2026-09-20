require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./User');
const keypoints = require('./keypoints');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.log('❌ MongoDB connection error:', err.message));

// ---------- SIGNUP ----------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username aur password dono chahiye' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Yeh username pehle se registered hai' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Signup successful',
      token,
      username: newUser.username
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---------- LOGIN ----------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username aur password dono chahiye' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password galat hai' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---------- SCORE CHECK ----------
app.post('/api/score/:category', (req, res) => {
  try {
    const { category } = req.params;
    const { answers } = req.body;

    const catKeypoints = keypoints[category];
    if (!catKeypoints) {
      return res.status(404).json({ message: 'Category ke keypoints nahi mile' });
    }

    let totalScore = 0;
    let maxScore = 0;
    const breakdown = {};

    Object.keys(catKeypoints).forEach((qId) => {
      const requiredKeypoints = catKeypoints[qId];
      maxScore += requiredKeypoints.length;

      const answerText = (answers[qId] || '').toLowerCase();
      let questionScore = 0;
      const matchedKeypoints = [];

      requiredKeypoints.forEach((keyword) => {
        if (answerText.includes(keyword.toLowerCase())) {
          questionScore++;
          matchedKeypoints.push(keyword);
        }
      });

      totalScore += questionScore;
      breakdown[qId] = {
        score: questionScore,
        maxScore: requiredKeypoints.length,
        matchedKeypoints
      };
    });

    res.json({ score: totalScore, maxScore, breakdown });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));