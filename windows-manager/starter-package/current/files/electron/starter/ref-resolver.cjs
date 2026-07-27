"use strict";
const refs = new Map();
module.exports = Object.freeze({ register: (id, element) => refs.set(String(id), element), resolve: (id) => refs.get(String(id)) || null, clear: () => refs.clear() });
