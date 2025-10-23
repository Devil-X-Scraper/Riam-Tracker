const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
let instances = [];
let broadcasts = [];

// Routes
app.get('/api', (req, res) => {
  res.json({ 
    status: 'Queen Riam Tracker API', 
    version: '1.0.0',
    endpoints: [
      'GET  /api/stats - Get tracker statistics',
      'POST /api/register - Register bot instance', 
      'GET  /api/instances - Get all instances',
      'POST /api/broadcast - Send broadcast',
      'GET  /api/broadcasts/:instanceId - Get pending broadcasts'
    ]
  });
});

// Register bot instance
app.post('/api/register', (req, res) => {
  const { instanceId, owner, version, userCount, groupCount } = req.body;
  
  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId is required' });
  }

  const now = Date.now();
  const existingIndex = instances.findIndex(inst => inst.instanceId === instanceId);

  const instanceData = {
    instanceId,
    owner: owner || 'Unknown',
    version: version || '1.0.0',
    userCount: userCount || 0,
    groupCount: groupCount || 0,
    firstSeen: existingIndex >= 0 ? instances[existingIndex].firstSeen : now,
    lastPing: now,
    status: 'online',
    ip: req.ip
  };

  if (existingIndex >= 0) {
    instances[existingIndex] = { ...instances[existingIndex], ...instanceData };
  } else {
    instances.push(instanceData);
  }

  // Clean up old instances (older than 1 day)
  instances = instances.filter(inst => now - inst.lastPing < 24 * 60 * 60 * 1000);

  res.json({ 
    success: true, 
    message: 'Instance registered',
    instanceId 
  });
});

// Get tracker statistics
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  const activeInstances = instances.filter(inst => now - inst.lastPing < 5 * 60 * 1000);
  
  const stats = {
    totalInstances: instances.length,
    activeInstances: activeInstances.length,
    totalUsers: instances.reduce((sum, inst) => sum + inst.userCount, 0),
    totalGroups: instances.reduce((sum, inst) => sum + inst.groupCount, 0),
    lastUpdated: new Date().toISOString()
  };

  res.json(stats);
});

// Get all instances
app.get('/api/instances', (req, res) => {
  res.json(instances.sort((a, b) => b.lastPing - a.lastPing));
});

// Create broadcast
app.post('/api/broadcast', (req, res) => {
  const { message, ownerKey } = req.body;
  
  // Simple owner authentication
  const validOwnerKey = process.env.OWNER_KEY || 'queenriam123';
  if (ownerKey !== validOwnerKey) {
    return res.status(401).json({ error: 'Invalid owner key' });
  }

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const broadcast = {
    id: 'bc_' + Date.now(),
    message: message.trim(),
    created: Date.now(),
    status: 'active',
    deliveredTo: []
  };

  broadcasts.push(broadcast);
  
  // Keep only last 50 broadcasts
  broadcasts = broadcasts.slice(-50);

  res.json({ 
    success: true, 
    broadcastId: broadcast.id,
    message: 'Broadcast created successfully'
  });
});

// Get pending broadcasts for instance
app.get('/api/broadcasts/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const pending = broadcasts.filter(bc => 
    bc.status === 'active' && !bc.deliveredTo.includes(instanceId)
  );

  res.json({ broadcasts: pending });
});

// Mark broadcast as delivered
app.post('/api/broadcast-delivered', (req, res) => {
  const { instanceId, broadcastId } = req.body;
  
  const broadcast = broadcasts.find(bc => bc.id === broadcastId);
  if (broadcast && !broadcast.deliveredTo.includes(instanceId)) {
    broadcast.deliveredTo.push(instanceId);
  }

  res.json({ success: true });
});

// Get all broadcasts
app.get('/api/broadcasts', (req, res) => {
  res.json(broadcasts.sort((a, b) => b.created - a.created));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Queen Riam Tracker running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
});

module.exports = app;
