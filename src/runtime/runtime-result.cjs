"use strict";
function okResult(value, extras) { return { ok: true, ...(extras || {}), ...(value === undefined ? {} : { value }) }; }
function blockedResult(code, reason, extras) { return { ok: false, blocked: true, code, reason, ...(extras || {}) }; }
module.exports = { okResult, blockedResult };
