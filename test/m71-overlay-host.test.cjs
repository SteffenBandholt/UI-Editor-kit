"use strict";

const { assert, el } = require("./m71-test-helpers.cjs");
const { createBrowserOverlayHost } = require("../src/index.cjs");

function withOverlay(mountRect, targetRect, extra) {
  const mount = el(mountRect);
  const target = el(targetRect);
  Object.assign(mount, extra || {});
  let adds = 0;
  let rems = 0;
  const windowAdapter = { scrollX: 500, scrollY: 800, addEventListener() { adds += 1; }, removeEventListener() { rems += 1; } };
  const overlay = createBrowserOverlayHost({ overlayMountTarget: mount, windowAdapter, clock: () => 7 });
  return { mount, target, overlay, counts: () => ({ adds, rems }) };
}

let setup = withOverlay({ left: 0, top: 0, width: 500, height: 500 }, { left: 15, top: 25, width: 100, height: 40 });
assert.equal(setup.overlay.show("a", setup.target).ok, true);
assert.equal(setup.overlay.getState().rect.left, 15);
assert.equal(setup.overlay.getState().rect.top, 25);
assert.equal(setup.mount.children[0].style.pointerEvents, "none");

setup = withOverlay({ left: 5, top: 6, width: 500, height: 500 }, { left: 15, top: 26, width: 100, height: 40 });
setup.overlay.show("a", setup.target);
assert.equal(setup.overlay.getState().rect.left, 10);
assert.equal(setup.overlay.getState().rect.top, 20);

setup = withOverlay({ left: 5, top: 6, width: 500, height: 500 }, { left: 15, top: 26, width: 100, height: 40 }, { scrollLeft: 11, scrollTop: 12 });
setup.overlay.show("a", setup.target);
assert.equal(setup.overlay.getState().rect.left, 21);
assert.equal(setup.overlay.getState().rect.top, 32);

setup.target.throwRect = true;
assert.equal(setup.overlay.show("a", setup.target).code, "OVERLAY_MEASURE_FAILED");
const badSize = createBrowserOverlayHost({ overlayMountTarget: setup.mount, rectReader: () => ({ left: 0, top: 0, width: -1, height: 1 }) });
assert.equal(badSize.show("a", el()).code, "OVERLAY_MEASURE_FAILED");
const missing = createBrowserOverlayHost({});
assert.equal(missing.show("a", setup.target).code, "OVERLAY_MOUNT_MISSING");
setup.overlay.destroy();
assert.equal(setup.counts().rems, setup.counts().adds);

console.log("m71 overlay host ok");
