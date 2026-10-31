#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MARK_COMMENT = '\u0000';
const MARK_EMPTY_EXPR = '\u0001';

const KW_BEFORE_REGEX = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'throw',
]);
const PUNCT_BEFORE_REGEX = new Set([
  '(', '[', ',', '=', '==', '===', '!=', '!==', '+=', '-=', '*=', '/=', '%=',
  '**=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '&&=', '||=', '??=', '=>',
  '&&', '||', '??', '?', ':', '!', '~', '&', '|', '^', ';', '{', '...',
]);
const JSX_PREV_VALUES = new Set([
  '=>', '(', '[', ',', '&&', '||', '??', '?', ':', '=', '==', '===', '!=',
  '!==', '+=', '-=', '*=', '/=', '%=', '!', '&', '|', '...',
  'return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete',
  'void', 'else', 'yield', 'await', 'throw',
]);
const KEYWORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'throw', 'if', 'while', 'for',
  'switch', 'with', 'break', 'continue', 'function', 'var', 'let', 'const',
  'class', 'extends', 'super', 'this', 'import', 'export', 'from', 'as',
  'default', 'try', 'catch', 'finally', 'debugger', 'true', 'false', 'null',
  'undefined', 'NaN', 'Infinity', 'satisfies', 'keyof', 'readonly', 'infer',
  'is', 'asserts', 'type', 'interface', 'enum', 'namespace', 'declare',
  'abstract', 'implements', 'private', 'public', 'protected', 'static',
  'get', 'set', 'async', 'of',
]);
const PUNCTS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=',
  '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
  '{', '}', '(', ')', '[', ']', ';', ',', '.', '<', '>', '+', '-', '*', '/',
  '%', '&', '|', '^', '~', '!', '?', ':', '=', '@', '#',
];
const DIRECTIVE_BODY_RE = /^\s*(?:eslint|jshint|jslint|ts-(?:ignore|expect-error|nocheck|check)|@ts-(?:ignore|expect-error|nocheck|check)|@vitest-environment|@vite\/|webpack|sourceMappingURL|@sourceURL|istanbul|c8|prettier|experimentalDecorators)\b/i;
const TS_REFERENCE_RE = /^\/{3}\s*<(?:reference|amd)/;
const LICENSE_BODY_RE = /@license|@copyright|@preserve|SPDX-License-Identifier|Permission is hereby granted|All rights reserved/i;

const WORD_RE = /[$_\p{ID_Start}][$_\p{ID_Continue}\u200C\u200D]*/yu;
const ID_START_RE = /[$_\p{ID_Start}]/u;
const NUM_RE = /0[xXoObB][0-9a-fA-F_]+n?|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9_]+)?n?/y;
const JSX_NAME_RE = /([A-Za-z][A-Za-z0-9._-]*)/y;
const JSX_ATTR_RE = /[A-Za-z_][-A-Za-z0-9_:]*/y;

function classifyCommentLang(text) {
  if (/[àâäçéèêëîïôöùûüœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ]/.test(text)) return 'fr';
  const frWords = text.match(/\b(?:le|la|les|des|du|une|cette|cet|avec|dans|pour|être|avoir|mais|tout|toute|non|oui|ici|cf|entre|sous|sur|avant|après|car|donc|quand|aussi|alors|exemple|remarque|attention|chose|lorsque|jusqu|hors|vers|chez|dès|déjà|encore|toujours|très|bien|peu|beaucoup)\b/gi);
  if (frWords && frWords.length >= 2) return 'fr';
  return 'en';
}

function commentBody(text) {
  return text
    .replace(/^\/\*+/, '')
    .replace(/\*\/$/, '')
    .replace(/^\/\/+/, '')
    .replace(/^#!.*$/, '')
    .trim();
}

function isDirective(text) {
  return TS_REFERENCE_RE.test(text) || DIRECTIVE_BODY_RE.test(commentBody(text));
}

function isLicense(text) {
  return LICENSE_BODY_RE.test(commentBody(text));
}

function lexTS(src, jsx) {
  const len = src.length;
  const tokens = [];
  const tokenStarts = [];
  const comments = [];
  const jsxEmpty = [];
  let i = 0;
  let line = 1;
  let prev = null;

  function err(msg) {
    const ctx = JSON.stringify(src.slice(Math.max(0, i - 70), Math.min(len, i + 70)));
    throw new Error(`TS lexer line ${line} offset ${i}: ${msg} | ctx: ${ctx}`);
  }
  function pushTok(type, value, start) {
    tokens.push({ type, value });
    tokenStarts.push(start);
    prev = { type, value };
  }
  function isRegexStart() {
    if (!prev) return true;
    if (prev.type === 'num' || prev.type === 'str' || prev.type === 'regex' || prev.type === 'tplText') return false;
    if (prev.type === 'kw') return KW_BEFORE_REGEX.has(prev.value);
    if (prev.type === 'id') return false;
    return PUNCT_BEFORE_REGEX.has(prev.value);
  }
  function readWord() {
    WORD_RE.lastIndex = i;
    const m = WORD_RE.exec(src);
    const w = m[0];
    const type = prev && (prev.value === '.' || prev.value === '?.') ? 'id' : (KEYWORDS.has(w) ? 'kw' : 'id');
    pushTok(type, w, i);
    i += w.length;
  }
  function readNumber() {
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(src);
    if (!m) err(`bad number at ${src.slice(i, i + 20)}`);
    pushTok('num', m[0], i);
    i += m[0].length;
  }
  function readString(q) {
    const start = i;
    i++;
    for (;;) {
      if (i >= len) err('unterminated string');
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === q) { i++; pushTok('str', src.slice(start, i), start); return; }
      if (c === '\n') err('newline in string');
      i++;
    }
  }
  function readRegex() {
    const start = i;
    i++;
    let inClass = false;
    for (;;) {
      if (i >= len) err('unterminated regex');
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') err('newline in regex');
      if (inClass) {
        if (c === ']') inClass = false;
        i++;
        continue;
      }
      if (c === '[') { inClass = true; i++; continue; }
      if (c === '/') { i++; break; }
      i++;
    }
    while (i < len && /[a-z]/i.test(src[i])) i++;
    pushTok('regex', src.slice(start, i), start);
  }
  function readTemplate() {
    pushTok('punct', '`', i);
    i++;
    let chunkStart = i;
    for (;;) {
      if (i >= len) err('unterminated template');
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') {
        if (i > chunkStart) pushTok('tplText', src.slice(chunkStart, i), chunkStart);
        pushTok('punct', '`', i);
        i++;
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        if (i > chunkStart) pushTok('tplText', src.slice(chunkStart, i), chunkStart);
        pushTok('punct', '${', i);
        i += 2;
        readTokens('}');
        if (src[i] !== '}') err('expected } in template');
        pushTok('punct', '}', i);
        i++;
        chunkStart = i;
        continue;
      }
      if (c === '\n') line++;
      i++;
    }
  }
  function readLineComment() {
    const start = i;
    const startLine = line;
    i += 2;
    while (i < len && src[i] !== '\n') i++;
    comments.push({ type: 'line', text: src.slice(start, i), start, end: i, line: startLine });
  }
  function readBlockComment() {
    const start = i;
    const startLine = line;
    i += 2;
    let closed = false;
    while (i < len) {
      if (src[i] === '*' && src[i + 1] === '/') { i += 2; closed = true; break; }
      if (src[i] === '\n') line++;
      i++;
    }
    if (!closed) err('unterminated block comment');
    comments.push({ type: 'block', text: src.slice(start, i), start, end: i, line: startLine });
  }
  function snapshot() {
    return { i, line, prev, t: tokens.length, c: comments.length, e: jsxEmpty.length, ts: tokenStarts.length };
  }
  function restore(s) {
    i = s.i; line = s.line; prev = s.prev;
    tokens.length = s.t; comments.length = s.c; jsxEmpty.length = s.e; tokenStarts.length = s.ts;
  }
  function scanJsxEmptyExpr() {
    let j = i + 1;
    for (;;) {
      if (j >= len) return { onlyComments: false };
      const c = src[j];
      if (c === '\n' || c === ' ' || c === '\t' || c === '\r') { j++; continue; }
      if (c === '}') return { onlyComments: true, close: j };
      if (c === '/' && src[j + 1] === '/') {
        while (j < len && src[j] !== '\n') j++;
        continue;
      }
      if (c === '/' && src[j + 1] === '*') {
        j += 2;
        while (j < len && !(src[j] === '*' && src[j + 1] === '/')) j++;
        j = Math.min(j + 2, len);
        continue;
      }
      return { onlyComments: false };
    }
  }
  function readJsxChildren(tagName) {
    for (;;) {
      if (i >= len) return false;
      const c = src[i];
      if (c === '<') {
        if (src[i + 1] === '/') {
          i += 2;
          if (tagName === null) {
            if (src[i] === '>') { pushTok('punct', '</>', i - 2); i++; return true; }
            return false;
          }
          JSX_NAME_RE.lastIndex = i;
          const m = JSX_NAME_RE.exec(src);
          if (!m || m[1] !== tagName) return false;
          pushTok('punct', '</', i - 2);
          pushTok('id', m[1], i);
          i += m[0].length;
          if (src[i] !== '>') return false;
          pushTok('punct', '>', i);
          i++;
          return true;
        }
        if (!readJsxTag(false)) return false;
        continue;
      }
      if (c === '{') {
        const scan = scanJsxEmptyExpr();
        if (scan.onlyComments) {
          jsxEmpty.push({ start: i, end: scan.close + 1 });
          i = scan.close + 1;
          continue;
        }
        pushTok('punct', '{', i);
        i++;
        readTokens('}');
        if (src[i] !== '}') return false;
        pushTok('punct', '}', i);
        i++;
        continue;
      }
      let j = i;
      while (j < len && src[j] !== '<' && src[j] !== '{') {
        if (src[j] === '\n') line++;
        j++;
      }
      if (j > i) pushTok('jsxText', src.slice(i, j), i);
      i = j;
    }
  }
  function readJsxAttrs(tagName) {
    for (;;) {
      if (i >= len) return false;
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '>') { pushTok('punct', '>', i); i++; return readJsxChildren(tagName); }
      if (c === '/' && src[i + 1] === '>') { pushTok('punct', '/>', i); i += 2; return true; }
      if (c === '/' && src[i + 1] === '*') { readBlockComment(); continue; }
      if (c === '{') {
        pushTok('punct', '{', i);
        i++;
        readTokens('}');
        if (src[i] !== '}') return false;
        pushTok('punct', '}', i);
        i++;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        JSX_ATTR_RE.lastIndex = i;
        const am = JSX_ATTR_RE.exec(src);
        if (!am) return false;
        pushTok('id', am[0], i);
        i += am[0].length;
        let k = i;
        while (k < len && (src[k] === ' ' || src[k] === '\t')) k++;
        if (src[k] === '=') {
          k++;
          while (k < len && (src[k] === ' ' || src[k] === '\t')) k++;
          const v = src[k];
          if (v === '"' || v === "'") { i = k; readString(v); continue; }
          if (v === '{') {
            i = k;
            pushTok('punct', '{', i);
            i++;
            readTokens('}');
            if (src[i] !== '}') return false;
            pushTok('punct', '}', i);
            i++;
            continue;
          }
          return false;
        }
        continue;
      }
      return false;
    }
  }
  function readJsxTag(checkPrev) {
    const c1 = src[i + 1];
    if (!c1 || !(/[A-Za-z]/.test(c1) || c1 === '>')) return false;
    if (checkPrev && prev && !JSX_PREV_VALUES.has(prev.value)) return false;
    const save = snapshot();
    pushTok('punct', '<', i);
    i++;
    if (src[i] === '>') {
      pushTok('punct', '>', i);
      i++;
      if (readJsxChildren(null)) return true;
      restore(save);
      return false;
    }
    JSX_NAME_RE.lastIndex = i;
    const m = JSX_NAME_RE.exec(src);
    if (!m) { restore(save); return false; }
    pushTok('id', m[1], i);
    i += m[0].length;
    if (readJsxAttrs(m[1])) return true;
    restore(save);
    return false;
  }
  function readPunct() {
    for (const p of PUNCTS) {
      if (src.startsWith(p, i)) {
        if (p === '?.' && /[0-9]/.test(src[i + 2] || '')) continue;
        if (p === '{') {
          pushTok('punct', '{', i);
          i++;
          readTokens('}');
          if (src[i] !== '}') err('expected }');
          pushTok('punct', '}', i);
          i++;
          return;
        }
        pushTok('punct', p, i);
        i += p.length;
        return;
      }
    }
    err(`unexpected char ${JSON.stringify(src[i])}`);
  }
  function readTokens(stopChar) {
    for (;;) {
      if (i >= len) {
        if (stopChar) err('unexpected eof, expected }');
        return;
      }
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (stopChar === '}' && c === '}') return;
      if (c === '/') {
        if (src[i + 1] === '/') { readLineComment(); continue; }
        if (src[i + 1] === '*') { readBlockComment(); continue; }
        if (isRegexStart()) { readRegex(); continue; }
        pushTok('punct', '/', i);
        i++;
        continue;
      }
      if (c === "'" || c === '"') { readString(c); continue; }
      if (c === '`') { readTemplate(); continue; }
      if (jsx && c === '<') {
        if (readJsxTag(true)) continue;
      }
      if (ID_START_RE.test(c)) { readWord(); continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) { readNumber(); continue; }
      readPunct();
    }
  }

  readTokens(null);
  return { tokens, tokenStarts, comments, jsxEmpty };
}

function lexRust(src) {
  const len = src.length;
  const tokens = [];
  const tokenStarts = [];
  const comments = [];
  let i = 0;
  let line = 1;

  function err(msg) {
    throw new Error(`Rust lexer line ${line}: ${msg}`);
  }
  function pushTok(type, value, start) {
    tokens.push({ type, value });
    tokenStarts.push(start);
  }
  function readRustString() {
    const start = i;
    i++;
    for (;;) {
      if (i >= len) err('unterminated string');
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '"') { i++; pushTok('str', src.slice(start, i), start); return; }
      if (c === '\n') { line++; }
      i++;
    }
  }
  function readRawString() {
    const start = i;
    i++;
    let hashes = 0;
    while (src[i] === '#') { hashes++; i++; }
    if (src[i] !== '"') err('expected " after r#');
    i++;
    for (;;) {
      if (i >= len) err('unterminated raw string');
      const c = src[i];
      if (c === '"') {
        let h = 0;
        while (h < hashes && src[i + 1 + h] === '#') h++;
        if (h === hashes) {
          i += 1 + hashes;
          pushTok('str', src.slice(start, i), start);
          return;
        }
      }
      if (c === '\n') line++;
      i++;
    }
  }
  function readRustWord() {
    WORD_RE.lastIndex = i;
    const m = WORD_RE.exec(src);
    pushTok('id', m[0], i);
    i += m[0].length;
  }
  function readRustNumber() {
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(src);
    pushTok('num', m[0], i);
    i += m[0].length;
  }

  while (i < len) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      const start = i;
      const startLine = line;
      i += 2;
      while (i < len && src[i] !== '\n') i++;
      comments.push({ type: 'line', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      const startLine = line;
      i += 2;
      let depth = 1;
      let closed = false;
      while (i < len) {
        if (src[i] === '/' && src[i + 1] === '*') { depth++; i += 2; continue; }
        if (src[i] === '*' && src[i + 1] === '/') {
          depth--;
          i += 2;
          if (depth === 0) { closed = true; break; }
          continue;
        }
        if (src[i] === '\n') line++;
        i++;
      }
      if (!closed) err('unterminated nested block comment');
      comments.push({ type: 'block', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    if (c === '"') { readRustString(); continue; }
    if (c === 'r' && (src[i + 1] === '"' || (src[i + 1] === '#' && /"#/.test(src.slice(i + 1, i + 8))))) { readRawString(); continue; }
    if (c === 'b' && src[i + 1] === '"') { i++; readRustString(); continue; }
    if (c === 'b' && src[i + 1] === 'r' && (src[i + 2] === '"' || src[i + 2] === '#')) { i++; readRawString(); continue; }
    if (c === '\'') {
      if (src[i + 1] === '\\') {
        const start = i;
        i += 2;
        while (i < len && src[i] !== '\'') i++;
        if (i >= len) err('unterminated char literal');
        i++;
        pushTok('str', src.slice(start, i), start);
        continue;
      }
      if (src[i + 1] && src[i + 2] === '\'') {
        pushTok('str', `'${src[i + 1]}'`, i);
        i += 3;
        continue;
      }
      const start = i;
      i++;
      WORD_RE.lastIndex = i;
      const m = WORD_RE.exec(src);
      if (m) {
        pushTok('punct', '\'', start);
        pushTok('id', m[0], i);
        i += m[0].length;
      } else {
        pushTok('punct', '\'', start);
        i++;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(c)) { readRustWord(); continue; }
    if (/[0-9]/.test(c)) { readRustNumber(); continue; }
    const puncts = ['::', '->', '=>', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&&', '||', '<<', '>>', '..', '...', '&=', '|=', '^=', '<<=', '>>=', '##'];
    let matched = false;
    for (const p of puncts) {
      if (src.startsWith(p, i)) {
        pushTok('punct', p, i);
        i += p.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      pushTok('punct', c, i);
      i++;
    }
  }
  return { tokens, tokenStarts, comments, jsxEmpty: [] };
}

function lexShell(src) {
  const len = src.length;
  const tokens = [];
  const tokenStarts = [];
  const comments = [];
  let i = 0;
  let line = 1;

  function err(msg) {
    throw new Error(`Shell lexer line ${line}: ${msg}`);
  }
  function pushTok(type, value, start) {
    tokens.push({ type, value });
    tokenStarts.push(start);
  }

  while (i < len) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\') { pushTok('punct', src.slice(i, i + 2), i); i += 2; continue; }
    if (c === '\'') {
      const start = i;
      i++;
      while (i < len && src[i] !== '\'') { if (src[i] === '\n') line++; i++; }
      if (i < len) i++;
      pushTok('str', src.slice(start, i), start);
      continue;
    }
    if (c === '"') {
      const start = i;
      i++;
      while (i < len && src[i] !== '"') {
        if (src[i] === '\\') i++;
        if (src[i] === '\n') line++;
        i++;
      }
      if (i < len) i++;
      pushTok('str', src.slice(start, i), start);
      continue;
    }
    if (c === '#' && (i === 0 || /[\s;&|`]/.test(src[i - 1]))) {
      const start = i;
      const startLine = line;
      while (i < len && src[i] !== '\n') i++;
      comments.push({ type: 'line', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    if (c === '<' && src[i + 1] === '<') {
      const start = i;
      i += 2;
      if (src[i] === '-') i++;
      let delim = '';
      if (src[i] === '\'' || src[i] === '"') {
        const q = src[i];
        i++;
        const ds = i;
        while (i < len && src[i] !== q) { delim += src[i]; i++; }
        i++;
        pushTok('punct', '<<' + q + delim + q, start);
      } else {
        while (i < len && /[A-Za-z0-9_-]/.test(src[i])) { delim += src[i]; i++; }
        if (delim === '') {
          pushTok('punct', '<<', start);
          continue;
        }
        pushTok('punct', '<<' + delim, start);
      }
      while (i < len && src[i] !== '\n') i++;
      if (i < len) { i++; line++; }
      let lineStart = i;
      let found = false;
      while (i < len) {
        let j = i;
        while (j < len && src[j] !== '\n') j++;
        const content = src.slice(i, j);
        if (content.trim() === delim) { found = true; i = j + 1; line++; break; }
        if (j >= len) { i = j; break; }
        i = j + 1;
        line++;
        lineStart = i;
      }
      if (!found && i >= len) {
        const bodyEnd = i;
        pushTok('heredoc', src.slice(lineStart, bodyEnd), lineStart);
      } else {
        pushTok('heredoc', src.slice(lineStart, Math.max(i - delim.length - 1, lineStart)), lineStart);
      }
      continue;
    }
    {
      const start = i;
      while (i < len && !/[\s'"\\#<>&|;(){}$`]/.test(src[i])) i++;
      if (i === start) {
        pushTok('punct', c, i);
        i++;
      } else {
        pushTok('word', src.slice(start, i), start);
      }
      continue;
    }
  }
  return { tokens, tokenStarts, comments, jsxEmpty: [] };
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of sorted) {
    if (merged.length && r.start < merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end, kind: r.kind });
    }
  }
  return merged;
}

function jsxTextSemantic(v) {
  const parts = v.split('\n').map((s) => s.replace(/^[ \t]+|[ \t]+$/g, '')).filter((s) => s !== '');
  return parts.join(' ');
}

function normalizeTokens(tokens) {
  const out = [];
  for (const t of tokens) {
    const value = t.type === 'jsxText' ? jsxTextSemantic(t.value) : t.value;
    if (t.type === 'jsxText' && out.length && out[out.length - 1].type === 'jsxText') {
      const prevVal = out[out.length - 1].value;
      out[out.length - 1] = { type: 'jsxText', value: (prevVal && value) ? `${prevVal} ${value}` : (prevVal || value) };
    } else {
      out.push({ type: t.type, value });
    }
  }
  return out;
}

function verifyTokens(beforeRaw, afterRaw) {
  const before = normalizeTokens(beforeRaw);
  const after = normalizeTokens(afterRaw);
  const n = Math.min(before.length, after.length);
  for (let k = 0; k < n; k++) {
    const b = before[k];
    const a = after[k];
    if (b.type !== a.type || b.value !== a.value) {
      const around = before.slice(Math.max(0, k - 3), k + 4).map((t) => `${t.type}:${JSON.stringify(t.value)}`).join(' ');
      const aroundA = after.slice(Math.max(0, k - 3), k + 4).map((t) => `${t.type}:${JSON.stringify(t.value)}`).join(' ');
      return `token #${k} diverged:\n  before: ${around}\n  after:  ${aroundA}`;
    }
  }
  if (before.length !== after.length) {
    const k = n;
    const around = before.slice(Math.max(0, k - 3), k + 4).map((t) => `${t.type}:${JSON.stringify(t.value)}`).join(' ');
    const aroundA = after.slice(Math.max(0, k - 3), k + 4).map((t) => `${t.type}:${JSON.stringify(t.value)}`).join(' ');
    return `token count changed: ${before.length} -> ${after.length} at #${k}:\n  before: ${around}\n  after:  ${aroundA}`;
  }
  return null;
}

export function assemble(src, lexed, preservedComments) {
  const ranges = [];
  for (const c of lexed.comments) {
    if (!preservedComments.has(c)) ranges.push({ start: c.start, end: c.end, kind: 'comment' });
  }
  for (const e of lexed.jsxEmpty) ranges.push({ start: e.start, end: e.end, kind: 'emptyExpr' });
  const merged = mergeRanges(ranges);

  let out = '';
  let pos = 0;
  for (const r of merged) {
    out += src.slice(pos, r.start);
    out += r.kind === 'emptyExpr' ? MARK_EMPTY_EXPR : MARK_COMMENT;
    pos = r.end;
  }
  out += src.slice(pos);

  const lines = out.split('\n');
  const kept = [];
  for (const rawLine of lines) {
    let ln = rawLine;
    if (ln.includes(MARK_COMMENT) || ln.includes(MARK_EMPTY_EXPR)) {
      ln = ln.replace(/^([\t]*)\u0001[\t ]*/, '$1');
      ln = ln.replace(/^([\t]*)\u0000[\t ]*/, '$1');
      ln = ln.replace(/[\t ]*\u0000[\t ]*/g, (m, offset) => {
        const afterIdx = offset + m.length;
        const after = afterIdx < ln.length ? ln[afterIdx] : '';
        if (after === '' || '})],;:>'.includes(after)) return '';
        return ' ';
      });
      ln = ln.replaceAll('\u0000', ' ');
      ln = ln.replaceAll('\u0001', '');
      if (ln.trim() === '') continue;
    }
    kept.push(ln.replace(/[\t]+$/, ''));
  }

  let result = kept.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/^\n+/, '');
  result = result.replace(/\n+$/, '\n');
  if (result === '\n') result = '';
  return result;
}

export function stripSource(src, lang, jsx) {
  if (src.includes('\u0000') || src.includes('\u0001')) {
    throw new Error('source contains NUL control chars, refusing to process');
  }
  let shebang = '';
  let body = src;
  if (body.startsWith('#!')) {
    const nl = body.indexOf('\n');
    if (nl === -1) return { result: src, changed: false, stats: emptyStats() };
    shebang = body.slice(0, nl + 1);
    body = body.slice(nl + 1);
  }

  const lexed = lang === 'rust' ? lexRust(body) : lang === 'shell' ? lexShell(body) : lexTS(body, jsx);

  const firstCodePos = lexed.tokenStarts.length ? lexed.tokenStarts[0] : Infinity;
  const preservedComments = new Set();
  let directives = 0;
  let licenses = 0;
  for (const c of lexed.comments) {
    if (isDirective(c.text)) {
      preservedComments.add(c);
      directives++;
    } else if (c.start < firstCodePos && c.type === 'block' && isLicense(c.text)) {
      preservedComments.add(c);
      licenses++;
    }
  }

  const result = assemble(body, lexed, preservedComments);

  const reLexed = lang === 'rust' ? lexRust(result) : lang === 'shell' ? lexShell(result) : lexTS(result, jsx);
  const tokenError = verifyTokens(lexed.tokens, reLexed.tokens);
  if (tokenError) {
    throw new Error(`token verification failed (${tokenError})`);
  }

  let fr = 0;
  let en = 0;
  for (const c of lexed.comments) {
    if (preservedComments.has(c)) continue;
    if (classifyCommentLang(c.text) === 'fr') fr++;
    else en++;
  }

  const finalResult = shebang + result;
  const changed = finalResult !== src;
  const linesBefore = src.split('\n').length;
  const linesAfter = finalResult.split('\n').length;
  return {
    result: finalResult,
    changed,
    stats: {
      commentsRemoved: fr + en,
      fr,
      en,
      directivesPreserved: directives,
      licensePreserved: licenses,
      linesBefore,
      linesAfter,
    },
  };
}

function emptyStats() {
  return {
    commentsRemoved: 0, fr: 0, en: 0, directivesPreserved: 0,
    licensePreserved: 0, linesBefore: 0, linesAfter: 0,
  };
}

export { lexTS, lexRust, lexShell };

const LANG_BY_EXT = {
  ts: 'ts', tsx: 'ts', js: 'ts', jsx: 'ts', mjs: 'ts', cjs: 'ts',
  rs: 'rust', sh: 'shell', bash: 'shell',
};

export function langForFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const lang = LANG_BY_EXT[ext];
  if (!lang) return null;
  const base = path.basename(filePath);
  if (/\.d\.ts$/.test(base)) return null;
  if (/_bg\.(js|mjs)$/.test(base)) return null;
  if (/\.(min|bundle)\.(js|mjs)$/.test(base)) return null;
  return { lang, jsx: ext === 'tsx' || ext === 'jsx' };
}

export function processFile(filePath, { dryRun = false } = {}) {
  const detected = langForFile(filePath);
  if (!detected) return { file: filePath, skipped: true, changed: false, stats: emptyStats() };
  const src = fs.readFileSync(filePath, 'utf8');
  const { result, changed, stats } = stripSource(src, detected.lang, detected.jsx);
  if (changed && !dryRun) {
    fs.writeFileSync(filePath, result, 'utf8');
  }
  return { file: filePath, skipped: false, changed, stats };
}

export function processTree(targetPath, { dryRun = false } = {}) {
  const results = [];
  const errors = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const detected = langForFile(full);
        if (!detected) continue;
        try {
          results.push(processFile(full, { dryRun }));
        } catch (e) {
          errors.push({ file: full, error: e.message });
        }
      }
    }
  };
  const st = fs.statSync(targetPath);
  if (st.isDirectory()) walk(targetPath);
  else {
    const detected = langForFile(targetPath);
    if (detected) {
      try {
        results.push(processFile(targetPath, { dryRun }));
      } catch (e) {
        errors.push({ file: targetPath, error: e.message });
      }
    }
  }

  const totals = {
    files: results.filter((r) => !r.skipped).length,
    filesChanged: results.filter((r) => r.changed).length,
    commentsRemoved: 0, fr: 0, en: 0,
    directivesPreserved: 0, licensePreserved: 0,
    linesBefore: 0, linesAfter: 0,
    errors,
  };
  for (const r of results) {
    if (r.skipped) continue;
    totals.commentsRemoved += r.stats.commentsRemoved;
    totals.fr += r.stats.fr;
    totals.en += r.stats.en;
    totals.directivesPreserved += r.stats.directivesPreserved;
    totals.licensePreserved += r.stats.licensePreserved;
    totals.linesBefore += r.stats.linesBefore;
    totals.linesAfter += r.stats.linesAfter;
  }
  return { results, totals };
}

const SELF_TEST_CASES = [
  {
    name: 'inline-line-comment', lang: 'ts', jsx: false,
    src: 'const a = 1; // note\nconst b = 2;',
    expect: 'const a = 1;\nconst b = 2;',
  },
  {
    name: 'full-line-comment', lang: 'ts', jsx: false,
    src: 'function f() {\n  // commentaire seul\n  return 1;\n}',
    expect: 'function f() {\n  return 1;\n}',
  },
  {
    name: 'multiline-block-comment', lang: 'ts', jsx: false,
    src: 'const a = 1;\n/* multi\n   ligne */\nconst b = 2;',
    expect: 'const a = 1;\nconst b = 2;',
  },
  {
    name: 'block-inline', lang: 'ts', jsx: false,
    src: 'const a = /* inline */ 1;',
    expect: 'const a = 1;',
  },
  {
    name: 'url-in-string', lang: 'ts', jsx: false,
    src: 'const u = "https://x.io/a//b"; // c',
    expect: 'const u = "https://x.io/a//b";',
  },
  {
    name: 'regex-after-eq', lang: 'ts', jsx: false,
    src: 'const re = /ab\\/c/g; // c\nconst ok = re.test("x");',
    expect: 'const re = /ab\\/c/g;\nconst ok = re.test("x");',
  },
  {
    name: 'division-not-regex', lang: 'ts', jsx: false,
    src: 'const d = a / b / c; // division\nreturn d;',
    expect: 'const d = a / b / c;\nreturn d;',
  },
  {
    name: 'regex-after-return', lang: 'ts', jsx: false,
    src: 'function t(s) {\n  return /a\\/b/.test(s); // check\n}',
    expect: 'function t(s) {\n  return /a\\/b/.test(s);\n}',
  },
  {
    name: 'template-nested', lang: 'ts', jsx: false,
    src: 'const s = `a ${`b ${c} d`} e`; // fin',
    expect: 'const s = `a ${`b ${c} d`} e`;',
  },
  {
    name: 'template-comment-inside', lang: 'ts', jsx: false,
    src: 'const s = `a ${ /* c */ x } b`;',
    expect: 'const s = `a ${ x } b`;',
  },
  {
    name: 'string-with-block', lang: 'ts', jsx: false,
    src: "const s = '/* pas un commentaire */'; // vrai",
    expect: "const s = '/* pas un commentaire */';",
  },
  {
    name: 'escaped-quote', lang: 'ts', jsx: false,
    src: "const s = 'it\\'s /* x */'; // ok",
    expect: "const s = 'it\\'s /* x */';",
  },
  {
    name: 'directive-preserved', lang: 'ts', jsx: false,
    src: '/* eslint-disable no-console */\nconsole.log(1); // eslint-disable-line\nconst x = 1; // note',
    expect: '/* eslint-disable no-console */\nconsole.log(1); // eslint-disable-line\nconst x = 1;',
  },
  {
    name: 'ts-directive-preserved', lang: 'ts', jsx: false,
    src: 'const m = require("./x.js"); // @ts-expect-error module JS\nmodule.exports = m;',
    expect: 'const m = require("./x.js"); // @ts-expect-error module JS\nmodule.exports = m;',
  },
  {
    name: 'license-preserved', lang: 'ts', jsx: false,
    src: '/**\n * @license MIT\n * (c) BitLab\n */\nconst x = 1; // note',
    expect: '/**\n * @license MIT\n * (c) BitLab\n */\nconst x = 1;',
  },
  {
    name: 'asi-newline-kept', lang: 'ts', jsx: false,
    src: 'const a = 1\n// note\nconst b = 2',
    expect: 'const a = 1\nconst b = 2',
  },
  {
    name: 'jsx-text-slashes-protected', lang: 'ts', jsx: true,
    src: 'const A = () => (\n  <div>// pas un commentaire</div>\n);',
    expect: 'const A = () => (\n  <div>// pas un commentaire</div>\n);',
  },
  {
    name: 'jsx-empty-expression', lang: 'ts', jsx: true,
    src: 'const A = () => (\n  <p>{/* caché */}</p>\n);',
    expect: 'const A = () => (\n  <p></p>\n);',
  },
  {
    name: 'jsx-attr-expr-comment', lang: 'ts', jsx: true,
    src: 'const A = () => (<div className={cls /* c */}>x</div>);',
    expect: 'const A = () => (<div className={cls}>x</div>);',
  },
  {
    name: 'jsx-nested-fragment', lang: 'ts', jsx: true,
    src: 'function C() {\n  return <>{a < b ? <span>x</span> : null}</>;\n}',
    expect: 'function C() {\n  return <>{a < b ? <span>x</span> : null}</>;\n}',
  },
  {
    name: 'jsx-comment-in-children-expr', lang: 'ts', jsx: true,
    src: 'const A = () => (\n  <div>\n    {items.map((it) => (\n      <li key={it.id}>{it.label /* détail */}</li>\n    ))}\n  </div>\n);',
    expect: 'const A = () => (\n  <div>\n    {items.map((it) => (\n      <li key={it.id}>{it.label}</li>\n    ))}\n  </div>\n);',
  },
  {
    name: 'generics-not-jsx', lang: 'ts', jsx: true,
    src: 'const [tab, setTab] = useState<TabId>(\'dashboard\'); // état\nconst link = document.querySelector<HTMLLinkElement>(\'link[rel="icon"]\');',
    expect: "const [tab, setTab] = useState<TabId>('dashboard');\nconst link = document.querySelector<HTMLLinkElement>('link[rel=\"icon\"]');",
  },
  {
    name: 'rust-nested-block', lang: 'rust', jsx: false,
    src: 'fn a() { /* x /* y */ z */ let x = 1; // c\n}',
    expect: 'fn a() { let x = 1;\n}',
  },
  {
    name: 'rust-raw-string', lang: 'rust', jsx: false,
    src: 'let s = r#"/* pas un commentaire */"#; // vrai',
    expect: 'let s = r#"/* pas un commentaire */"#;',
  },
  {
    name: 'rust-doc-comments', lang: 'rust', jsx: false,
    src: '/// doc\n//! module\nfn a() {}',
    expect: 'fn a() {}',
  },
  {
    name: 'rust-lifetime-and-char', lang: 'rust', jsx: false,
    src: "fn f<'a>(x: &'a str) -> char { 'z' } // c",
    expect: "fn f<'a>(x: &'a str) -> char { 'z' }",
  },
  {
    name: 'shell-comments-and-heredoc', lang: 'shell', jsx: false,
    src: '#!/usr/bin/env bash\n# note shell\nx=1 # inline\ncat <<\'EOF\'\ndu texte # garde\ncoucou\nEOF\necho done',
    expect: '#!/usr/bin/env bash\nx=1\ncat <<\'EOF\'\ndu texte # garde\ncoucou\nEOF\necho done',
  },
];

export function runSelfTest() {
  let passed = 0;
  const failures = [];
  for (const tc of SELF_TEST_CASES) {
    try {
      const { result } = stripSource(tc.src, tc.lang, tc.jsx);
      if (result === tc.expect) {
        passed++;
      } else {
        failures.push(`${tc.name}:\n  expected: ${JSON.stringify(tc.expect)}\n  got:      ${JSON.stringify(result)}`);
      }
    } catch (e) {
      failures.push(`${tc.name}: threw ${e.message}`);
    }
  }
  return { total: SELF_TEST_CASES.length, passed, failures };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const selfTest = args.includes('--self-test');
  const jsonOut = args.includes('--json');
  const targets = args.filter((a) => !a.startsWith('--'));

  if (selfTest) {
    const { total, passed, failures } = runSelfTest();
    if (!jsonOut) {
      console.log(`self-test: ${passed}/${total} passed`);
      for (const f of failures) console.log(`FAIL ${f}`);
    } else {
      console.log(JSON.stringify({ selfTest: { total, passed, failures } }, null, 2));
    }
    process.exit(passed === total ? 0 : 1);
  }

  if (targets.length === 0) {
    console.error('usage: node cleanup-comments.mjs <file|dir> [--dry-run] [--self-test] [--json]');
    process.exit(2);
  }

  const allTotals = [];
  const allErrors = [];
  for (const t of targets) {
    const abs = path.resolve(t);
    if (!fs.existsSync(abs)) {
      console.error(`not found: ${abs}`);
      process.exit(2);
    }
    const { results, totals } = processTree(abs, { dryRun });
    allTotals.push({ target: t, totals });
    for (const e of totals.errors) {
      allErrors.push(e);
      console.error(`ERROR ${path.relative(process.cwd(), e.file)}: ${e.error}`);
    }
    for (const r of results) {
      if (!jsonOut && r.changed) {
        const s = r.stats;
        console.log(`${dryRun ? '[dry-run] ' : ''}${path.relative(process.cwd(), r.file)}: -${s.commentsRemoved} comments (-${s.linesBefore - s.linesAfter} lines)`);
      }
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify({ dryRun, targets: allTotals, errors: allErrors }, null, 2));
  } else {
    for (const t of allTotals) {
      const s = t.totals;
      console.log(`${t.target}: ${s.filesChanged}/${s.files} files changed, ${s.commentsRemoved} comments removed (fr ${s.fr} / en ${s.en}), ${s.directivesPreserved} directives + ${s.licensePreserved} license headers preserved`);
    }
  }
  process.exit(allErrors.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
