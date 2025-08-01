import OpenAI from 'openai';
import { Item, ScrapingResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { SEARCH_TERMS } from '../config/stores.js';

export class AIStorageAgent {
  private openai: OpenAI;
  private logFilePath: string;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    this.logFilePath = path.join(process.cwd(), 'openai_responses.log');
  }

  private async logResponse(method: string, response: any, error?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const separator = '='.repeat(80);
    
    let logContent = '';
    logContent += `${separator}\n`;
    logContent += `TIMESTAMP: ${timestamp}\n`;
    logContent += `METHOD: ${method}\n`;
    logContent += `${separator}\n`;
    
    if (error) {
      logContent += `❌ ERROR:\n`;
      logContent += `Error Message: ${error.message || 'Unknown error'}\n`;
      logContent += `Error Stack: ${error.stack || 'No stack trace'}\n`;
    } else {
      logContent += `✅ SUCCESS:\n`;
      const responseContent = response?.choices?.[0]?.message?.content || 'No content';
      logContent += `Response Content:\n${responseContent}\n`;
    }
    
    logContent += `${separator}\n\n`;
    
    await fs.appendFile(this.logFilePath, logContent);
  }

  async formatResults(result: ScrapingResult): Promise<void> {
    const report = this.generateFallbackReport(result);
    
    console.log("\n" + "=".repeat(50));
    console.log("📊 SCRAPING RESULTS SUMMARY");
    console.log("=".repeat(50));
    console.log(report);
    console.log("=".repeat(50));
  }

  private generateFallbackReport(result: ScrapingResult): string {
    const { products, errors } = result;
    const gpus = products.filter((p) => p.category === "GPU");
    const cpus = products.filter((p) => p.category === "CPU");

    return `
📊 SCRAPING RESULTS SUMMARY

🎯 Total Products Found: ${products.length}
🎮 GPUs: ${gpus.length}
🖥️ CPUs: ${cpus.length}

🏪 Stores Scraped: ${[...new Set(products.map(p => p.store))].join(', ')}

💰 Price Range:
   - GPU: €${gpus.length > 0 ? Math.min(...gpus.map(p => p.price)) : 'N/A'} - €${gpus.length > 0 ? Math.max(...gpus.map(p => p.price)) : 'N/A'}
   - CPU: €${cpus.length > 0 ? Math.min(...cpus.map(p => p.price)) : 'N/A'} - €${cpus.length > 0 ? Math.max(...cpus.map(p => p.price)) : 'N/A'}

❌ Errors: ${errors.length}
${errors.map(e => `   - ${e}`).join('\n')}
    `;
  }

  async analyzeMarketTrends(products: Item[]): Promise<any> {
    const prompt = `
    Analyze market trends from this product data:
    
    ${JSON.stringify(products, null, 2)}
    
    Provide analysis on:
    1. Price trends and market positioning
    2. Brand distribution and popularity
    3. Store pricing strategies
    4. Product availability patterns
    5. Market opportunities
    6. Competitive insights
    7. Current prices for each product are below or above the average price (return one line for each product)
    
    Return as structured JSON analysis. Make sure to format string correctly. Always wrap key value within double quotes.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 32768,
        temperature: 0.2,
      });
      
      await this.logResponse('analyzeMarketTrends', response);

      console.log('🤖 Market Trends Analysis Response:', response.choices[0]?.message?.content);

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
        await this.logResponse('analyzeMarketTrends', null, error);
      console.error('❌ Failed to analyze market trends:', error);
      return { error: 'Failed to analyze market trends' };
    }
  }

  async deduplicateProducts(products: Item[]): Promise<Item[]> {
    if (products.length === 0) return products;

    const prompt = `
    Analyze these products and remove duplicates. Consider:
    - Same product name and store
    - Focus on the names listed at ${JSON.stringify(SEARCH_TERMS, null, 2)}
    - Similar products with slight name variations
    - Keep the one with the most complete information
    
    Products:
    ${JSON.stringify(products, null, 2)}
    
    Return a JSON array of unique products only.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 5000,
        temperature: 0.1,
      });

      await this.logResponse('deduplicateProducts', response);

      console.log('🤖 Deduplication Response:', response.choices[0]?.message?.content);

      return JSON.parse(response.choices[0]?.message?.content || '[]');
    } catch (error) {
      await this.logResponse('deduplicateProducts', null, error);
      console.error('❌ AI deduplication failed:', error);
      console.warn('AI deduplication failed, using fallback method');
      return products.filter(
        (product, index, self) =>
          index === self.findIndex((p) => p.name === product.name && p.store === product.store)
      );
    }
  }

  async logMarketTrends(marketTrends: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const separator = '='.repeat(80);
    
    let logContent = '';
    logContent += `${separator}\n`;
    logContent += `MARKET TRENDS ANALYSIS\n`;
    logContent += `TIMESTAMP: ${timestamp}\n`;
    logContent += `${separator}\n`;
    
    if (marketTrends.error) {
      logContent += `❌ ERROR: ${marketTrends.error}\n`;
    } else {
      logContent += `📊 MARKET TRENDS DATA:\n`;
      logContent += `${JSON.stringify(marketTrends, null, 2)}\n`;
    }
    
    logContent += `${separator}\n\n`;
    
    const marketTrendsFilePath = path.join(process.cwd(), 'market_trends.log');
    await fs.appendFile(marketTrendsFilePath, logContent);
  }
} 