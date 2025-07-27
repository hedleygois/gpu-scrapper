import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";

// Types
interface Product {
  name: string;
  price: number;
  url: string;
  store: string;
  category: "GPU" | "CPU";
}

interface ScrapingResult {
  products: Product[];
  errors: string[];
}

const searchTerms = [
  // GPU search terms
  "Radeon 7700XT", 'Radeon 7900XT', 'Radeon 7900XTX',
   'GeForce 5070 ti', 'GeForce 5080', 'GeForce 4070 TI Super',
  // CPU search terms
  'Ryzen 9950X3D', 'Ryzen 9900X3D', 'Ryzen 7950X3D', 'Ryzen 7800X3D', 'Ryzen 7900X3D'
];

// Configuration
const GPU_KEYWORDS = [
  "7700xt",
  "7900xt",
  "7900xtx",
  "Radeon",
  "XFX",
  "MSI",
  "Shapphire",
  "PowerColor",
  "Gigabyte",
  "5070 ti",
  "5080",
  "4070 ti super",
  "GeForce",
];

const CPU_KEYWORDS = ["ryzen 7", "ryzen 9", "ryzen 5"];

const STORES = [
  {
    name: 'Megekko',
    baseUrl: 'https://www.megekko.nl',
    searchPath: '/zoeken',
    searchParam: 'q',
    requiresBrowser: true
  },
  {
    name: 'Coolblue',
    baseUrl: 'https://www.coolblue.nl',
    searchPath: '/zoeken',
    searchParam: 'query',
    requiresBrowser: false
  },
  {
    name: 'Alternate',
    baseUrl: 'https://www.alternate.nl',
    searchPath: '/listing.xhtml',
    searchParam: 'q',
    requiresBrowser: false
  },
  {
    name: "Azerty",
    baseUrl: "https://azerty.nl",
    searchPath: "/catalogsearch/result/",
    searchParam: "q",
    requiresBrowser: false,
  },
];

const productSelectors = [
  ".prdContainer",
  ".product-grid__card",
  ".productBox",
  ".product-item",
];

const nameSelectors = [
  ".prdTitle",
  ".product-card__title",
  ".product-name",
  ".product-item-link",
];

const priceSelectors = [".prsEuro", ".js-sales-price-wrapper", ".price"];

// Utility functions
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isGPU = (productName: string): boolean => {
  const name = productName.replace(/\s+/g, "").toLowerCase();
  return GPU_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()));
};

const isCPU = (productName: string): boolean => {
  const name = productName.replace(/\s+/g, "").toLowerCase();
  return CPU_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()));
};

// Generic scraper function
const scrapeStore = async (
  store: (typeof STORES)[0],
  searchTerm: string
): Promise<Product[]> => {
  try {
    if (store.requiresBrowser) {
      return await scrapeStoreWithBrowser(store, searchTerm);
    } else {
      return await scrapeStoreWithFetch(store, searchTerm);
    }
  } catch (error) {
    console.error(`Error scraping ${store.name}:`, error);
    return [];
  }
};

// Browser-based scraper for stores that require JavaScript interaction
const scrapeStoreWithBrowser = async (
  store: (typeof STORES)[0],
  searchTerm: string
): Promise<Product[]> => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`🌐 Opening ${store.baseUrl} for ${store.name}...`);
    await page.goto(store.baseUrl);

    // Wait for the search input to be available
    await page.waitForSelector("#searchFieldInputField", { timeout: 10000 });

    // Clear the search field and type the search term
    await page.fill("#searchFieldInputField", "");
    await page.fill("#searchFieldInputField", searchTerm);

    // Press Enter to search
    await page.press("#searchFieldInputField", "Enter");

    // Wait for search results to load
    await page.waitForLoadState("networkidle");

    // Get the page content
    const html = await page.content();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    return extractProducts(document, store);
  } finally {
    await browser.close();
  }
};

// Fetch-based scraper for stores that work with URL parameters
const scrapeStoreWithFetch = async (
  store: (typeof STORES)[0],
  searchTerm: string
): Promise<Product[]> => {
  const searchUrl = `${store.baseUrl}${store.searchPath}?${
    store.searchParam
  }=${encodeURIComponent(searchTerm)}`;

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${store.name}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  return extractProducts(document, store);
};

// Store-specific product extraction
const extractProducts = (
  document: Document,
  store: (typeof STORES)[0]
): Product[] => {
  const products: Product[] = [];

  // Try each product selector
  for (const productSelector of productSelectors) {
    const productElements = document.querySelectorAll(productSelector);

    if (productElements.length > 0) {
      productElements.forEach((element) => {
        const product = extractSingleProduct(
          element,
          store,
          nameSelectors,
          priceSelectors
        );
        if (product) {
          products.push(product);
        }
      });
      break; // Use first working selector
    }
  }

  return products.filter(
    (product) => isGPU(product.name) || isCPU(product.name)
  );
};

// Helper to extract product name (functional)
function extractProductName(element: Element, nameSelectors: string[]): string {
  return (
    nameSelectors
      .map((selector) => element.querySelector(selector)?.textContent?.trim() || "")
      .find((name) => !!name) || ""
  );
}

// Helper to extract product price (functional)
function extractProductPrice(element: Element, priceSelectors: string[]): number {
  return (
    priceSelectors
      .map((selector) => {
        const priceEl = element.querySelector(selector);
        if (priceEl?.textContent?.trim()) {
          const priceText = priceEl.textContent
            ?.replace(/[^\d,.]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim() || "";
          return priceText ? parseFloat(priceText) : -1;
        }
        return -1;
      })
      .find((price) => price > 0) || -1
  );
}

// Helper to extract product URL (functional)
function extractProductUrl(element: Element, store: (typeof STORES)[0]): string {
  const linkHref = [
    ...element.querySelectorAll("a[href]")
  ]
    .map((el) => (el as HTMLAnchorElement).href)
    .find((href) => !!href);
  if (linkHref) {
    return linkHref.startsWith("http") ? linkHref : `${store.baseUrl}${linkHref}`;
  }
  if ((element as HTMLAnchorElement).href) {
    return (element as HTMLAnchorElement).href;
  }
  return "";
}

const extractSingleProduct = (
  element: Element,
  store: (typeof STORES)[0],
  nameSelectors: string[],
  priceSelectors: string[]
): Product | null => {
  const name = extractProductName(element, nameSelectors);
  const price = extractProductPrice(element, priceSelectors);
  const url = extractProductUrl(element, store);

  if (!name || !price) {
    return null;
  }

  const category: "GPU" | "CPU" = isGPU(name) ? "GPU" : "CPU";

  return {
    name,
    price,
    url,
    store: store.name,
    category,
  };
};

// Main scraping orchestrator
const scrapeAllStores = async (): Promise<ScrapingResult> => {
  const products: Product[] = [];
  const errors: string[] = [];

  for (const store of STORES) {
    console.log(`Scraping ${store.name}...`);

    for (const searchTerm of searchTerms) {
      try {
        const storeProducts = await scrapeStore(store, searchTerm);
        products.push(...storeProducts);

        // Be respectful to servers
        await delay(1000);
      } catch (error) {
        const errorMsg = `Failed to scrape ${store.name} for "${searchTerm}": ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Longer delay between stores
    await delay(2000);
  }

  // Remove duplicates based on name and store
  const uniqueProducts = products.filter(
    (product, index, self) =>
      index ===
      self.findIndex(
        (p) => p.name === product.name && p.store === product.store
      )
  );

  return {
    products: uniqueProducts,
    errors,
  };
};

// Output formatting
const formatResults = (result: ScrapingResult): void => {
  const { products, errors } = result;

  console.log("\n=== SCRAPING RESULTS ===\n");

  // Group by category
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

// Export results to JSON
const saveResults = async (result: ScrapingResult): Promise<void> => {
  const fs = await import("fs").then((m) => m.promises);
  const filename = `electronics_scrape_${
    new Date().toISOString().split("T")[0]
  }.json`;

  await fs.writeFile(filename, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to ${filename}`);
};

// Main execution
const main = async (): Promise<void> => {
  console.log("🚀 Starting Dutch electronics scraper...");
  console.log("🎯 Searching for specified GPUs and CPUs with 3D cache...\n");

  const result = await scrapeAllStores();

  formatResults(result);
  await saveResults(result);

  console.log("✅ Scraping completed!");
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeAllStores, formatResults, saveResults, extractProductName, extractProductPrice, extractProductUrl };
export type { Product, ScrapingResult };
