"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validatePdfRegistry, createPdfRegistryFingerprint, canonicalPdfRegistry, PDF_TARGET_OPERATIONS } = require("../../src/index.cjs");
const scopeId = "pdf.test.overlay";
function entry(suffix, parentId, kind, order, capabilities = [], extra = {}) {
  return { id: suffix ? `${scopeId}.${suffix}` : scopeId, scopeId, parentId, kind, name: kind,
    role: "layout", pageArea: "document", order, visible: true, editable: capabilities.length > 0,
    capabilities, allowedOps: capabilities, lockedOps: PDF_TARGET_OPERATIONS.filter(op => !capabilities.includes(op)),
    baseline: { x: 0, y: 0, width: 10, height: 10, visible: true }, layoutBounds: {}, refKey: `ref-${order}`, rendererKey: `node-${order}`, ...extra };
}
function registry() {
  return { applicationId: "test-app", documentTypeId: "overlay", scopeId, displayName: "Overlay",
    layoutModel: "fixed-layout", unit: "mm", registryVersion: 1,
    pageSettings: { format: "A2", orientation: "landscape", width: 594, height: 420, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
    elements: [entry("", null, "document", 0), entry("page", scopeId, "page", 1),
      entry("text", `${scopeId}.page`, "text", 2, ["move", "textResize"]),
      entry("image", `${scopeId}.page`, "image", 3, ["move", "resizeWidth"])] };
}
function valid(r) { const result = validatePdfRegistry(r); assert.equal(result.ok, true, JSON.stringify(result.errors)); }
function invalid(r, code) { const result = validatePdfRegistry(r); assert.equal(result.ok, false); assert.ok(result.errors.some(e => e.code === code), JSON.stringify(result.errors)); }
test("fixed-layout: A2 landscape overlays without phantom structures", () => { valid(registry()); valid({ ...registry(), elements: registry().elements.slice(0, 2) }); });
test("fixed-layout: opt-in required, unknown/null model rejected", () => {
  for (const model of [undefined, "tabular"]) { const r = registry(); r.layoutModel = model; r.pageSettings = { ...r.pageSettings, format: "A4", width: 297, height: 210 }; invalid(r, "pdf_registry_kind_missing"); }
  for (const model of ["overlay", "", null, 1]) invalid({ ...registry(), layoutModel: model }, "pdf_registry_layout_model_invalid");
});
test("fixed-layout: A-series and custom dimensions both orientations", () => {
  for (const [format, width, height] of [["A0",841,1189],["A1",594,841],["A2",420,594],["A3",297,420],["A4",210,297],["A5",148,210],["A6",105,148],["custom",200,300]]) {
    for (const orientation of ["portrait", "landscape"]) { const r = registry(); r.pageSettings = { ...r.pageSettings, format, orientation, width: orientation === "portrait" ? width : height, height: orientation === "portrait" ? height : width }; valid(r); }
  }
});
test("fixed-layout: invalid format, sizes, orientation and margins rejected", () => {
  for (const change of [{format:"Letter"},{width:0},{width:-1},{width:Infinity},{width:null},{width:"594"},{height:NaN},{width:595},{orientation:"portrait"},{orientation:"diagonal"}]) invalid({ ...registry(), pageSettings: { ...registry().pageSettings, ...change } }, "pdf_registry_page_invalid");
  for (const margins of [{left:594},{right:-1},{top:420},{bottom:Infinity},{top:null},{left:"0"}]) { const r=registry();Object.assign(r.pageSettings.margins,margins);invalid(r,"pdf_registry_page_invalid"); }
});
test("fixed-layout: IDs, scope, roots, pages and parent cycles stay strict", () => {
  const mutations = [
    [r=>r.elements.push({...r.elements[2]}),"pdf_registry_id_invalid"],
    [r=>r.elements[2].scopeId="pdf.other","pdf_registry_scope_invalid"],
    [r=>r.elements[2].parentId="pdf.unknown","pdf_registry_parent_invalid"],
    [r=>r.elements[2].parentId=scopeId,"pdf_registry_parent_invalid"],
    [r=>r.elements[2].parentId=r.elements[2].id,"pdf_registry_parent_cycle"],
    [r=>{r.elements[2].parentId=r.elements[3].id;r.elements[3].parentId=r.elements[2].id;},"pdf_registry_parent_cycle"],
    [r=>r.elements.push(entry("root2",null,"document",4)),"pdf_registry_root_invalid"],
    [r=>r.elements.push(entry("page2",scopeId,"page",4)),"pdf_registry_root_invalid"],
    [r=>r.elements[1].parentId=r.elements[2].id,"pdf_registry_root_invalid"]
  ];
  for (const [mutate, code] of mutations) {const r=registry(); mutate(r);invalid(r,code);}
});
test("fixed-layout: present elements retain metadata, operation and domain guards", () => {
  for (const mutate of [r=>r.elements[2].refKey="",r=>r.elements[2].rendererKey="",r=>r.elements[2].baseline=null]) {const r=registry();mutate(r);invalid(r,"pdf_registry_layout_invalid");}
  for (const operation of ["setPageBreakRule","executeTargetAction","modifyDomainData"]) {const r=registry();r.elements[2].capabilities.push(operation); invalid(r,"pdf_registry_operations_invalid");}
  const conflict=registry();conflict.elements[2].lockedOps.push("move");invalid(conflict,"pdf_registry_operations_invalid");
  invalid({...registry(),projectData:{name:"forbidden"}},"pdf_registry_domain_data_forbidden");
});
test("fixed-layout: each optional table needs two classified direct columns", () => {
  const r=registry(); r.elements.push(entry("table",`${scopeId}.page`,"table",4,["resizeColumnBoundary"],{boundaryResizePolicy:"adjacentPreserveTotal"}));
  invalid(r,"pdf_registry_columns_missing");
  r.elements.push(entry("col1",`${scopeId}.table`,"tableColumn",5,["resizeWidth"],{columnRole:"contentColumn"})); invalid(r,"pdf_registry_columns_missing");
  r.elements.push(entry("col2",`${scopeId}.table`,"tableColumn",6,["resizeWidth"],{columnRole:"metaColumn"})); valid(r);
  const noRole=structuredClone(r);delete noRole.elements.at(-1).columnRole;invalid(noRole,"pdf_registry_column_role_missing");
  const orphan=structuredClone(r);orphan.elements.at(-1).parentId=`${scopeId}.page`;invalid(orphan,"pdf_registry_parent_invalid");
  const second=structuredClone(r);second.elements.push(entry("table2",`${scopeId}.page`,"table",7));invalid(second,"pdf_registry_columns_missing");
  const policy=structuredClone(r);policy.elements[4].boundaryResizePolicy="free";invalid(policy,"pdf_registry_boundary_policy_invalid");
});
test("fixed-layout: deterministic fingerprint includes model and actual page, legacy unchanged", () => {
  const r=registry(); const legacy={...r};delete legacy.layoutModel;
  assert.equal(createPdfRegistryFingerprint(legacy),createPdfRegistryFingerprint({...legacy,layoutModel:"tabular"}));
  assert.equal(Object.hasOwn(canonicalPdfRegistry(legacy),"layoutModel"),false);
  assert.notEqual(createPdfRegistryFingerprint(r),createPdfRegistryFingerprint(legacy));
  assert.notEqual(createPdfRegistryFingerprint(r),createPdfRegistryFingerprint({...r,pageSettings:{...r.pageSettings,format:"custom"}}));
  assert.equal(createPdfRegistryFingerprint(r),createPdfRegistryFingerprint({...r,displayName:"other",elements:r.elements.toReversed().map(e=>({...e,name:"renamed"}))}));
});
