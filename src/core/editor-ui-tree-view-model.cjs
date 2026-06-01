"use strict";

function cloneNeutralValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneNeutralValue(entry));
  }

  if (value && typeof value === "object") {
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneNeutralValue(value[key]);
    });
    return clone;
  }

  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasFunction(source, name) {
  return isObject(source) && typeof source[name] === "function";
}

function assertEditorCore(editorCore) {
  if (!isObject(editorCore) || !hasFunction(editorCore, "getElementTree")) {
    throw new TypeError("createEditorTreeViewModel erwartet einen Editor-Core mit getElementTree().");
  }
}

function normalizeOptions(options) {
  if (options === undefined || options === null) {
    return { includeHidden: true };
  }

  if (!isObject(options)) {
    throw new TypeError("Editor-Tree-ViewModel-Optionen muessen ein Objekt sein.");
  }

  return {
    includeHidden: options.includeHidden !== false,
  };
}

function getElementForView(editorCore, treeElement) {
  if (!treeElement || typeof treeElement.id !== "string") {
    return cloneNeutralValue(treeElement);
  }

  if (!hasFunction(editorCore, "getElementDetails")) {
    return cloneNeutralValue(treeElement);
  }

  const details = editorCore.getElementDetails(treeElement.id);
  if (!details) {
    return cloneNeutralValue(treeElement);
  }

  return cloneNeutralValue(details);
}

function createOperationSummary(editorCore, elementId) {
  if (!hasFunction(editorCore, "getElementOperations") || typeof elementId !== "string") {
    return undefined;
  }

  const operations = editorCore.getElementOperations(elementId);
  if (!operations || typeof operations !== "object") {
    return undefined;
  }

  const allowedOps = Array.isArray(operations.allowedOps) ? operations.allowedOps : [];
  const lockedOps = Array.isArray(operations.lockedOps) ? operations.lockedOps : [];
  const availableOps = Array.isArray(operations.availableOps) ? operations.availableOps : [];

  return {
    allowedCount: allowedOps.length,
    lockedCount: lockedOps.length,
    availableCount: availableOps.length,
  };
}

function createTreeNode(editorCore, treeNode, depth, parentPath, includeHidden) {
  if (!isObject(treeNode) || !isObject(treeNode.element) || !Array.isArray(treeNode.children)) {
    throw new TypeError("Editor-Core lieferte keinen gueltigen Elementbaum.");
  }

  const element = getElementForView(editorCore, treeNode.element);
  const isVisible = element.visible !== false;
  if (!includeHidden && !isVisible) {
    return null;
  }

  const path = parentPath.concat(element.id);
  const children = treeNode.children
    .map((childNode) => createTreeNode(editorCore, childNode, depth + 1, path, includeHidden))
    .filter((childNode) => childNode !== null);

  const viewNode = {
    id: element.id,
    label: Object.prototype.hasOwnProperty.call(element, "name") ? element.name : null,
    type: element.type,
    role: element.role,
    parentId: element.parentId,
    order: element.order,
    visible: element.visible,
    editable: element.editable,
    depth,
    path,
    children,
  };

  const operationSummary = createOperationSummary(editorCore, element.id);
  if (operationSummary) {
    viewNode.operationSummary = operationSummary;
  }

  return viewNode;
}

function collectNodes(node, target) {
  if (!node) {
    return;
  }

  target.push(node);
  node.children.forEach((childNode) => collectNodes(childNode, target));
}

function createEditorTreeViewModel(editorCore, options) {
  assertEditorCore(editorCore);
  const normalizedOptions = normalizeOptions(options);
  const elementTree = editorCore.getElementTree();

  if (elementTree === null) {
    return {
      root: null,
      nodes: [],
    };
  }

  const root = createTreeNode(editorCore, elementTree, 0, [], normalizedOptions.includeHidden);
  const nodes = [];
  collectNodes(root, nodes);

  return cloneNeutralValue({ root, nodes });
}

module.exports = {
  createEditorTreeViewModel,
};
