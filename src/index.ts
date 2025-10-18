import { saveProducts } from './database.js';
import { scrapeAllStores } from './scraping.js';
import { STORES, SEARCH_TERMS } from './config/stores.js';
import { AIStorageAgent } from './agents/ai-storage-agent.js';
import { ScrapingResult } from './types.js';
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

const saveResults = async (result: ScrapingResult): Promise<void> => {
  saveProducts(result.products);
  
  const filename = generateFilename();
  const enrichedData = createEnrichedData(result);
  
  await fs.writeFile(filename, JSON.stringify(enrichedData, null, 2));
  console.log(`\n💾 Results saved to ${filename}`);
};

const processResultsWithAI = async (result: ScrapingResult): Promise<void> => {
  const storageAgent = new AIStorageAgent();
  
  const deduplicatedProducts = await storageAgent.deduplicateProducts(result.products);
  
  const deduplicatedResult = {
    products: deduplicatedProducts,
    errors: result.errors
  };
  
  await saveResults(deduplicatedResult);
  
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
  saveResults, 
  processResultsWithAI,
  main 
};
