import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: string;
    readonly properties: Record<string, any>;
    readonly required?: readonly string[];
  };
}

export interface McpToolListResponse {
  readonly tools: readonly McpTool[];
}

export interface McpCallRequest {
  readonly method: string;
  readonly params?: Record<string, any>;
}

export interface McpCallResponse {
  readonly result?: any;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: any;
  };
}

export interface McpConnectionOptions {
  readonly url?: string;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
}

export class McpClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private isConnected: boolean = false;
  private pendingCalls: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private callIdCounter: number = 0;

  constructor(options: McpConnectionOptions = {}) {
    super();
    this.url = process.env.MCP_SERVER_URL ?? 'ws://localhost:8081/ws';
    this.timeout = options.timeout ?? 30000;
    this.retryAttempts = options.retryAttempts ?? 1;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const connectWithRetry = async (attempt: number = 1): Promise<void> => {
        try {
          console.log(`🔌 Connecting to MCP server at ${this.url} (attempt ${attempt}/${this.retryAttempts})...`);
          
          this.ws = new WebSocket(this.url);
          
          this.ws.on('open', () => {
            console.log('✅ Connected to MCP server');
            this.isConnected = true;
            this.emit('connected');
            resolve();
          });

          this.ws.on('message', (data: WebSocket.Data) => {
            this.handleMessage(data);
          });

          this.ws.on('error', (error: Error & { code?: string }) => {
            console.error('❌ MCP WebSocket error:', error);
            this.emit('error', error);
            
            if (attempt < this.retryAttempts) {
              console.log(`🔄 Retrying connection in ${this.retryDelay}ms...`);
              setTimeout(() => connectWithRetry(attempt + 1), this.retryDelay);
            } else {
              const errorMsg = error.code === 'ECONNREFUSED' 
                ? `Failed to connect to MCP server at ${this.url}. Make sure the MCP server is running and accessible. ${error.message}`
                : `Failed to connect to MCP server after ${this.retryAttempts} attempts: ${error.message}`;
              reject(new Error(errorMsg));
            }
          });

          this.ws.on('close', (code: number, reason: string) => {
            console.log(`🔌 MCP connection closed: ${code} - ${reason}`);
            this.isConnected = false;
            this.emit('disconnected', { code, reason });
          });

          // Set connection timeout
          setTimeout(() => {
            if (!this.isConnected) {
              this.ws?.close();
              reject(new Error('Connection timeout'));
            }
          }, this.timeout);

        } catch (error) {
          if (attempt < this.retryAttempts) {
            console.log(`🔄 Retrying connection in ${this.retryDelay}ms...`);
            setTimeout(() => connectWithRetry(attempt + 1), this.retryDelay);
          } else {
            reject(error);
          }
        }
      };

      connectWithRetry();
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws && this.isConnected) {
      this.ws.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from MCP server');
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.id && this.pendingCalls.has(message.id)) {
        const { resolve, reject } = this.pendingCalls.get(message.id)!;
        this.pendingCalls.delete(message.id);
        
        if (message.error) {
          reject(new Error(`MCP Error ${message.error.code}: ${message.error.message}`));
        } else {
          resolve(message.result);
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse MCP message:', error);
    }
  }

  private async callMethod(method: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to MCP server');
    }

    const callId = (++this.callIdCounter).toString();
    const request: McpCallRequest = {
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Store the promise resolvers
      this.pendingCalls.set(callId, { resolve, reject });

      // Send the request
      const message = {
        jsonrpc: '2.0',
        id: callId,
        ...request
      };

      this.ws!.send(JSON.stringify(message));

      // Set timeout for the call
      setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId);
          reject(new Error(`MCP call timeout for method: ${method}`));
        }
      }, this.timeout);
    });
  }

  async listTools(): Promise<readonly McpTool[]> {
    console.log('🔍 Discovering available MCP tools...');
    const response = await this.callMethod('tools/list');
    console.log(`📋 Found ${response.tools?.length ?? 0} available tools`);
    return response.tools ?? [];
  }

  async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    console.log(`🛠️  Calling MCP tool: ${toolName}`);
    return await this.callMethod('tools/call', {
      name: toolName,
      arguments: params
    });
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}