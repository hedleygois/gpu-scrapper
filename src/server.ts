import express, { Application } from 'express';
import { main } from './index.js';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());

app.post('/run', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[${requestId}] 🚀 Starting scraping job...`);
  console.log(`[${requestId}] 📊 Request body:`, req.body);
  
  try {
    // Run the main scraping function
    await main();
    
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Scraping completed successfully in ${duration}ms`);
    
    res.json({
      success: true,
      requestId,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      message: 'Scraping completed successfully'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Scraping failed after ${duration}ms:`, error);
    
    res.status(500).json({
      success: false,
      requestId,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Scraping failed'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔧 Scraping endpoint: POST http://localhost:${PORT}/run`);
});

export default app; 