import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSharePath,
  relativizeRootUrls,
  withShareBase,
} from './subPathHtml.js';

test('root-absolute local URLs in index.html become relative', () => {
  const html =
    '<img src="/logo.svg" alt=""><span data-logo-src="/logo.svg"></span>' +
    '<link href="//fonts.example/x.css"><a href="https://a.example/b">' +
    '<img src="./pin.svg">';
  assert.equal(
    relativizeRootUrls(html),
    '<img src="./logo.svg" alt=""><span data-logo-src="./logo.svg"></span>' +
      '<link href="//fonts.example/x.css"><a href="https://a.example/b">' +
      '<img src="./pin.svg">',
  );
});

test('Vue templates get bare relative URLs', () => {
  assert.equal(
    relativizeRootUrls('<img src="/pin.svg" alt="" />', ''),
    '<img src="pin.svg" alt="" />',
  );
});

test('a share link page resolves its relative URLs at the app root', () => {
  assert.equal(
    withShareBase('<html><head lang="en"><title>x</title></head></html>'),
    '<html><head lang="en">\n    <base href="../" /><title>x</title></head></html>',
  );
});

test('only /share/<code> counts as a share link', () => {
  assert.equal(isSharePath('/share/AQc'), true);
  assert.equal(isSharePath('/share/AQc/?lang=nl'), true);
  assert.equal(isSharePath('/share/'), false);
  assert.equal(isSharePath('/share/AQc/assets/x.js'), false);
  assert.equal(isSharePath('/'), false);
});
