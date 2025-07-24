// Local development server with TTS API support
import express from 'express';
import path from 'path';
import fs from 'fs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { fileURLToPath } from 'url';
import { TTS_CONFIG } from './shared-tts-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.static('dist')); // Serve built files

// Initialize Google TTS client
let ttsClient = null;

// In-memory storage for error logs (dev only)
let errorLogs = [];
const MAX_LOGS = 1000;

function initializeClient() {
  if (ttsClient) return ttsClient;

  try {
    // Read credentials from google-cloud-key.json
    const keyFile = JSON.parse(fs.readFileSync('./google-cloud-key.json', 'utf8'));
    
    ttsClient = new TextToSpeechClient({
      projectId: keyFile.project_id,
      keyFile: './google-cloud-key.json'
    });

    console.log('✅ Google TTS client initialized');
    return ttsClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google TTS client:', error);
    throw error;
  }
}

// TTS API endpoint
app.post('/api/tts', async (req, res) => {
  console.log('🎙️ TTS request received:', { text: req.body.text?.substring(0, 50) });
  
  try {
    const { text, isSSML = false, voice, audioConfig } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }

    const client = initializeClient();
    const input = isSSML ? { ssml: text } : { text };
    
    const request = {
      input,
      voice: voice || TTS_CONFIG.voice,
      audioConfig: audioConfig || TTS_CONFIG.audioConfig
    };

    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    const audioBase64 = Buffer.from(response.audioContent).toString('base64');
    
    console.log('✅ TTS synthesis successful');
    
    res.json({
      audioContent: audioBase64,
      voice: request.voice,
      text: text
    });

  } catch (error) {
    console.error('❌ TTS error:', error);
    res.status(500).json({ 
      error: 'Text-to-speech synthesis failed',
      details: error.message
    });
  }
});

// Log error API endpoint (dev equivalent of /api/log-error.ts)
app.post('/api/log-error', (req, res) => {
  console.log('📊 Error log request received');
  
  try {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      level: req.body.level || 'error',
      message: req.body.message || 'Unknown error',
      data: req.body.data,
      device: req.body.device || 'Unknown device',
      userAgent: req.headers['user-agent'] || 'Unknown',
      url: req.body.url || 'Unknown URL',
      userId: req.body.userId,
      sessionId: req.body.sessionId
    };
    
    // Add to memory storage
    errorLogs.unshift(errorEntry);
    
    // Keep only the most recent logs
    if (errorLogs.length > MAX_LOGS) {
      errorLogs = errorLogs.slice(0, MAX_LOGS);
    }
    
    // Log to console as well
    console.log(`[ERROR LOG] ${errorEntry.device} - ${errorEntry.message}`, {
      level: errorEntry.level,
      url: errorEntry.url,
      timestamp: errorEntry.timestamp,
      data: errorEntry.data
    });
    
    res.json({ 
      success: true, 
      message: 'Error logged successfully',
      logCount: errorLogs.length
    });
    
  } catch (error) {
    console.error('❌ Error logging API error:', error);
    res.status(500).json({ 
      error: 'Failed to process error log',
      details: error.message
    });
  }
});

// Get error logs endpoint
app.get('/api/log-error', (req, res) => {
  console.log('📊 Get error logs request received');
  
  try {
    const { limit = 50, level, device, since } = req.query;
    
    let filteredLogs = errorLogs;
    
    // Filter by level if specified
    if (level && typeof level === 'string') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    // Filter by device if specified
    if (device && typeof device === 'string') {
      filteredLogs = filteredLogs.filter(log => 
        log.device.toLowerCase().includes(device.toLowerCase())
      );
    }
    
    // Filter by timestamp if specified
    if (since && typeof since === 'string') {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) > sinceDate
      );
    }
    
    // Limit results
    const limitNum = parseInt(limit) || 50;
    filteredLogs = filteredLogs.slice(0, limitNum);
    
    res.json({
      logs: filteredLogs,
      totalCount: errorLogs.length,
      filteredCount: filteredLogs.length,
      stats: {
        errors: errorLogs.filter(l => l.level === 'error').length,
        warnings: errorLogs.filter(l => l.level === 'warn').length,
        info: errorLogs.filter(l => l.level === 'info').length,
        logs: errorLogs.filter(l => l.level === 'log').length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch error logs',
      details: error.message
    });
  }
});

// Clear error logs endpoint
app.delete('/api/log-error', (req, res) => {
  console.log('📊 Clear error logs request received');
  
  try {
    const previousCount = errorLogs.length;
    errorLogs = [];
    
    console.log(`[ERROR LOG] Cleared ${previousCount} error logs`);
    
    res.json({ 
      success: true, 
      message: `Cleared ${previousCount} error logs`,
      clearedCount: previousCount
    });
    
  } catch (error) {
    console.error('❌ Error clearing logs:', error);
    res.status(500).json({ 
      error: 'Failed to clear error logs',
      details: error.message
    });
  }
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Development server running at http://localhost:${port}`);
});