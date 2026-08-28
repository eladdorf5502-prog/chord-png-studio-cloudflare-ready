import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the chord editor directly", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Chord PNG Studio<\/title>/i);
  assert.match(html, /Chord Presets/);
  assert.match(html, /String Editor/);
  assert.match(html, /Fret Number Size/);
  assert.match(html, /Fret Badge Opacity/);
  assert.match(html, /Dark Fret Number Badge/);
  assert.match(html, /Black Fret Number Outline/);
  assert.match(html, /Save as Standard/);
  assert.match(html, /Reset to Standard/);
  assert.match(html, /Live preview/);
  assert.match(html, /Preview background/);
  assert.match(html, />Photo</);
  assert.match(html, /PNG stays transparent/);
  assert.match(html, /Export PNG/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
