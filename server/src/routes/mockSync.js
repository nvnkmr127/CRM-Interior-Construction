const express = require('express');
const router = express.Router();

let clients = [];

// Endpoint for browsers to connect and listen for events
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: {"type": "CONNECTED"}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Endpoint for a browser to broadcast an event to ALL other browsers
router.post('/broadcast', (req, res) => {
  const payload = req.body;
  
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
