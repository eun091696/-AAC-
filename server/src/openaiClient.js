'use strict';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

class OpenAIError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
    this.cause = cause;
  }
}

class OpenAITimeoutError extends Error {
  constructor() {
    super('OpenAI request timed out');
    this.name = 'OpenAITimeoutError';
  }
}

/**
 * Creates a client for OpenAI's images generation endpoint.
 * `fetchImpl` is injectable for tests (defaults to global fetch, built into Node).
 */
function createOpenAIClient({ apiKey, model, timeoutMs, fetchImpl = fetch }) {
  async function generateImage({ prompt, size, quality }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Only officially supported gpt-image-1 params: model, prompt, size,
      // quality, n. No extra/unsupported params are sent.
      const body = { model, prompt, size, n: 1 };
      if (quality) body.quality = quality;
      const res = await fetchImpl(OPENAI_IMAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errBody = await res.json();
          detail = errBody?.error?.message || '';
        } catch {
          // ignore parse failure, keep detail empty
        }
        throw new OpenAIError(`OpenAI API error (${res.status})${detail ? `: ${detail}` : ''}`, {
          status: res.status,
        });
      }

      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) {
        throw new OpenAIError('OpenAI response missing image data');
      }
      return Buffer.from(b64, 'base64');
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new OpenAITimeoutError();
      }
      if (err instanceof OpenAIError) throw err;
      throw new OpenAIError(err.message, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  return { generateImage };
}

module.exports = { createOpenAIClient, OpenAIError, OpenAITimeoutError };
