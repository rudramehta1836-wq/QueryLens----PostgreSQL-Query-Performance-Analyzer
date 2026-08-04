const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const analysisRoutes = require('./routes/analysisRoutes');
const historyRoutes = require('./routes/historyRoutes');
const indexRoutes = require('./routes/indexRoutes');
const { getAppPool } = require('./config/database');

const app = express();

// --------------- Middleware ---------------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// --------------- Routes ---------------
app.get('/api/health', async (_req, res, next) => {
  try {
    const pool = getAppPool();
    const result = await pool.query('SELECT NOW() AS server_time');
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        serverTime: result.rows[0].server_time,
        uptime: process.uptime()
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
});

app.use('/api', analysisRoutes);
app.use('/api', historyRoutes);
app.use('/api', indexRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found.' }
  });
});

// Centralised error handler
app.use(errorHandler);

// --------------- Start server ---------------
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QueryLens server running on port ${PORT}`);
  });
}

module.exports = app;
