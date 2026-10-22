// Run with: node --test development-utils/tests/security-dependencies.test.cjs
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

test('query-string keeps its CommonJS decoder and malformed URI handling', () => {
  const queryString = require('query-string');
  assert.deepEqual(
    { ...queryString.parse('place=Lisbon%20%26%20Porto&bad=%E0%A4%A&tag=a&tag=b') },
    { bad: '%E0%A4%A', place: 'Lisbon & Porto', tag: ['a', 'b'] },
  );
  assert.equal(queryString.stringify({ place: 'Lisbon & Porto' }), 'place=Lisbon%20%26%20Porto');
});

test('the patched decoder handles a long malformed percent-encoded run', () => {
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const decode = require('decode-uri-component');
    const input = '%E0%A4'.repeat(10000);
    assert.equal(typeof decode, 'function');
    assert.equal(decode(input), input);
  `], { cwd: require('node:path').resolve(__dirname, '../..'), timeout: 5000 });
});

test('Metro reads PNG and SVG dimensions through image-size 2', () => {
  const { getAssetSize } = require('metro/private/Assets');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(getAssetSize('png', png, 'pixel.png'), { width: 1, height: 1 });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="34"></svg>');
  assert.deepEqual(getAssetSize('svg', svg, 'icon.svg'), { width: 12, height: 34 });
});

test('image-size rejects an ICNS chunk with zero length without looping', () => {
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { imageSize } = require('image-size');
    const input = Buffer.alloc(16);
    input.write('icns');
    input.writeUInt32BE(16, 4);
    input.write('ic07', 8);
    assert.throws(() => imageSize(input));
  `], { cwd: require('node:path').resolve(__dirname, '../..'), timeout: 5000 });
});

test('Tailwind processes variants with postcss-selector-parser 7', async () => {
  const result = await require('postcss')([
    require('tailwindcss')({
      content: [{ raw: '<div class="hover:bg-red-500 md:flex [&>a]:underline"></div>' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  assert.match(result.css, /background-color:/);
  assert.match(result.css, /display: flex/);
  assert.match(result.css, /text-decoration-line: underline/);
});
