require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const sessionRoutes = require('./routes/sessions');
const journalRoutes = require('./routes/journals');
const profileRoutes = require('./routes/profile');
const workLogRoutes = require('./routes/workLogs');
const habitRoutes = require('./routes/habits');
const reportRoutes = require('./routes/reports');   // ← NEW

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/reports', reportRoutes);            // ← NEW

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB Atlas connected');
    app.listen(PORT, () => console.log(`🚀  Server on http://localhost:${PORT}`));
  })
  .catch(err => { console.error('❌  MongoDB connection failed:', err.message); process.exit(1); });
