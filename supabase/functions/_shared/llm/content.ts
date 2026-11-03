import type { LlmRequest } from './types.ts';

/** The user turn of each provider: images (when any) and the text data. */

export function geminiParts(request: LlmRequest): unknown[] {
  return [
    ...(request.images ?? []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })),
    { text: request.user },
  ];
}

export function openAiContent(request: LlmRequest): unknown {
  if (!request.images?.length) return request.user;
  return [
    { type: 'text', text: request.user },
    ...request.images.map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })),
  ];
}

export function anthropicContent(request: LlmRequest): unknown {
  if (!request.images?.length) return request.user;
  return [
    ...request.images.map((image) => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
    })),
    { type: 'text', text: request.user },
  ];
}
