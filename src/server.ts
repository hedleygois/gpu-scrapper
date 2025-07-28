import express, { Application } from 'express';
import { main } from './index.js';
import { getProductStats, getLatestProducts, getProductsByCategory } from './database.js';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// For simplicity, I keep this route here - will move it to a separate service later
app.get('/stats', (req, res) => {
  try {
    const stats = getProductStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// For simplicity, I keep this route here - will move it to a separate service later
app.get('/products', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const products = getLatestProducts(limit);
    res.json({
      success: true,
      data: products,
      count: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// For simplicity, I keep this route here - will move it to a separate service later
app.get('/products/:category', (req, res) => {
  try {
    const category = req.params.category as 'GPU' | 'CPU';
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!['GPU', 'CPU'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be GPU or CPU',
        timestamp: new Date().toISOString()
      });
    }
    
    const products = getProductsByCategory(category, limit);
    return res.json({
      success: true,
      data: products,
      count: products.length,
      category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Main scraping endpoint
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
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`📦 Products: http://localhost:${PORT}/products`);
  console.log(`🔧 Scraping endpoint: POST http://localhost:${PORT}/run`);
});

export default app; 