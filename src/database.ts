import Database from 'better-sqlite3';
import { Item } from './index.js';

const db = new Database('./data/db.sqlite');

const getOrCreateStore = (storeName: string): number => {
  const findStmt = db.prepare('SELECT id FROM store WHERE name = ?');
  const existing = findStmt.get(storeName) as { id: number } | undefined;
  
  if (existing) {
    return existing.id;
  }
  
  const insertStmt = db.prepare('INSERT INTO store (name) VALUES (?)');
  const result = insertStmt.run(storeName);
  return result.lastInsertRowid as number;
};

const getOrCreateItem = (product: Item, storeId: number): number => {
  const findStmt = db.prepare(`
    SELECT id FROM item 
    WHERE name = ? AND store_id = ? AND item_type = ?
  `);
  const existing = findStmt.get(product.name, storeId, product.category) as { id: number } | undefined;
  
  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE item 
      SET price = ?, url = ? 
      WHERE id = ?
    `);
    updateStmt.run(product.price, product.url, existing.id);
    return existing.id;
  }
  
  const insertStmt = db.prepare(`
    INSERT INTO item (price, name, url, store_id, item_type) 
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = insertStmt.run(
    product.price,
    product.name,
    product.url,
    storeId,
    product.category
  );
  return result.lastInsertRowid as number;
};

const saveProducts = (products: Item[]): void => {
  const scrapeStmt = db.prepare('INSERT INTO scrape (timestamp) VALUES (?)');
  const scrapeResult = scrapeStmt.run(new Date().toISOString());
  const scrapeId = scrapeResult.lastInsertRowid as number;
  
  const transaction = db.transaction((products: Item[]) => {
    for (const product of products) {
      const storeId = getOrCreateStore(product.store);
      
      const itemId = getOrCreateItem(product, storeId);
      
      const linkStmt = db.prepare(`
        INSERT OR IGNORE INTO scrape_item (scrape_id, item_id) 
        VALUES (?, ?)
      `);
      linkStmt.run(scrapeId, itemId);
    }
  });

  transaction(products);
  console.log(`💾 Saved ${products.length} products to database (scrape_id: ${scrapeId})`);
};

const getLatestProducts = (limit: number = 50): Item[] => {
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

const getProductsByCategory = (category: 'GPU' | 'CPU', limit: number = 50): Item[] => {
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

const getProductsByStore = (store: string, limit: number = 50): Item[] => {
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

const getProductStats = (): { total: number; gpu: number; cpu: number; stores: string[] } => {
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

  const gpu = categories.find(c => c.item_type === 'GPU')?.count || 0;
  const cpu = categories.find(c => c.item_type === 'CPU')?.count || 0;

  return {
    total: total.count,
    gpu,
    cpu,
    stores: stores.map(s => s.name)
  };
};

export {
  saveProducts,
  getLatestProducts,
  getProductsByCategory,
  getProductsByStore,
  getProductStats
}; 