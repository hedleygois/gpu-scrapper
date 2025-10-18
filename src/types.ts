export interface Item {
  readonly name: string;
  readonly price: number;
  readonly url: string;
  readonly store: string;
  readonly category: "GPU" | "CPU";
}

export interface ScrapingResult {
  readonly products: readonly Item[];
  readonly errors: readonly string[];
}


export interface AIAnalysisResult {
  readonly products: readonly Item[];
  readonly errors: readonly string[];
  readonly insights?: string;
  readonly recommendations?: string;
} 