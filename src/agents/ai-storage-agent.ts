import OpenAI from 'openai';
import { Item, ScrapingResult, AIAnalysisResult } from '../types.js';
import { McpTool } from '../mcp-client.js';
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

const createToolSelectionPrompt = (tools: readonly McpTool[], dataDescription: string): string => `
You are an expert at analyzing MCP (Model Context Protocol) tools and selecting the best one for a specific task.

Available MCP Tools:
${JSON.stringify(tools, null, 2)}

Task Description: ${dataDescription}

Data Structure: We need to save scraped electronics data (GPUs and CPUs) with the following structure:
- Scrape metadata (timestamp, total products, counts by category)
- Items array with product details (name, price, url, category, store)
- Nested store information within items

Requirements:
1. Tool should be capable of writing/persisting data
2. Tool should handle structured data (JSON objects)
3. Tool should support nested data structures
4. Tool should be suitable for batch operations
5. Tool should handle metadata and item arrays

Analyze each tool and select the BEST one for this task. Consider:
- Tool name and description relevance
- Input schema compatibility
- Parameter requirements
- Data structure support

Return ONLY a JSON object with:
{
  "selectedTool": "tool_name",
  "reasoning": "brief explanation of why this tool was selected",
  "confidence": 0.95
}
`;

const selectBestTool = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  tools: readonly McpTool[],
  dataDescription: string
): Promise<{ tool: McpTool; reasoning: string; confidence: number }> => {
  if (tools.length === 0) {
    throw new Error('No MCP tools available');
  }

  const prompt = createToolSelectionPrompt(tools, dataDescription);

  try {
    const response = await callOpenAI(client, prompt, 2000, 0.1);
    await logResponse(logFilePath, 'selectBestTool', response);

    const result = parseAIResponse(response);
    const selectedTool = tools.find(t => t.name === result.selectedTool);
    
    if (!selectedTool) {
      throw new Error(`Selected tool '${result.selectedTool}' not found in available tools`);
    }

    console.log(`🎯 Selected MCP tool: ${selectedTool.name}`);
    console.log(`💭 Reasoning: ${result.reasoning}`);
    console.log(`📊 Confidence: ${result.confidence}`);

    return {
      tool: selectedTool,
      reasoning: result.reasoning,
      confidence: result.confidence
    };
  } catch (error) {
    await logResponse(logFilePath, 'selectBestTool', null, error);
    console.error('❌ AI tool selection failed:', error);
    console.warn('🔄 Falling back to first available tool');
    
    return {
      tool: tools[0],
      reasoning: 'Fallback selection due to AI error',
      confidence: 0.5
    };
  }
};

const createMcpErrorAnalysisPrompt = (error: any, toolName: string): string => `
You are an expert at analyzing MCP (Model Context Protocol) errors and determining the best recovery strategy.

MCP Error Details:
- Tool: ${toolName}
- Error Code: ${error.code ?? 'Unknown'}
- Error Message: ${error.message ?? 'No message'}
- Error Data: ${JSON.stringify(error.data ?? {}, null, 2)}

Analyze this error and determine:
1. Is this a recoverable error (temporary issue, retryable)?
2. Is this a fatal error (permanent issue, tool incompatible)?
3. What specific action should be taken?

Consider common MCP error scenarios:
- Connection issues (recoverable)
- Authentication problems (fatal)
- Tool not found (fatal)
- Invalid parameters (recoverable with parameter fix)
- Server overload (recoverable with retry)
- Tool incompatibility (fatal)

Return ONLY a JSON object:
{
  "isRecoverable": true/false,
  "isFatal": true/false,
  "action": "retry" | "fix_parameters" | "try_different_tool" | "abort",
  "reasoning": "detailed explanation",
  "retryDelay": 1000,
  "suggestedFix": "specific fix if applicable"
}
`;

const analyzeMcpError = async (
  client: OpenAIClient,
  logFilePath: LogFilePath,
  error: any,
  toolName: string
): Promise<{
  isRecoverable: boolean;
  isFatal: boolean;
  action: 'retry' | 'fix_parameters' | 'try_different_tool' | 'abort';
  reasoning: string;
  retryDelay: number;
  suggestedFix?: string;
}> => {
  const prompt = createMcpErrorAnalysisPrompt(error, toolName);

  try {
    const response = await callOpenAI(client, prompt, 1500, 0.1);
    await logResponse(logFilePath, 'analyzeMcpError', response);

    const result = parseAIResponse(response);
    
    console.log(`🔍 MCP Error Analysis:`);
    console.log(`   Recoverable: ${result.isRecoverable}`);
    console.log(`   Fatal: ${result.isFatal}`);
    console.log(`   Action: ${result.action}`);
    console.log(`   Reasoning: ${result.reasoning}`);

    return result;
  } catch (error) {
    await logResponse(logFilePath, 'analyzeMcpError', null, error);
    console.error('❌ AI error analysis failed:', error);
    console.warn('🔄 Using fallback error analysis');
    
    // Fallback: assume recoverable for most errors
    return {
      isRecoverable: true,
      isFatal: false,
      action: 'retry',
      reasoning: 'Fallback analysis - assuming recoverable',
      retryDelay: 2000
    };
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

  async selectBestMcpTool(tools: readonly McpTool[], dataDescription: string): Promise<{ tool: McpTool; reasoning: string; confidence: number }> {
    return selectBestTool(this.openai, this.logFilePath, tools, dataDescription);
  }

  async analyzeMcpError(error: any, toolName: string): Promise<{
    isRecoverable: boolean;
    isFatal: boolean;
    action: 'retry' | 'fix_parameters' | 'try_different_tool' | 'abort';
    reasoning: string;
    retryDelay: number;
    suggestedFix?: string;
  }> {
    return analyzeMcpError(this.openai, this.logFilePath, error, toolName);
  }
} 