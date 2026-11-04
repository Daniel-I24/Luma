import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readEnv, smoke } from './ai-smoke.mjs';

const ENV = { LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-3.6-flash', LLM_API_KEY: 'secret-key' };
const MENU = JSON.stringify({ items: [{ name: 'Calentado', description: null, price_cop: 12000, section: 'Desayunos' }, { name: 'Tinto', description: null, price_cop: 2000, section: 'Bebidas' }] });

/** A simulated Gemini: each call takes the next answer; requests are kept. */
function gemini(...answers) {
  const requests = [];
  const fetchFn = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    const next = answers.shift();
    if (typeof next === 'number') return new Response('{"error":{}}', { status: next });
    return new Response(JSON.stringify({ candidates: [{ finishReason: next.finish ?? 'STOP', content: { parts: [{ text: next.text ?? '' }] } }] }));
  };
  return { fetchFn, requests };
}

test('extract-menu: the fixture photo goes through the function path; OK with the number of products', async () => {
  const { fetchFn, requests } = gemini({ text: MENU });
  assert.equal(await smoke('extract-menu', ENV, fetchFn), 'OK: extract-menu leyo 2 productos (gemini-3.6-flash)');
  assert.equal(requests[0].body.contents[0].parts.some((p) => p.inlineData?.mimeType === 'image/png'), true);
  assert.equal(requests[0].body.generationConfig.maxOutputTokens, 8192);
  assert.deepEqual(requests[0].body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
});

test('MAX_TOKENS is provider_truncated after one retry with twice the budget', async () => {
  const { fetchFn, requests } = gemini({ finish: 'MAX_TOKENS' }, { finish: 'MAX_TOKENS' });
  assert.equal(await smoke('extract-menu', ENV, fetchFn), 'FALLO: extract-menu 503 provider_truncated');
  assert.deepEqual(requests.map((r) => r.body.generationConfig.maxOutputTokens), [8192, 16384]);
});

test('the exact reason is printed, and rate limits or an unknown model go to the fallback model', async () => {
  const refused = gemini(403);
  assert.equal(await smoke('extract-menu', ENV, refused.fetchFn), 'FALLO: extract-menu 503 provider_auth');
  assert.equal(refused.requests.length, 1, 'a refused key never reaches the fallback');
  for (const status of [429, 404]) {
    const { fetchFn, requests } = gemini(status, { text: MENU });
    const line = await smoke('extract-menu', { ...ENV, LLM_FALLBACK_MODEL: 'gemini-3.5-flash-lite' }, fetchFn);
    assert.match(line, /^OK/, String(status));
    assert.match(requests.at(-1).url, /gemini-3\.5-flash-lite/);
  }
});

test('recommend: two sample businesses, 2048 tokens; without secrets it says so', async () => {
  const { fetchFn, requests } = gemini({ text: '{"businesses":[{"id":"b1","reason":"moment_fit"}],"combo":null}' });
  assert.equal(await smoke('recommend', ENV, fetchFn), 'OK: recommend eligio 1 negocios (gemini-3.6-flash)');
  assert.equal(requests[0].body.generationConfig.maxOutputTokens, 2048);
  assert.match(await smoke('extract-menu', null), /^FALLO: no hay functions\.env/);
  const dir = mkdtempSync(join(tmpdir(), 'luma-secrets-'));
  writeFileSync(join(dir, 'functions.env'), "LLM_API_KEY='abc'\r\n# comment\nLLM_MODEL=m\n");
  assert.deepEqual(readEnv(dir), { LLM_API_KEY: 'abc', LLM_MODEL: 'm' });
});
