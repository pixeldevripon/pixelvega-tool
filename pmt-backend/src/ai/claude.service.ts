import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface GenerateTextParams {
  model: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
}

export interface GenerateStructuredParams extends GenerateTextParams {
  schema: Record<string, unknown>;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Thin wrapper around @anthropic-ai/sdk, mirrors how SlackService/CloudinaryService
// wrap their own third party clients. The Anthropic client is built inside this
// constructor, not at the top of the file, to avoid the module load order trap this
// project already documented for auth.instance.ts and cloudinary.service.ts.
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const message = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: params.messages,
    });
    return {
      text: extractText(message.content),
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }

  // Asks Claude for structured output via output_config.format (a json_schema),
  // then parses the returned text as JSON here rather than relying on the SDK's
  // own parsed_output convenience property, so a malformed response surfaces as
  // a clear parse error instead of a silent type mismatch.
  async generateStructured<T>(
    params: GenerateStructuredParams,
  ): Promise<GenerateStructuredResult<T>> {
    const message = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
      output_config: { format: { type: 'json_schema', schema: params.schema } },
    });
    const text = extractText(message.content);
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch (error) {
      this.logger.error(`Claude structured output was not valid JSON: ${text}`);
      throw error;
    }
    return {
      data,
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
