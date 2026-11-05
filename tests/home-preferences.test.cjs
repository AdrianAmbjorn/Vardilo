const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('next/dist/compiled/babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const preferences = requireFromTs('lib/home-preferences.ts');
function requireFromTs(path, overrides = {}) {
  const source = babel.transformSync(fs.readFileSync(path, 'utf8'), {filename:path,presets:[[require('next/babel'),{'preset-env':{targets:{node:'current'}},'preset-react':{runtime:'automatic'},'transform-runtime':{helpers:false,regenerator:false}}]],envName:'test',babelrc:false,configFile:false}).code;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => overrides[name] ?? (name.endsWith('.css') ? {} : require(name)) });
  return exports;
}
function harness(initial = [], result = { error: null }) {
  const states = [...initial]; let cursor = 0; const effects = []; const writes = [];
  const supabase = { from(table) { return { upsert: async (row, options) => { writes.push({table,row,options}); return result; } }; } };
  const hooks = { ...React, useState(value) { const id = cursor++; if (!(id in states)) states[id] = value; return [states[id], value => states[id] = typeof value === 'function' ? value(states[id]) : value]; }, useMemo: fn => fn(), useRef: value => ({current:value}), useEffect: fn => effects.push(fn) };
  const component = requireFromTs('app/components/home-preferences.tsx', { react: hooks, '@/lib/supabase/client': { createClient: () => supabase }, '@/lib/home-preferences': preferences });
  function render(isChild = false) { cursor = 0; return component.HomePreferences({memberId:'member-a',isChild,children:React.createElement('span',null,'content')}); }
  return { render, states, writes };
}
function nodes(root, predicate) {
  const found = [];
  function visit(node) { if (!node || typeof node !== 'object') return; if (predicate(node)) found.push(node); React.Children.forEach(node.props?.children, visit); }
  visit(root); return found;
}
test('unknown or obsolete sections are ignored, valid hidden sections stay unique', () => {
  assert.deepEqual(Array.from(preferences.readHiddenSections(['chat','riddle','chat',null,'lists'])), ['lists','chat']);
  assert.deepEqual(Array.from(preferences.readHiddenSections(null)), []);
});
test('save persists only this member and applies visibility after success', async () => {
  const h = harness([[], ['chat','lists'], 'member-a', false, '', false, true]);
  const tree = h.render();
  await nodes(tree, n => n.type === 'button' && n.props.children === 'Spara mina val')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.writes[0].table, 'member_home_preferences');
  assert.equal(h.writes[0].row.member_id, 'member-a');
  assert.deepEqual(h.writes[0].row.hidden_sections, ['chat','lists']);
  assert.deepEqual(h.states[0], ['chat','lists']);
  assert.equal(h.states[6], false);
});
test('failed save preserves draft and current visibility for retry', async () => {
  const h = harness([[], ['chat'], 'member-a', false, '', false, true], {error:new Error('offline')});
  await nodes(h.render(), n => n.type === 'button' && n.props.children === 'Spara mina val')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.states[0], []); assert.deepEqual(h.states[1], ['chat']);
  assert.equal(h.states[6], true); assert.match(h.states[4], /kunde inte sparas/);
});
test('editor offers XP to children and all content can be hidden without losing the menu', () => {
  const h = harness([[], [], 'member-a', false, '', false, true]);
  const adult = renderToStaticMarkup(h.render(false)); const child = renderToStaticMarkup(h.render(true));
  assert.doesNotMatch(adult, /Mina XP och mitt mål/); assert.match(child, /Mina XP och mitt mål/);
  assert.match(adult, /Allt finns kvar i menyn/); assert.doesNotMatch(child, /kluring/i);
});
