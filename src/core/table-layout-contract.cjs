"use strict";

const TABLE_ELEMENT_TYPES = Object.freeze([
  "table",
  "tableHeader",
  "tableBody",
  "tableRow",
  "tableColumn",
  "tableHeaderCell",
  "tableDataCell",
  "tableFooter",
  "tableViewport",
  "horizontalScrollArea",
]);

const TABLE_WIDTH_MODES = Object.freeze(["fixed", "auto", "proportional"]);
const TABLE_WRAP_MODES = Object.freeze(["noWrap", "wordWrap", "characterWrap", "ellipsis"]);
const TABLE_OVERFLOW_MODES = Object.freeze(["clip", "ellipsis", "visible", "scroll"]);
const TABLE_HORIZONTAL_OVERFLOW_MODES = Object.freeze(["none", "auto", "scroll", "fitViewport"]);
const TABLE_VERTICAL_OVERFLOW_MODES = Object.freeze(["none", "auto", "scroll"]);
const TABLE_WIDTH_POLICIES = Object.freeze(["content", "viewport", "bounded", "explicit"]);
const TABLE_ROW_HEIGHT_MODES = Object.freeze(["fixed", "auto", "bounded", "ellipsis"]);
const TABLE_ALIGNMENT_MODES = Object.freeze(["start", "center", "end", "stretch"]);
const TABLE_TOPOLOGY_POLICIES = Object.freeze(["preserveTarget"]);
const TABLE_BOUNDARY_RESIZE_POLICIES = Object.freeze(["independent", "adjacentPreserveTotal"]);
const TABLE_LAYOUT_OPERATIONS = Object.freeze([
  "fitTableToViewport",
  "resizeColumnsProportionally",
  "resizeColumnBoundary",
  "setHorizontalOverflowMode",
  "setColumnWidthMode",
  "setColumnWrapMode",
  "setColumnOverflowMode",
  "setRowHeightMode",
  "resetTableColumn",
  "resetTable",
]);

const FORBIDDEN_TABLE_KEYS = new Set([
  "domainData", "businessData", "records", "rows", "values", "recordId", "entityId",
  "customerId", "projectId", "database", "sql", "photos", "dueDate", "statusValue",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bounds(value) {
  const source = isObject(value) ? value : {};
  return Object.freeze({
    left: finite(source.left),
    top: finite(source.top),
    width: Math.max(0, finite(source.width)),
    height: Math.max(0, finite(source.height)),
  });
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}

function forbiddenPaths(value, prefix = "") {
  if (Array.isArray(value)) return value.flatMap((entry, index) => forbiddenPaths(entry, `${prefix}[${index}]`));
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [...(FORBIDDEN_TABLE_KEYS.has(key) ? [path] : []), ...forbiddenPaths(nested, path)];
  });
}

function normalizeTableColumn(column) {
  const source = isObject(column) ? column : {};
  const minimumWidth = Math.max(1, finite(source.minimumWidth, 1));
  const maximumWidth = Math.max(minimumWidth, finite(source.maximumWidth, minimumWidth));
  const currentWidth = Math.min(maximumWidth, Math.max(minimumWidth, finite(source.currentWidth, minimumWidth)));
  return Object.freeze({
    columnId: text(source.columnId),
    displayName: text(source.displayName),
    headerElementId: text(source.headerElementId),
    dataCellTemplateId: text(source.dataCellTemplateId),
    cellElementIds: Object.freeze(Array.isArray(source.cellElementIds) ? source.cellElementIds.map(text).filter(Boolean) : []),
    currentWidth,
    minimumWidth,
    maximumWidth,
    widthMode: text(source.widthMode) || "fixed",
    resizable: source.resizable !== false,
    wrapMode: text(source.wrapMode) || "noWrap",
    overflowMode: text(source.overflowMode) || "clip",
    alignment: text(source.alignment) || "stretch",
    visibility: source.visibility !== false,
    order: Number.isInteger(source.order) ? source.order : 0,
    lockedOps: Object.freeze(Array.isArray(source.lockedOps) ? source.lockedOps.map(text).filter(Boolean) : []),
    widthSourceId: text(source.widthSourceId) || text(source.columnId),
    flexible: source.flexible === true || source.widthMode === "proportional" || source.widthMode === "auto",
    priority: Number.isInteger(source.priority) ? source.priority : 0,
  });
}

function normalizeTableLayout(table) {
  const source = isObject(table) ? table : {};
  const columns = Object.freeze((Array.isArray(source.columns) ? source.columns : []).map(normalizeTableColumn));
  const minimumWidth = Math.max(1, finite(source.minimumWidth, 1));
  const maximumWidth = Math.max(minimumWidth, finite(source.maximumWidth, Number.MAX_SAFE_INTEGER));
  return Object.freeze({
    tableId: text(source.tableId),
    displayName: text(source.displayName),
    bounds: bounds(source.bounds),
    viewportBounds: bounds(source.viewportBounds),
    contentBounds: bounds(source.contentBounds),
    parentId: source.parentId === null ? null : text(source.parentId),
    topologyPolicy: text(source.topologyPolicy) || "preserveTarget",
    boundaryResizePolicy: text(source.boundaryResizePolicy) || "independent",
    requiresDedicatedWrapper: false,
    columnIds: Object.freeze(Array.isArray(source.columnIds) ? source.columnIds.map(text).filter(Boolean) : columns.map((column) => column.columnId)),
    rowTemplateId: source.rowTemplateId == null ? null : text(source.rowTemplateId),
    horizontalOverflowMode: text(source.horizontalOverflowMode) || "auto",
    verticalOverflowMode: text(source.verticalOverflowMode) || "auto",
    widthPolicy: text(source.widthPolicy) || "bounded",
    minimumWidth,
    maximumWidth,
    reservedWidth: Math.max(0, finite(source.reservedWidth)),
    scrollbarWidth: Math.max(0, finite(source.scrollbarWidth)),
    rowHeightMode: text(source.rowHeightMode) || "auto",
    minimumRowHeight: Math.max(1, finite(source.minimumRowHeight, 1)),
    maximumRowHeight: Math.max(1, finite(source.maximumRowHeight, Number.MAX_SAFE_INTEGER)),
    columns,
  });
}

function error(code, field, message) {
  return { code, field, message };
}

function validateTableLayout(table) {
  const errors = [];
  if (!isObject(table)) return { ok: false, errors: [error("table_layout_invalid", "table", "Tabellenvertrag muss ein Objekt sein.")] };
  const model = normalizeTableLayout(table);
  for (const path of forbiddenPaths(table)) errors.push(error("table_domain_data_forbidden", path, "Fach- und Kundendaten sind im Tabellenvertrag nicht erlaubt."));
  for (const field of ["tableId", "displayName"]) if (!model[field]) errors.push(error("table_field_missing", field, `${field} fehlt.`));
  if (!model.parentId) errors.push(error("table_field_missing", "parentId", "parentId fehlt."));
  if (!TABLE_TOPOLOGY_POLICIES.includes(model.topologyPolicy)) errors.push(error("table_topology_policy_invalid", "topologyPolicy", "Der Tabellenvertrag muss die vorhandene Ziel-App-Topologie bewahren."));
  if (!TABLE_BOUNDARY_RESIZE_POLICIES.includes(model.boundaryResizePolicy)) errors.push(error("table_boundary_policy_invalid", "boundaryResizePolicy", "Die Spaltengrenzenregel ist ungültig."));
  if (table.requiresDedicatedWrapper === true) errors.push(error("table_wrapper_forbidden", "requiresDedicatedWrapper", "Ein Tabellenvertrag darf keinen zusaetzlichen UI-Wrapper verlangen."));
  if (!TABLE_HORIZONTAL_OVERFLOW_MODES.includes(model.horizontalOverflowMode)) errors.push(error("table_overflow_mode_invalid", "horizontalOverflowMode", "Horizontaler Überlaufmodus ist ungültig."));
  if (!TABLE_VERTICAL_OVERFLOW_MODES.includes(model.verticalOverflowMode)) errors.push(error("table_overflow_mode_invalid", "verticalOverflowMode", "Vertikaler Überlaufmodus ist ungültig."));
  if (!TABLE_WIDTH_POLICIES.includes(model.widthPolicy)) errors.push(error("table_width_policy_invalid", "widthPolicy", "Breitenregel ist ungültig."));
  if (!TABLE_ROW_HEIGHT_MODES.includes(model.rowHeightMode)) errors.push(error("table_row_height_mode_invalid", "rowHeightMode", "Zeilenhöhenmodus ist ungültig."));
  if (model.minimumWidth > model.maximumWidth) errors.push(error("table_width_limits_invalid", "maximumWidth", "Maximalbreite liegt unter der Mindestbreite."));
  if (model.minimumRowHeight > model.maximumRowHeight) errors.push(error("table_row_height_limits_invalid", "maximumRowHeight", "Maximale Zeilenhöhe liegt unter der Mindesthöhe."));
  const ids = model.columns.map((column) => column.columnId);
  if (!ids.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push(error("table_columns_invalid", "columns", "Spalten-IDs müssen vorhanden und eindeutig sein."));
  if (model.columnIds.length !== ids.length || model.columnIds.some((id, index) => id !== ids[index])) errors.push(error("table_column_order_invalid", "columnIds", "columnIds müssen der echten Spaltenreihenfolge entsprechen."));
  model.columns.forEach((column, index) => {
    const prefix = `columns[${index}]`;
    for (const field of ["columnId", "displayName", "headerElementId", "dataCellTemplateId", "widthSourceId"])
      if (!column[field]) errors.push(error("table_column_field_missing", `${prefix}.${field}`, `${field} fehlt.`));
    if (column.widthSourceId !== column.columnId) errors.push(error("table_column_width_source_invalid", `${prefix}.widthSourceId`, "Die Spalte muss selbst die einzige Breitenquelle sein."));
    if (!TABLE_WIDTH_MODES.includes(column.widthMode)) errors.push(error("table_column_width_mode_invalid", `${prefix}.widthMode`, "Breitenmodus ist ungültig."));
    if (!TABLE_WRAP_MODES.includes(column.wrapMode)) errors.push(error("table_column_wrap_mode_invalid", `${prefix}.wrapMode`, "Umbruchmodus ist ungültig."));
    if (!TABLE_OVERFLOW_MODES.includes(column.overflowMode)) errors.push(error("table_column_overflow_mode_invalid", `${prefix}.overflowMode`, "Überlaufmodus ist ungültig."));
    if (!TABLE_ALIGNMENT_MODES.includes(column.alignment)) errors.push(error("table_column_alignment_invalid", `${prefix}.alignment`, "Ausrichtung ist ungültig."));
  });
  return { ok: errors.length === 0, errors, model };
}

function measureTableLayout(table) {
  const model = normalizeTableLayout(table);
  const visibleColumns = model.columns.filter((column) => column.visibility);
  const columnWidth = visibleColumns.reduce((sum, column) => sum + column.currentWidth, 0);
  const tableWidth = Math.max(columnWidth + model.reservedWidth, model.contentBounds.width);
  const viewportWidth = Math.max(0, model.viewportBounds.width - model.scrollbarWidth);
  const overflow = Math.max(0, tableWidth - viewportWidth);
  const overflowColumnIds = [];
  let remaining = overflow;
  for (const column of [...visibleColumns].sort((left, right) => right.currentWidth - left.currentWidth || left.order - right.order)) {
    if (remaining <= 0) break;
    if (column.currentWidth > column.minimumWidth) {
      overflowColumnIds.push(column.columnId);
      remaining -= column.currentWidth - column.minimumWidth;
    }
  }
  return Object.freeze({
    viewportWidth,
    tableWidth,
    columnWidth,
    reservedWidth: model.reservedWidth,
    scrollbarWidth: model.scrollbarWidth,
    overflow,
    overflowColumnIds: Object.freeze(overflowColumnIds),
    hasHorizontalOverflow: overflow > 0.5,
  });
}

function fitTableToViewport(table, options = {}) {
  const validation = validateTableLayout(table);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const model = validation.model;
  const before = measureTableLayout(model);
  const selectedColumnId = text(options.selectedColumnId);
  const eligible = model.columns.filter((column) => column.visibility && column.resizable && column.currentWidth > column.minimumWidth && (!selectedColumnId || column.columnId === selectedColumnId));
  const flexible = eligible.filter((column) => column.flexible);
  const flexibleCapacity = flexible.reduce((sum, column) => sum + column.currentWidth - column.minimumWidth, 0);
  const candidates = !selectedColumnId && flexible.length && flexibleCapacity >= before.overflow ? flexible : eligible;
  const required = before.overflow;
  const capacity = candidates.reduce((sum, column) => sum + column.currentWidth - column.minimumWidth, 0);
  const shrink = Math.min(required, capacity);
  const widths = new Map();
  let distributed = 0;
  candidates.forEach((column, index) => {
    const available = column.currentWidth - column.minimumWidth;
    const reduction = index === candidates.length - 1 ? shrink - distributed : capacity > 0 ? shrink * available / capacity : 0;
    distributed += reduction;
    widths.set(column.columnId, Math.max(column.minimumWidth, column.currentWidth - reduction));
  });
  const columns = model.columns.map((column) => normalizeTableColumn({ ...column, currentWidth: widths.get(column.columnId) ?? column.currentWidth }));
  const next = normalizeTableLayout({ ...model, columns, contentBounds: { ...model.contentBounds, width: columns.filter((column) => column.visibility).reduce((sum, column) => sum + column.currentWidth, model.reservedWidth) } });
  const after = measureTableLayout(next);
  return Object.freeze({
    ok: true,
    changed: shrink > 0.01,
    fullyFitted: after.overflow <= 0.5,
    before,
    after,
    model: next,
    preview: Object.freeze({
      action: selectedColumnId ? "shrinkSelectedColumn" : "fitTableToViewport",
      selectedColumnId: selectedColumnId || null,
      columnWidths: Object.freeze(Object.fromEntries(columns.map((column) => [column.columnId, column.currentWidth]))),
    }),
  });
}

function updateTableColumn(table, columnId, values) {
  const validation = validateTableLayout(table);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const source = validation.model;
  const id = text(columnId);
  if (!source.columns.some((column) => column.columnId === id)) return { ok: false, errors: [error("table_column_unknown", "columnId", "Spalte ist nicht registriert.")] };
  const columns = source.columns.map((column) => column.columnId === id ? normalizeTableColumn({ ...column, ...clone(values), columnId: column.columnId, widthSourceId: column.columnId }) : column);
  const model = normalizeTableLayout({ ...source, columns, contentBounds: { ...source.contentBounds, width: columns.filter((column) => column.visibility).reduce((sum, column) => sum + column.currentWidth, source.reservedWidth) } });
  const result = validateTableLayout(model);
  return result.ok ? { ok: true, model, metrics: measureTableLayout(model) } : result;
}

function normalizeTableColumnRuntimeMetrics(metrics) {
  const source = isObject(metrics) ? metrics : {};
  const widths = (value) => Object.freeze((Array.isArray(value) ? value : [])
    .map((entry) => finite(entry, NaN))
    .filter((entry) => Number.isFinite(entry) && entry >= 0));
  return Object.freeze({
    columnId: text(source.columnId),
    logicalWidth: Math.max(0, finite(source.logicalWidth)),
    effectiveWidth: Math.max(0, finite(source.effectiveWidth)),
    headerWidth: Math.max(0, finite(source.headerWidth)),
    headerContentWidth: Math.max(0, finite(source.headerContentWidth)),
    dataCellWidths: widths(source.dataCellWidths),
    dataContentWidths: widths(source.dataContentWidths),
    mountedDataCellCount: Math.max(0, Math.trunc(finite(source.mountedDataCellCount))),
  });
}

function validateTableColumnRuntimeMetrics(metrics, options = {}) {
  const model = normalizeTableColumnRuntimeMetrics(metrics);
  const tolerance = Math.max(0.01, finite(options.tolerance, 1));
  const errors = [];
  const mismatch = (field, actual, expected) => {
    if (Math.abs(actual - expected) > tolerance)
      errors.push(error("table_runtime_width_mismatch", field,
        `Wirksame Spaltenbreite ${expected} und ${field} ${actual} weichen voneinander ab.`));
  };
  if (!model.columnId) errors.push(error("table_runtime_column_missing", "columnId", "Spalten-ID fehlt in der Laufzeitmessung."));
  for (const field of ["logicalWidth", "effectiveWidth", "headerWidth"])
    if (!(model[field] > 0)) errors.push(error("table_runtime_width_invalid", field, `${field} muss positiv und endlich sein.`));
  if (model.effectiveWidth > 0 && model.headerWidth > 0) mismatch("headerWidth", model.headerWidth, model.effectiveWidth);
  if (model.mountedDataCellCount !== model.dataCellWidths.length)
    errors.push(error("table_runtime_data_cells_incomplete", "dataCellWidths", "Nicht alle gebundenen Datenzellen wurden gemessen."));
  if (model.dataContentWidths.length !== model.dataCellWidths.length)
    errors.push(error("table_runtime_content_cells_incomplete", "dataContentWidths", "Nicht alle Inhaltsboxen wurden gemessen."));
  model.dataCellWidths.forEach((width, index) => {
    if (!(width > 0)) errors.push(error("table_runtime_width_invalid", `dataCellWidths[${index}]`, "Datenzellenbreite muss positiv sein."));
    else if (model.effectiveWidth > 0) mismatch(`dataCellWidths[${index}]`, width, model.effectiveWidth);
    const contentWidth = model.dataContentWidths[index];
    if (!(contentWidth > 0) || contentWidth > width + tolerance)
      errors.push(error("table_runtime_content_width_invalid", `dataContentWidths[${index}]`, "Inhaltsbox muss positiv sein und innerhalb der Datenzelle liegen."));
  });
  if (!(model.headerContentWidth > 0) || model.headerContentWidth > model.headerWidth + tolerance)
    errors.push(error("table_runtime_content_width_invalid", "headerContentWidth", "Kopf-Inhaltsbox muss positiv sein und innerhalb der Kopfzelle liegen."));
  return { ok: errors.length === 0, errors, model, tolerance };
}

function resizeTableColumnBoundary(table, intent = {}) {
  const validation = validateTableLayout(table);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const model = validation.model;
  if (model.boundaryResizePolicy !== "adjacentPreserveTotal") {
    return { ok: false, errors: [error("table_boundary_policy_forbidden", "boundaryResizePolicy", "Diese Tabelle erlaubt keine gekoppelte Spaltengrenzen-Änderung.")] };
  }
  const leftColumnId = text(intent.leftColumnId);
  const rightColumnId = text(intent.rightColumnId);
  const delta = Number(intent.delta);
  const leftIndex = model.columnIds.indexOf(leftColumnId);
  const rightIndex = model.columnIds.indexOf(rightColumnId);
  if (leftIndex < 0 || rightIndex !== leftIndex + 1) {
    return { ok: false, errors: [error("table_boundary_columns_not_adjacent", "columnIds", "Spaltengrenzen können nur zwischen zwei unmittelbar benachbarten Spalten verschoben werden.")] };
  }
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.000001) {
    return { ok: false, errors: [error("table_boundary_delta_invalid", "delta", "Die Grenzverschiebung muss eine endliche Zahl ungleich null sein.")] };
  }
  const left = model.columns[leftIndex];
  const right = model.columns[rightIndex];
  if (!left.resizable || !right.resizable || !left.visibility || !right.visibility) {
    return { ok: false, errors: [error("table_boundary_columns_locked", "columnIds", "Beide Nachbarspalten müssen sichtbar und in der Breite veränderbar sein.")] };
  }
  const nextLeft = left.currentWidth + delta;
  const nextRight = right.currentWidth - delta;
  if (nextLeft < left.minimumWidth - 0.000001) {
    return { ok: false, errors: [error("table_boundary_left_minimum", "delta", `${left.displayName} kann nicht schmaler als ${left.minimumWidth} werden.`)] };
  }
  if (nextLeft > left.maximumWidth + 0.000001) {
    return { ok: false, errors: [error("table_boundary_left_maximum", "delta", `${left.displayName} kann nicht breiter als ${left.maximumWidth} werden.`)] };
  }
  if (nextRight < right.minimumWidth - 0.000001) {
    return { ok: false, errors: [error("table_boundary_right_minimum", "delta", `${right.displayName} kann nicht schmaler als ${right.minimumWidth} werden.`)] };
  }
  if (nextRight > right.maximumWidth + 0.000001) {
    return { ok: false, errors: [error("table_boundary_right_maximum", "delta", `${right.displayName} kann nicht breiter als ${right.maximumWidth} werden.`)] };
  }
  const beforeTotal = model.columns.reduce((sum, column) => sum + column.currentWidth, 0);
  const columns = model.columns.map((column, index) => index === leftIndex
    ? normalizeTableColumn({ ...column, currentWidth: nextLeft })
    : index === rightIndex
      ? normalizeTableColumn({ ...column, currentWidth: nextRight })
      : column);
  const afterTotal = columns.reduce((sum, column) => sum + column.currentWidth, 0);
  if (Math.abs(beforeTotal - afterTotal) > 0.000001) {
    return { ok: false, errors: [error("table_boundary_total_changed", "delta", "Die feste Tabellenbreite würde sich durch die Grenzverschiebung ändern.")] };
  }
  const next = normalizeTableLayout({ ...model, columns });
  return Object.freeze({
    ok: true,
    changed: true,
    model: next,
    metrics: measureTableLayout(next),
    boundary: Object.freeze({ leftColumnId, rightColumnId, delta, leftWidth: nextLeft, rightWidth: nextRight, totalWidth: afterTotal }),
  });
}

function resolveTableCellWidthSource(elements, cellId) {
  if (!Array.isArray(elements)) return { ok: false, errors: [error("table_bindings_invalid", "elements", "Elementliste fehlt.")] };
  const byId = new Map(elements.map((element) => [element?.id, element]));
  const cell = byId.get(text(cellId));
  if (!cell || !["tableHeaderCell", "tableDataCell"].includes(cell.type))
    return { ok: false, errors: [error("table_cell_unknown", "cellId", "Tabellenzelle ist nicht registriert.")] };
  const column = byId.get(cell.parentId);
  if (!column || column.type !== "tableColumn" || !isObject(column.tableColumnLayout))
    return { ok: false, errors: [error("table_cell_width_source_missing", cell.id, "Registrierte Spaltenquelle der Zelle fehlt.")] };
  const layout = normalizeTableColumn(column.tableColumnLayout);
  const binding = cell.tableBinding;
  const expectedCellIds = new Set([layout.headerElementId, layout.dataCellTemplateId, ...layout.cellElementIds]);
  if (!isObject(binding) || binding.columnId !== column.id || binding.widthSourceId !== column.id ||
      layout.columnId !== column.id || layout.widthSourceId !== column.id || !expectedCellIds.has(cell.id) ||
      (cell.type === "tableHeaderCell" && cell.id !== layout.headerElementId) ||
      (cell.type === "tableDataCell" && cell.id === layout.headerElementId)) {
    return { ok: false, errors: [error("table_column_binding_inconsistent", cell.id, "Header und Datenzellen muessen die registrierte Spalte als einzige Breitenquelle verwenden.")] };
  }
  const affectedElementIds = Object.freeze([...new Set([
    column.id,
    layout.headerElementId,
    layout.dataCellTemplateId,
    ...layout.cellElementIds,
  ].filter(Boolean))]);
  return Object.freeze({
    ok: true,
    cellId: cell.id,
    columnId: column.id,
    widthSourceId: column.id,
    affectedElementIds,
    columnLayout: layout,
    sourceAllowedOps: Object.freeze(Array.isArray(column.allowedOps) ? column.allowedOps.slice() : []),
  });
}

function updateTableColumnWidthFromCell(elements, table, cellId, width) {
  const source = resolveTableCellWidthSource(elements, cellId);
  if (!source.ok) return source;
  const tableValidation = validateTableLayout(table);
  if (!tableValidation.ok) return tableValidation;
  const column = tableValidation.model.columns.find((candidate) => candidate.columnId === source.widthSourceId);
  if (!column || column.headerElementId !== source.columnLayout.headerElementId ||
      column.dataCellTemplateId !== source.columnLayout.dataCellTemplateId)
    return { ok: false, errors: [error("table_cell_width_source_missing", "cellId", "Registrierte Spaltenquelle gehoert nicht zum Tabellenvertrag.")] };
  if (!Number.isFinite(width) || width < column.minimumWidth || width > column.maximumWidth)
    return { ok: false, errors: [error("table_cell_width_invalid", "width", "Breite liegt ausserhalb der registrierten Grenzen.")] };
  const updated = updateTableColumn(tableValidation.model, source.widthSourceId, { currentWidth: width });
  return updated.ok ? {
    ...updated,
    cellId: source.cellId,
    columnId: source.columnId,
    widthSourceId: source.widthSourceId,
    affectedElementIds: source.affectedElementIds,
  } : updated;
}

function validateTableElementBindings(elements) {
  if (!Array.isArray(elements)) return { ok: false, errors: [error("table_bindings_invalid", "elements", "Elementliste fehlt.")] };
  const byId = new Map(elements.map((element) => [element?.id, element]));
  const errors = [];
  for (const column of elements.filter((element) => element?.type === "tableColumn")) {
    const layout = column.tableColumnLayout;
    if (!isObject(layout)) {
      errors.push(error("table_column_layout_missing", `${column.id}.tableColumnLayout`, "Spaltenvertrag fehlt."));
      continue;
    }
    const normalized = normalizeTableColumn(layout);
    for (const [field, expectedType] of [["headerElementId", "tableHeaderCell"], ["dataCellTemplateId", "tableDataCell"]]) {
      const target = byId.get(normalized[field]);
      if (!target || target.type !== expectedType) errors.push(error("table_column_binding_missing", `${column.id}.${field}`, "Header- oder Datenzellenbindung fehlt."));
      else if (target.tableBinding?.widthSourceId !== column.id || target.tableBinding?.columnId !== column.id)
        errors.push(error("table_column_binding_inconsistent", target.id, "Header und Datenzellen müssen die Spalte als einzige Breitenquelle verwenden."));
      if (target?.allowedOps?.some((operation) => ["resize", "changeWidth"].includes(operation)))
        errors.push(error("table_cell_width_operation_forbidden", target.id, "Zellen dürfen keine unabhängige Breitenoperation anbieten."));
    }
  }
  for (const cell of elements.filter((element) => ["tableHeaderCell", "tableDataCell"].includes(element?.type))) {
    const source = resolveTableCellWidthSource(elements, cell.id);
    if (!source.ok) {
      errors.push(...source.errors);
      continue;
    }
    if (cell.allowedOps?.includes("resizeWidth")) {
      if (!source.columnLayout.resizable || !source.sourceAllowedOps.some((operation) => ["resize", "resizeWidth"].includes(operation)))
        errors.push(error("table_cell_width_source_not_resizable", cell.id, "Registrierte Spaltenquelle ist nicht fuer resizeWidth freigegeben."));
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateTableLayoutIntent(operation, payload) {
  const errors = [];
  if (!TABLE_LAYOUT_OPERATIONS.includes(operation)) return { ok: false, errors: [error("table_operation_invalid", "operation", "Tabellenoperation ist unbekannt.")] };
  if (!isObject(payload) || !isObject(payload.table) || Object.keys(payload).some((key) => key !== "table"))
    return { ok: false, errors: [error("table_payload_invalid", "payload", "Tabellenoperation erwartet ausschließlich payload.table.")] };
  const intent = payload.table;
  const allowed = {
    fitTableToViewport: ["strategy", "selectedColumnId", "neighborAction", "previewAccepted"],
    resizeColumnsProportionally: ["strategy", "previewAccepted"],
    resizeColumnBoundary: ["leftColumnId", "rightColumnId", "delta"],
    setHorizontalOverflowMode: ["horizontalOverflowMode"],
    setColumnWidthMode: ["widthMode"],
    setColumnWrapMode: ["wrapMode"],
    setColumnOverflowMode: ["overflowMode"],
    setRowHeightMode: ["rowHeightMode"],
    resetTableColumn: [],
    resetTable: [],
  }[operation];
  const unknown = Object.keys(intent).filter((key) => !allowed.includes(key));
  if (unknown.length) errors.push(error("table_payload_invalid", `payload.table.${unknown[0]}`, "Tabellenpayload enthält ein unbekanntes Feld."));
  if (operation === "setHorizontalOverflowMode" && !TABLE_HORIZONTAL_OVERFLOW_MODES.includes(intent.horizontalOverflowMode)) errors.push(error("table_overflow_mode_invalid", "payload.table.horizontalOverflowMode", "Horizontaler Überlaufmodus ist ungültig."));
  if (operation === "setColumnWidthMode" && !TABLE_WIDTH_MODES.includes(intent.widthMode)) errors.push(error("table_column_width_mode_invalid", "payload.table.widthMode", "Breitenmodus ist ungültig."));
  if (operation === "setColumnWrapMode" && !TABLE_WRAP_MODES.includes(intent.wrapMode)) errors.push(error("table_column_wrap_mode_invalid", "payload.table.wrapMode", "Umbruchmodus ist ungültig."));
  if (operation === "setColumnOverflowMode" && !TABLE_OVERFLOW_MODES.includes(intent.overflowMode)) errors.push(error("table_column_overflow_mode_invalid", "payload.table.overflowMode", "Überlaufmodus ist ungültig."));
  if (operation === "setRowHeightMode" && !TABLE_ROW_HEIGHT_MODES.includes(intent.rowHeightMode)) errors.push(error("table_row_height_mode_invalid", "payload.table.rowHeightMode", "Zeilenhöhenmodus ist ungültig."));
  if (operation === "resizeColumnBoundary") {
    if (!text(intent.leftColumnId) || !text(intent.rightColumnId)) errors.push(error("table_boundary_column_missing", "payload.table", "Beide Nachbarspalten müssen angegeben werden."));
    if (!Number.isFinite(Number(intent.delta)) || Math.abs(Number(intent.delta)) < 0.000001) errors.push(error("table_boundary_delta_invalid", "payload.table.delta", "Die Grenzverschiebung muss eine endliche Zahl ungleich null sein."));
  }
  if (["fitTableToViewport", "resizeColumnsProportionally"].includes(operation) && intent.previewAccepted !== true)
    errors.push(error("table_preview_confirmation_required", "payload.table.previewAccepted", "Anpassung an den Viewport braucht eine bestätigte Vorschau."));
  return { ok: errors.length === 0, errors, intent: clone(intent) };
}

module.exports = Object.freeze({
  TABLE_ELEMENT_TYPES,
  TABLE_WIDTH_MODES,
  TABLE_WRAP_MODES,
  TABLE_OVERFLOW_MODES,
  TABLE_HORIZONTAL_OVERFLOW_MODES,
  TABLE_VERTICAL_OVERFLOW_MODES,
  TABLE_WIDTH_POLICIES,
  TABLE_ROW_HEIGHT_MODES,
  TABLE_ALIGNMENT_MODES,
  TABLE_TOPOLOGY_POLICIES,
  TABLE_BOUNDARY_RESIZE_POLICIES,
  TABLE_LAYOUT_OPERATIONS,
  normalizeTableColumn,
  normalizeTableLayout,
  validateTableLayout,
  validateTableElementBindings,
  resolveTableCellWidthSource,
  updateTableColumnWidthFromCell,
  validateTableLayoutIntent,
  measureTableLayout,
  normalizeTableColumnRuntimeMetrics,
  validateTableColumnRuntimeMetrics,
  fitTableToViewport,
  updateTableColumn,
  resizeTableColumnBoundary,
});
