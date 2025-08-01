export interface Item {
  name: string;
  price: number;
  url: string;
  store: string;
  category: "GPU" | "CPU";
}

export interface ScrapingResult {
  products: Item[];
  errors: string[];
} 