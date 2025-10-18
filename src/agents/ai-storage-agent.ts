import OpenAI from 'openai';
import { Item, ScrapingResult, AIAnalysisResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { SEARCH_TERMS } from '../config/stores.js';

type OpenAIClient = OpenAI;
type LogFilePath = string;

const createOpenAIClient = (apiKey?: string): OpenAIClient => 
  new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });

const getLogFilePath = (): LogFilePath => 
  path.join(process.cwd(), 'openai_responses.log');

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



export class AIStorageAgent {
  private readonly openai: OpenAIClient;
  private readonly logFilePath: LogFilePath;

  constructor(apiKey?: string) {
    this.openai = createOpenAIClient(apiKey);
    this.logFilePath = getLogFilePath();
  }

  async formatResults(result: ScrapingResult): Promise<void> {
    return formatResults(result);
  }

  async deduplicateProducts(products: readonly Item[]): Promise<readonly Item[]> {
    return deduplicateProducts(this.openai, this.logFilePath, products);
  }
} 