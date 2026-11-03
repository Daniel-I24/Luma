import { assertEquals } from '@std/assert';

import { readBody, readJson } from './edge.ts';

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://localhost/f', { method: 'POST', body, headers });

function streamOf(chunks: number, chunkBytes: number): { stream: ReadableStream<Uint8Array>; pulled: () => number } {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) return controller.close();
      sent++;
      controller.enqueue(new Uint8Array(chunkBytes));
    },
  });
  return { stream, pulled: () => sent };
}

Deno.test('readJson parses small JSON bodies and rejects bad ones', async () => {
  assertEquals(await readJson(post('{"a":1}')), { a: 1 });
  assertEquals(await readJson(post('not json')), null);
  assertEquals(await readJson(post('"' + 'x'.repeat(3000) + '"')), null);
});

Deno.test('a declared Content-Length over the limit is rejected before reading', async () => {
  const { stream, pulled } = streamOf(10, 1024);
  assertEquals(await readBody(post(stream, { 'Content-Length': '999999' }), 2048), null);
  assertEquals(pulled() <= 1, true);
});

Deno.test('a body without length stops being read past the limit', async () => {
  const { stream, pulled } = streamOf(1000, 1024);
  assertEquals(await readBody(post(stream), 4096), null);
  assertEquals(pulled() < 10, true);
});

Deno.test('a body within the limit is read whole', async () => {
  const { stream } = streamOf(3, 1000);
  assertEquals((await readBody(post(stream), 4096))?.byteLength, 3000);
});
