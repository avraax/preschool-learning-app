import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'fs'
import path from 'path'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Try to read the version from the built application
    const versionPath = path.join(process.cwd(), 'dist', 'version.json')
    
    let versionInfo
    if (fs.existsSync(versionPath)) {
      const versionData = fs.readFileSync(versionPath, 'utf8')
      versionInfo = JSON.parse(versionData)
    } else {
      // Fallback: generate current timestamp as version
      versionInfo = {
        buildTime: Date.now(),
        version: '1.0.0',
        commitHash: 'unknown'
      }
    }

    res.status(200).json(versionInfo)
  } catch (error) {
    console.error('Error reading version info:', error)
    res.status(500).json({ 
      error: 'Failed to read version info',
      buildTime: Date.now(),
      version: '1.0.0',
      commitHash: 'error'
    })
  }
}