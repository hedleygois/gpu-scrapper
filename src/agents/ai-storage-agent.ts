import OpenAI from 'openai';
import { Item, ScrapingResult, MarketTrends, AIAnalysisResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { SEARCH_TERMS } from '../config/stores.js';

type OpenAIClient = OpenAI;
type LogFilePath = string;

const createOpenAIClient = (apiKey?: string): OpenAIClient => 
  new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });

const getLogFilePath = (): LogFilePath => 
  path.join(process.cwd(), 'openai_responses.log');

const getMarketTrendsLogFilePath = (): LogFilePath => 
  path.join(process.cwd(), 'market_trends.log');

const formatLogEntry = (timestamp: string, method: string, response: any, error?: any): string => {
  const separator = '='.repeat(80);
  
  let logContent = '';
  logContent += `${separator}\n`;
  logContent += `TIMESTAMP: ${timestamp}\n`;
  logContent += `METHOD: ${method}\n`;
  logContent += `${separator}\n`;
  
  if (error) {
    logContent += `❌ ERROR:\n`;
    logContent += `Error Message: ${error.message ?? 'Unknown error'}\n`;
    logContent += `Error Stack: ${error.stack ?? 'No stack trace'}\n`;
  } else {
    logContent += `✅ SUCCESS:\n`;
    const responseContent = response?.choices?.[0]?.message?.content ?? 'No content';
    logContent += `Response Content:\n${responseContent}\n`;
  }
  
  logContent += `${separator}\n\n`;
  
  return logContent;
};

const logResponse = async (logFilePath: LogFilePath, method: string, response: any, error?: any): Promise<void> => {
  const timestamp = new Date().toISOString();
  const logContent = formatLogEntry(timestamp, method, response, error);
  await fs.appendFile(logFilePath, logContent);
};

const createAnalysisPrompt = (result: ScrapingResult): string => `
Analyze these scraped products and optimize them:

Products: ${JSON.stringify(result.products, null, 2)}
Errors: ${JSON.stringify(result.errors, null, 2)}

Tasks:
1. Validate product data (remove invalid entries)
2. Normalize product names (remove extra spaces, standardize formatting)
3. Validate prices (ensure they're reasonable numbers)
4. Categorize products more accurately (GPU vs CPU)
5. Identify potential data quality issues
6. Suggest any missing critical information

Return a JSON object with:
- products: Array of optimized products
- errors: Updated error list
- insights: AI-generated insights about the data quality
- recommendations: Suggestions for improving future scraping
`;

const createMarketTrendsPrompt = (products: readonly Item[]): string => `
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

const createDeduplicationPrompt = (products: readonly Item[]): string => `
Analyze these products and remove duplicates. Consider:
- Same product name and store
- Focus on the names listed at ${JSON.stringify(SEARCH_TERMS, null, 2)}
- Similar products with slight name variations
- Keep the one with the most complete information

Products:
${JSON.stringify(products, null, 2)}

Return a JSON array of unique products only.
`;

const callOpenAI = async (
  client: OpenAIClient, 
  prompt: string, 
  maxTokens: number, 
  temperature: number
): Promise<any> => {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: temperature,
  });
  return response;
};

const parseAIResponse = (response: any): any => 
  JSON.parse(response?.choices?.[0]?.message?.content ?? '{}');

const analyzeAndOptimize = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  result: ScrapingResult
): Promise<AIAnalysisResult> => {
  const prompt = createAnalysisPrompt(result);

  try {
    const response = await callOpenAI(client, prompt, 2000, 0.3);
    await logResponse(logFilePath, 'analyzeAndOptimize', response);

    console.log('🤖 AI Analysis Response:', response.choices[0]?.message?.content);

    const analysis = parseAIResponse(response);

    if (analysis.insights) {
      console.log('🤖 AI Insights:', analysis.insights);
    }
    
    if (analysis.recommendations) {
      console.log('💡 AI Recommendations:', analysis.recommendations);
    }

    return {
      products: analysis.products ?? result.products,
      errors: analysis.errors ?? result.errors,
      insights: analysis.insights,
      recommendations: analysis.recommendations
    };
  } catch (error) {
    await logResponse(logFilePath, 'analyzeAndOptimize', null, error);
    console.error('❌ AI analysis failed:', error);
    console.warn('AI analysis failed, using original data');
    return {
      products: result.products,
      errors: result.errors
    };
  }
};

const generateInsights = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  result: ScrapingResult
): Promise<any> => {
  const prompt = `
Analyze this product data and provide insights:

Products: ${JSON.stringify(result.products, null, 2)}

Provide insights on:
1. Price trends and ranges
2. Store availability and distribution
3. Product category distribution
4. Data quality assessment
5. Market observations
6. Potential opportunities or anomalies

Return as JSON with structured insights.
`;

  try {
    const response = await callOpenAI(client, prompt, 1000, 0.3);
    await logResponse(logFilePath, 'generateInsights', response);

    console.log('🤖 AI Insights Response:', response.choices[0]?.message?.content);

    return parseAIResponse(response);
  } catch (error) {
    await logResponse(logFilePath, 'generateInsights', null, error);
    console.error('❌ Failed to generate insights:', error);
    return { error: 'Failed to generate insights' };
  }
};

const generateFallbackReport = (result: ScrapingResult): string => {
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
};

const formatResults = (result: ScrapingResult): void => {
  const report = generateFallbackReport(result);
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 SCRAPING RESULTS SUMMARY");
  console.log("=".repeat(50));
  console.log(report);
  console.log("=".repeat(50));
};

const analyzeMarketTrends = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  products: readonly Item[]
): Promise<MarketTrends> => {
  const prompt = createMarketTrendsPrompt(products);

  try {
    const response = await callOpenAI(client, prompt, 32768, 0.2);
    await logResponse(logFilePath, 'analyzeMarketTrends', response);

    console.log('🤖 Market Trends Analysis Response:', response.choices[0]?.message?.content);

    return parseAIResponse(response);
  } catch (error) {
    await logResponse(logFilePath, 'analyzeMarketTrends', null, error);
    console.error('❌ Failed to analyze market trends:', error);
    return { error: 'Failed to analyze market trends' };
  }
};

const deduplicateProducts = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  products: readonly Item[]
): Promise<readonly Item[]> => {
  if (products.length === 0) return products;

  const prompt = createDeduplicationPrompt(products);

  try {
    const response = await callOpenAI(client, prompt, 5000, 0.1);
    await logResponse(logFilePath, 'deduplicateProducts', response);

    console.log('🤖 Deduplication Response:', response.choices[0]?.message?.content);

    return parseAIResponse(response);
  } catch (error) {
    await logResponse(logFilePath, 'deduplicateProducts', null, error);
    console.error('❌ AI deduplication failed:', error);
    console.warn('AI deduplication failed, using fallback method');
    return products.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.name === product.name && p.store === product.store)
    );
  }
};

const formatMarketTrendsLog = (timestamp: string, marketTrends: MarketTrends): string => {
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
  
  return logContent;
};

const logMarketTrends = async (marketTrends: MarketTrends): Promise<void> => {
  const timestamp = new Date().toISOString();
  const logContent = formatMarketTrendsLog(timestamp, marketTrends);
  const marketTrendsFilePath = getMarketTrendsLogFilePath();
  await fs.appendFile(marketTrendsFilePath, logContent);
};

export class AIStorageAgent {
  private readonly openai: OpenAIClient;
  private readonly logFilePath: LogFilePath;

  constructor(apiKey?: string) {
    this.openai = createOpenAIClient(apiKey);
    this.logFilePath = getLogFilePath();
  }

  async analyzeAndOptimize(result: ScrapingResult): Promise<AIAnalysisResult> {
    return analyzeAndOptimize(this.openai, this.logFilePath, result);
  }

  async formatResults(result: ScrapingResult): Promise<void> {
    return formatResults(result);
  }

  async analyzeMarketTrends(products: readonly Item[]): Promise<MarketTrends> {
    return analyzeMarketTrends(this.openai, this.logFilePath, products);
  }

  async deduplicateProducts(products: readonly Item[]): Promise<readonly Item[]> {
    return deduplicateProducts(this.openai, this.logFilePath, products);
  }

  async logMarketTrends(marketTrends: MarketTrends): Promise<void> {
    return logMarketTrends(marketTrends);
  }
} 