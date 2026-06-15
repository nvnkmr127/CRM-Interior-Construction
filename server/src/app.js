const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authRouter = require('./routes/auth');
const configRouter = require('./routes/config');
const projectsRouter = require('./routes/projects');
const errorHandler = require('./middleware/errorHandler');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);

// Error handler MUST be the last middleware
app.use(errorHandler);

module.exports = app;
