CREATE TABLE IF NOT EXISTS scrape (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY,
    price REAL NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    store_id INTEGER NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('CPU', 'GPU')),
    FOREIGN KEY (store_id) REFERENCES store(id)
);

CREATE TABLE IF NOT EXISTS scrape_item (
    scrape_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    PRIMARY KEY (scrape_id, item_id),
    FOREIGN KEY (scrape_id) REFERENCES scrape(id),
    FOREIGN KEY (item_id) REFERENCES item(id)
);
