"use strict";

const assert = require("node:assert/strict");
const { createBrowserLayoutStorage } = require("../src/index.cjs");

const map = new Map();
const storage = { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
const context = { targetAppId: "app", moduleId: "mod", scopeId: "scope", layoutProfileId: "p1" };
const store = createBrowserLayoutStorage({ storage, clock: () => "now" });

assert.equal(store.available, true);
assert.equal(store.persistent, true);
assert.equal(store.write(context, [{ elementId: "a", x: 1 }]).ok, true);
assert.equal(store.readResult(context).value.entries[0].x, 1);
const otherProfile = { ...context, layoutProfileId: "p2" };
assert.equal(store.readResult(otherProfile).value.entries.length, 0);
map.set(store.getKey(otherProfile), "nope");
assert.equal(store.readResult(otherProfile).code, "STORAGE_PARSE_FAILED");
assert.equal(store.deleteEntry(otherProfile, "a").code, "STORAGE_PARSE_FAILED");
assert.equal(map.get(store.getKey(otherProfile)), "nope");
map.set(store.getKey(otherProfile), JSON.stringify({ schemaVersion: 2, context: otherProfile, entries: [] }));
assert.equal(store.readResult(otherProfile).code, "STORAGE_SCHEMA_UNSUPPORTED");
assert.equal(store.deleteEntry(otherProfile, "a").code, "STORAGE_SCHEMA_UNSUPPORTED");
assert.equal(store.deleteEntry(context, "").code, "INVALID_ELEMENT_ID");
assert.equal(store.deleteEntry(context, "unknown").deleted, false);
assert.equal(store.deleteEntry(context, "a").deleted, true);
assert.equal(store.readResult(context).value.entries.length, 0);
assert.equal(store.clear({}).code, "INVALID_TARGET_CONTEXT");
assert.equal(store.clear(context).ok, true);
assert.equal(store.write(context, [{ elementId: "dom", ref: { style: {}, getBoundingClientRect() {} } }]).code, "STORAGE_WRITE_FAILED");
const bad = createBrowserLayoutStorage({ storage: { getItem() { throw new Error("security"); }, setItem() {}, removeItem() {} } });
assert.equal(bad.readResult(context).code, "STORAGE_READ_FAILED");
assert.equal(createBrowserLayoutStorage({}).available, false);
assert.equal(createBrowserLayoutStorage({}).readResult(context).code, "STORAGE_UNAVAILABLE");

console.log("m71 browser storage ok");
