import { scrapeAllStores } from './scraping.js';
import { STORES, SEARCH_TERMS } from './config/stores.js';
import { AIStorageAgent } from './agents/ai-storage-agent.js';
import { ScrapingResult } from './types.js';
import { McpClient } from './mcp-client.js';
import { transformScrapingResultToMcp, validateMcpData, createDataDescription } from './mcp-data-transformer.js';
import fs from 'fs/promises';

const formatResults = (result: ScrapingResult): void => {
  const { products, errors } = result;

  console.log("\n=== SCRAPING RESULTS ===\n");

  const gpus = products.filter((p) => p.category === "GPU");
  const cpus = products.filter((p) => p.category === "CPU");

  console.log(`📊 Found ${products.length} products total`);
  console.log(`🎮 GPUs: ${gpus.length}`);
  console.log(`🖥️  CPUs: ${cpus.length}\n`);

  if (gpus.length > 0) {
    console.log("=== GPUs ===");
    gpus.forEach((gpu) => {
      console.log(`${gpu.name}`);
      console.log(`  💰 ${gpu.price} | 🏪 ${gpu.store}`);
      console.log(`  🔗 ${gpu.url}\n`);
    });
  }

  if (cpus.length > 0) {
    console.log("=== CPUs ===");
    cpus.forEach((cpu) => {
      console.log(`${cpu.name}`);
      console.log(`  💰 ${cpu.price} | 🏪 ${cpu.store}`);
      console.log(`  🔗 ${cpu.url}\n`);
    });
  }

  if (errors.length > 0) {
    console.log("=== ERRORS ===");
    errors.forEach((error) => console.log(`❌ ${error}`));
  }
};

const createEnrichedData = (result: ScrapingResult) => ({
  ...result,
  metadata: {
    timestamp: new Date().toISOString(),
    totalProducts: result.products.length,
    gpuCount: result.products.filter(p => p.category === 'GPU').length,
    cpuCount: result.products.filter(p => p.category === 'CPU').length,
    stores: [...new Set(result.products.map(p => p.store))],
  }
});

const generateFilename = (): string => 
  `electronics_scrape_${new Date().toISOString().split('T')[0]}.json`;

const saveResultsWithMcp = async (result: ScrapingResult): Promise<void> => {
  const mcpClient = new McpClient();
  const storageAgent = new AIStorageAgent();
  
  try {
    console.log('🔌 Connecting to MCP server...');
    await mcpClient.connect();
    
    console.log('🔍 Discovering available MCP tools...');
    const availableTools = await mcpClient.listTools();
    
    if (availableTools.length === 0) {
      throw new Error('No MCP tools available');
    }
    
    const dataDescription = createDataDescription(result);
    console.log('🤖 Selecting best MCP tool for data writing...');
    const { tool, reasoning, confidence } = await storageAgent.selectBestMcpTool(availableTools, dataDescription);
    
    console.log(`🎯 Selected tool: ${tool.name} (confidence: ${confidence})`);
    console.log(`💭 Reasoning: ${reasoning}`);
    
    console.log('🔄 Transforming data to MCP format...');
    const mcpData = transformScrapingResultToMcp(result);
    
    console.log('✅ Validating MCP data...');
    const validation = validateMcpData(mcpData);
    if (!validation.isValid) {
      throw new Error(`MCP data validation failed: ${validation.errors.join(', ')}`);
    }
    
    console.log('💾 Saving data via MCP...');
    const saveResult = await mcpClient.callTool(tool.name, mcpData);
    console.log(`✅ Data saved successfully via MCP tool: ${tool.name}`);
    console.log(`📊 MCP Response:`, saveResult);
    
  } catch (error) {
    console.error('❌ MCP save failed:', error);
    
    // Try AI-powered error analysis and recovery
    try {
      const errorAnalysis = await storageAgent.analyzeMcpError(error, 'unknown');
      console.log(`🔍 Error Analysis: ${errorAnalysis.reasoning}`);
      
      if (errorAnalysis.isRecoverable && errorAnalysis.action === 'retry') {
        console.log(`🔄 Retrying in ${errorAnalysis.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, errorAnalysis.retryDelay));
        return await saveResultsWithMcp(result);
      } else if (errorAnalysis.isFatal) {
        console.error('💀 Fatal error detected, cannot recover');
        throw new Error(`Fatal MCP error: ${errorAnalysis.reasoning}`);
      }
    } catch (analysisError) {
      console.error('❌ Error analysis failed:', analysisError);
    }
    
    // Fallback to file save
    console.log('🔄 Falling back to file save...');
    await saveResultsToFile(result);
    throw error;
  } finally {
    await mcpClient.disconnect();
  }
};

const saveResultsToFile = async (result: ScrapingResult): Promise<void> => {
  const filename = generateFilename();
  const enrichedData = createEnrichedData(result);
  
  await fs.writeFile(filename, JSON.stringify(enrichedData, null, 2));
  console.log(`\n💾 Results saved to ${filename} (fallback)`);
};

const processResultsWithAI = async (result: ScrapingResult): Promise<void> => {
  const storageAgent = new AIStorageAgent();
  
  const deduplicatedProducts = await storageAgent.deduplicateProducts(result.products);
  
  const deduplicatedResult = {
    products: deduplicatedProducts,
    errors: result.errors
  };
  
  await saveResultsWithMcp(deduplicatedResult);
  
  await storageAgent.formatResults(deduplicatedResult);
};

const main = async (): Promise<void> => {
  console.log('🚀 Starting Dutch electronics scraper...');
  console.log('🎯 Searching for specified GPUs and CPUs with 3D cache...\n');

  const result = await scrapeAllStores(STORES, SEARCH_TERMS);
  
  formatResults(result);

  await processResultsWithAI(result);
  
  console.log('✅ Scraping completed!');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  formatResults, 
  saveResultsWithMcp, 
  saveResultsToFile,
  processResultsWithAI,
  main 
};
