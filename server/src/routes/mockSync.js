const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'mock_db_state.json');
let clients = [];
let lastKnownDatabasePayload = null;

// Load persisted database state on server start
try {
  if (fs.existsSync(DB_FILE)) {
    lastKnownDatabasePayload = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load persisted mock database', e);
}

// Endpoint for browsers to connect and listen for events
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: {"type": "CONNECTED"}\n\n`);
  
  if (lastKnownDatabasePayload) {
    res.write(`data: ${JSON.stringify(lastKnownDatabasePayload)}\n\n`);
  }

  clients.push(res);

  try {
    fs.appendFileSync(path.join(process.cwd(), 'sse_log.txt'), 
      new Date().toISOString() + ' - New SSE connection. Total clients: ' + clients.length + '\n');
  } catch (e) {}

  // Keep-alive heartbeat every 15 seconds to prevent Vite proxy from dropping it
  const interval = setInterval(() => {
    res.write(`:\n\n`); // SSE comment acts as ping
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    clients = clients.filter(client => client !== res);
    try {
      fs.appendFileSync(path.join(process.cwd(), 'sse_log.txt'), 
        new Date().toISOString() + ' - SSE disconnected. Total clients: ' + clients.length + '\n');
    } catch (e) {}
  });
});

// Endpoint for a browser to broadcast an event to ALL other browsers
router.post('/broadcast', (req, res) => {
  const payload = req.body;
  
  if (payload && payload.type === 'SYNC_DATABASE') {
    lastKnownDatabasePayload = payload;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to persist mock database state', e);
    }
  }
  
  try {
    fs.appendFileSync(path.join(process.cwd(), 'sse_log.txt'), 
      new Date().toISOString() + ' - Broadcast received. Type: ' + payload.type + ', Clients: ' + clients.length + '\n');
  } catch (e) {}

  // Forward the payload to all connected SSE clients
  clients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      console.error('Failed to send SSE', e);
    }
  });
  
  res.status(200).json({ success: true, clientsNotified: clients.length });
});

module.exports = router;
