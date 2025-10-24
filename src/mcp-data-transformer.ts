import { Item, ScrapingResult } from './types.js';

export interface McpScrapeData {
  readonly scrape: {
    readonly id?: number;
    readonly timestamp: string;
    readonly items: readonly McpItem[];
  };
}

export interface McpItem {
  readonly id?: number;
  readonly price: number;
  readonly name: string;
  readonly url: string;
  readonly item_type: 'GPU' | 'CPU';
  readonly store: {
    readonly id?: number;
    readonly name: string;
  };
}

export interface McpStore {
  readonly id?: number;
  readonly name: string;
}

const createStoreMap = (products: readonly Item[]): Map<string, McpStore> => {
  const storeMap = new Map<string, McpStore>();
  const uniqueStores = [...new Set(products.map(p => p.store))];
  
  uniqueStores.forEach((storeName, index) => {
    storeMap.set(storeName, {
      id: index + 1, // Simple ID assignment
      name: storeName
    });
  });
  
  return storeMap;
};

const transformItemToMcp = (item: Item, storeMap: Map<string, McpStore>): McpItem => {
  const store = storeMap.get(item.store);
  if (!store) {
    throw new Error(`Store '${item.store}' not found in store map`);
  }

  return {
    price: item.price,
    name: item.name,
    url: item.url,
    item_type: item.category,
    store: {
      id: store.id,
      name: store.name
    }
  };
};

const createMetadata = (result: ScrapingResult) => ({
  timestamp: new Date().toISOString(),
  totalProducts: result.products.length,
  gpuCount: result.products.filter(p => p.category === 'GPU').length,
  cpuCount: result.products.filter(p => p.category === 'CPU').length,
  storeCount: new Set(result.products.map(p => p.store)).size,
  errorCount: result.errors.length
});

export const transformScrapingResultToMcp = (result: ScrapingResult): McpScrapeData => {
  console.log('🔄 Transforming scraped data to MCP format...');
  
  const storeMap = createStoreMap(result.products);
  console.log(`📊 Created store map with ${storeMap.size} unique stores`);
  
  const mcpItems = result.products.map(item => transformItemToMcp(item, storeMap));
  console.log(`📦 Transformed ${mcpItems.length} items to MCP format`);
  
  const metadata = createMetadata(result);
  console.log(`📈 Metadata: ${metadata.totalProducts} products, ${metadata.gpuCount} GPUs, ${metadata.cpuCount} CPUs`);
  
  return {
    scrape: {
      timestamp: metadata.timestamp,
      items: mcpItems
    }
  };
};

export const validateMcpData = (data: McpScrapeData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.scrape) {
    errors.push('Missing scrape object');
    return { isValid: false, errors };
  }
  
  if (!data.scrape.timestamp) {
    errors.push('Missing scrape timestamp');
  }
  
  if (!Array.isArray(data.scrape.items)) {
    errors.push('Scrape items must be an array');
  } else {
    data.scrape.items.forEach((item, index) => {
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`Item ${index}: missing or invalid name`);
      }
      
      if (typeof item.price !== 'number' || item.price <= 0) {
        errors.push(`Item ${index}: invalid price (${item.price})`);
      }
      
      if (!item.url || typeof item.url !== 'string') {
        errors.push(`Item ${index}: missing or invalid URL`);
      }
      
      if (!item.item_type || !['GPU', 'CPU'].includes(item.item_type)) {
        errors.push(`Item ${index}: invalid item_type (${item.item_type})`);
      }
      
      if (!item.store || !item.store.name) {
        errors.push(`Item ${index}: missing store information`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const createDataDescription = (result: ScrapingResult): string => {
  const gpus = result.products.filter(p => p.category === 'GPU');
  const cpus = result.products.filter(p => p.category === 'CPU');
  const stores = [...new Set(result.products.map(p => p.store))];
  
  return `Scraped electronics data containing ${result.products.length} products: ${gpus.length} GPUs, ${cpus.length} CPUs from ${stores.length} stores (${stores.join(', ')}). Data includes product names, prices, URLs, categories, and store information.`;
};

