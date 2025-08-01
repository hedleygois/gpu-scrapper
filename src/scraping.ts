import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { Item, ScrapingResult } from './types.js';

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

const PRODUCT_SELECTORS = [
  ".prdContainer",
  ".product-grid__card",
  ".productBox",
  ".product-item",
];

const NAME_SELECTORS = [
  ".prdTitle",
  ".product-card__title",
  ".product-name",
  ".product-item-link",
];

const PRICE_SELECTORS = [".prsEuro", ".js-sales-price-wrapper", ".price"];

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isGPU = (productName: string): boolean => {
  const name = productName.replace(/\s+/g, "").toLowerCase();
  return GPU_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()));
};

export const isCPU = (productName: string): boolean => {
  const name = productName.replace(/\s+/g, "").toLowerCase();
  return CPU_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()));
};

export const extractProductName = (element: Element, nameSelectors: string[]): string => {
  return (
    nameSelectors
      .map((selector) => element.querySelector(selector)?.textContent?.trim() || "")
      .find((name) => !!name) || ""
  );
};

export const extractProductPrice = (element: Element, priceSelectors: string[]): number => {
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
};

export const extractProductUrl = (element: Element, storeBaseUrl: string): string => {
  const linkHref = [
    ...element.querySelectorAll("a[href]")
  ]
    .map((el) => (el as HTMLAnchorElement).href)
    .find((href) => !!href);
  if (linkHref) {
    return linkHref.startsWith("http") ? linkHref : `${storeBaseUrl}${linkHref}`;
  }
  if ((element as HTMLAnchorElement).href) {
    return (element as HTMLAnchorElement).href;
  }
  return "";
};

export const extractSingleProduct = (
  element: Element,
  storeName: string,
  storeBaseUrl: string,
  nameSelectors: string[],
  priceSelectors: string[]
): Item | null => {
  const name = extractProductName(element, nameSelectors);
  const price = extractProductPrice(element, priceSelectors);
  const url = extractProductUrl(element, storeBaseUrl);

  if (!name || !price) {
    return null;
  }

  const category: "GPU" | "CPU" = isGPU(name) ? "GPU" : "CPU";

  return {
    name,
    price,
    url,
    store: storeName,
    category,
  };
};

export const extractProducts = (
  document: Document,
  storeName: string,
  storeBaseUrl: string
): Item[] => {
  const products: Item[] = [];

  for (const productSelector of PRODUCT_SELECTORS) {
    const productElements = document.querySelectorAll(productSelector);

    if (productElements.length > 0) {
      productElements.forEach((element) => {
        const product = extractSingleProduct(
          element,
          storeName,
          storeBaseUrl,
          NAME_SELECTORS,
          PRICE_SELECTORS
        );
        if (product) {
          products.push(product);
        }
      });
      break;
    }
  }

  return products.filter(
    (product) => isGPU(product.name) || isCPU(product.name)
  );
};

export const scrapeStoreWithBrowser = async (
  store: { name: string; baseUrl: string; searchPath: string; searchParam: string },
  searchTerm: string
): Promise<Item[]> => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`🌐 Opening ${store.baseUrl} for ${store.name}...`);
    await page.goto(store.baseUrl);

  
    await page.waitForSelector("#searchFieldInputField", { timeout: 10000 });

  
    await page.fill("#searchFieldInputField", "");
    await page.fill("#searchFieldInputField", searchTerm);

  
    await page.press("#searchFieldInputField", "Enter");

  
    await page.waitForLoadState("networkidle");

  
    const html = await page.content();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    return extractProducts(document, store.name, store.baseUrl);
  } finally {
    await browser.close();
  }
};

export const scrapeStoreWithFetch = async (
  store: { name: string; baseUrl: string; searchPath: string; searchParam: string },
  searchTerm: string
): Promise<Item[]> => {
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

  return extractProducts(document, store.name, store.baseUrl);
};

export const scrapeStore = async (
  store: { name: string; baseUrl: string; searchPath: string; searchParam: string; requiresBrowser: boolean },
  searchTerm: string
): Promise<Item[]> => {
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

export const scrapeAllStores = async (
  stores: Array<{ name: string; baseUrl: string; searchPath: string; searchParam: string; requiresBrowser: boolean }>,
  searchTerms: string[]
): Promise<ScrapingResult> => {
  const products: Item[] = [];
  const errors: string[] = [];

  for (const store of stores) {
    console.log(`Scraping ${store.name}...`);

    for (const searchTerm of searchTerms) {
      try {
        const storeProducts = await scrapeStore(store, searchTerm);
        products.push(...storeProducts);

        await delay(1000);
      } catch (error) {
        const errorMsg = `Failed to scrape ${store.name} for "${searchTerm}": ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    await delay(2000);
  }

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