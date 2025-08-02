import Database from 'better-sqlite3';
import { Item } from './types.js';

type DatabaseConnection = Database.Database;

const createDatabaseConnection = (): DatabaseConnection => 
  new Database('./data/db.sqlite');

const findStoreId = (db: DatabaseConnection, storeName: string): number | undefined => {
  const stmt = db.prepare('SELECT id FROM store WHERE name = ?');
  const result = stmt.get(storeName) as { id: number } | undefined;
  return result?.id;
};

const insertStore = (db: DatabaseConnection, storeName: string): number => {
  const stmt = db.prepare('INSERT INTO store (name) VALUES (?)');
  const result = stmt.run(storeName);
  return result.lastInsertRowid as number;
};

const getOrCreateStoreId = (db: DatabaseConnection, storeName: string): number => {
  const existingId = findStoreId(db, storeName);
  return existingId ?? insertStore(db, storeName);
};

const findItemId = (db: DatabaseConnection, product: Item, storeId: number): number | undefined => {
  const stmt = db.prepare(`
    SELECT id FROM item 
    WHERE name = ? AND store_id = ? AND item_type = ?
  `);
  const result = stmt.get(product.name, storeId, product.category) as { id: number } | undefined;
  return result?.id;
};

const updateItem = (db: DatabaseConnection, product: Item, itemId: number): void => {
  const stmt = db.prepare(`
    UPDATE item 
    SET price = ?, url = ? 
    WHERE id = ?
  `);
  stmt.run(product.price, product.url, itemId);
};

const insertItem = (db: DatabaseConnection, product: Item, storeId: number): number => {
  const stmt = db.prepare(`
    INSERT INTO item (price, name, url, store_id, item_type) 
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    product.price,
    product.name,
    product.url,
    storeId,
    product.category
  );
  return result.lastInsertRowid as number;
};

const getOrCreateItemId = (db: DatabaseConnection, product: Item, storeId: number): number => {
  const existingId = findItemId(db, product, storeId);
  if (existingId) {
    updateItem(db, product, existingId);
    return existingId;
  }
  return insertItem(db, product, storeId);
};

const createScrapeRecord = (db: DatabaseConnection): number => {
  const stmt = db.prepare('INSERT INTO scrape (timestamp) VALUES (?)');
  const result = stmt.run(new Date().toISOString());
  return result.lastInsertRowid as number;
};

const linkItemToScrape = (db: DatabaseConnection, scrapeId: number, itemId: number): void => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scrape_item (scrape_id, item_id) 
    VALUES (?, ?)
  `);
  stmt.run(scrapeId, itemId);
};

const processProduct = (db: DatabaseConnection, product: Item, scrapeId: number): void => {
  const storeId = getOrCreateStoreId(db, product.store);
  const itemId = getOrCreateItemId(db, product, storeId);
  linkItemToScrape(db, scrapeId, itemId);
};

const saveProductsToDatabase = (db: DatabaseConnection, products: readonly Item[]): number => {
  const scrapeId = createScrapeRecord(db);
  
  const transaction = db.transaction((products: readonly Item[]) => {
    products.forEach(product => processProduct(db, product, scrapeId));
  });

  transaction(products);
  return scrapeId;
};

const queryLatestProducts = (db: DatabaseConnection, limit: number): readonly Item[] => {
  const stmt = db.prepare(`
    SELECT i.name, i.price, i.url, s.name as store, i.item_type as category
    FROM item i
    JOIN store s ON i.store_id = s.id
    ORDER BY i.id DESC
    LIMIT ?
  `);

  const results = stmt.all(limit) as Array<{
    name: string;
    price: number;
    url: string;
    store: string;
    category: string;
  }>;

  return results.map(row => ({
    name: row.name,
    price: row.price,
    url: row.url,
    store: row.store,
    category: row.category as 'GPU' | 'CPU'
  }));
};

const queryProductsByCategory = (db: DatabaseConnection, category: 'GPU' | 'CPU', limit: number): readonly Item[] => {
  const stmt = db.prepare(`
    SELECT i.name, i.price, i.url, s.name as store, i.item_type as category
    FROM item i
    JOIN store s ON i.store_id = s.id
    WHERE i.item_type = ?
    ORDER BY i.id DESC
    LIMIT ?
  `);

  const results = stmt.all(category, limit) as Array<{
    name: string;
    price: number;
    url: string;
    store: string;
    category: string;
  }>;

  return results.map(row => ({
    name: row.name,
    price: row.price,
    url: row.url,
    store: row.store,
    category: row.category as 'GPU' | 'CPU'
  }));
};

const queryProductsByStore = (db: DatabaseConnection, store: string, limit: number): readonly Item[] => {
  const stmt = db.prepare(`
    SELECT i.name, i.price, i.url, s.name as store, i.item_type as category
    FROM item i
    JOIN store s ON i.store_id = s.id
    WHERE s.name = ?
    ORDER BY i.id DESC
    LIMIT ?
  `);

  const results = stmt.all(store, limit) as Array<{
    name: string;
    price: number;
    url: string;
    store: string;
    category: string;
  }>;

  return results.map(row => ({
    name: row.name,
    price: row.price,
    url: row.url,
    store: row.store,
    category: row.category as 'GPU' | 'CPU'
  }));
};

const queryProductStats = (db: DatabaseConnection): { readonly total: number; readonly gpu: number; readonly cpu: number; readonly stores: readonly string[] } => {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM item');
  const categoryStmt = db.prepare(`
    SELECT item_type, COUNT(*) as count 
    FROM item 
    GROUP BY item_type
  `);
  const storesStmt = db.prepare(`
    SELECT DISTINCT name 
    FROM store 
    ORDER BY name
  `);

  const total = totalStmt.get() as { count: number };
  const categories = categoryStmt.all() as Array<{ item_type: string; count: number }>;
  const stores = storesStmt.all() as Array<{ name: string }>;

  const gpu = categories.find(c => c.item_type === 'GPU')?.count ?? 0;
  const cpu = categories.find(c => c.item_type === 'CPU')?.count ?? 0;

  return {
    total: total.count,
    gpu,
    cpu,
    stores: stores.map(s => s.name)
  };
};

const db = createDatabaseConnection();

export const saveProducts = (products: readonly Item[]): number => {
  const scrapeId = saveProductsToDatabase(db, products);
  console.log(`💾 Saved ${products.length} products to database (scrape_id: ${scrapeId})`);
  return scrapeId;
};

export const getLatestProducts = (limit: number = 50): readonly Item[] => 
  queryLatestProducts(db, limit);

export const getProductsByCategory = (category: 'GPU' | 'CPU', limit: number = 50): readonly Item[] => 
  queryProductsByCategory(db, category, limit);

export const getProductsByStore = (store: string, limit: number = 50): readonly Item[] => 
  queryProductsByStore(db, store, limit);

export const getProductStats = (): { readonly total: number; readonly gpu: number; readonly cpu: number; readonly stores: readonly string[] } => 
  queryProductStats(db); 