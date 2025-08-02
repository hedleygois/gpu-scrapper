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

export interface MarketTrends {
  readonly priceAnalysis?: {
    readonly averageGPUPrice?: number;
    readonly averageCPUPrice?: number;
    readonly priceRange?: {
      readonly min: number;
      readonly max: number;
    };
  };
  readonly storeAnalysis?: {
    readonly mostExpensive?: string;
    readonly mostAffordable?: string;
  };
  readonly recommendations?: readonly string[];
  readonly error?: string;
}

export interface AIAnalysisResult {
  readonly products: readonly Item[];
  readonly errors: readonly string[];
  readonly insights?: string;
  readonly recommendations?: string;
} 