#!/usr/bin/env node

/*
 * UI-Editor-Kit Vertragscheck
 *
 * Fachneutraler, dependency-freier Vertragscheck fuer vorhandene data-ui-* Metadaten.
 * Keine Fachlogik, keine semantische Ableitung, kein DOM-Parser.
 */

const fs = require("fs");
const path = require("path");

const REQUIRED_ATTRIBUTES = [
  "data-ui-inspector-id",
  "data-ui-editor-kind",
  "data-ui-editor-label",
  "data-ui-editor-parent",
  "data-ui-editor-editable",
];

const OPTIONAL_ATTRIBUTES = ["data-ui-editor-ops"];
const ALLOWED_KINDS = ["frame", "field", "single"];
const ALLOWED_OPS = ["move", "resize", "hide", "layout"];
const ALLOWED_EDITABLE = ["true", "false"];

function getContractSummary() {
  return {
    requiredAttributes: REQUIRED_ATTRIBUTES.slice(),
    optionalAttributes: OPTIONAL_ATTRIBUTES.slice(),
    allowedKinds: ALLOWED_KINDS.slice(),
    allowedOps: ALLOWED_OPS.slice(),
    allowedEditable: ALLOWED_EDITABLE.slice(),
    rootRule: "Root wird nur ueber leeres data-ui-editor-parent=\"\" erkannt.",
  };
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseAttributes(tagText) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;

  while ((m = attrRegex.exec(tagText)) !== null) {
    const name = m[1].toLowerCase();
    const raw = m[3] !== undefined ? m[3] : m[4];
    attrs[name] = decodeHtmlEntities(raw);
  }

  return attrs;
}

function lineFromIndex(text, index) {
  if (index <= 0) {
    return 1;
  }
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function extractEditorElements(text) {
  const elements = [];
  const tagRegex = /<([a-zA-Z][\w:-]*)(\s[^>]*?)?>/g;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const tagName = match[1].toLowerCase();
    const fullTag = match[0];
    const attrs = parseAttributes(fullTag);

    if (!Object.prototype.hasOwnProperty.call(attrs, "data-ui-inspector-id")) {
      continue;
    }

    elements.push({
      tagName,
      attrs,
      inspectorId: String(attrs["data-ui-inspector-id"] || "").trim(),
      line: lineFromIndex(text, match.index),
    });
  }

  return elements;
}

function validateEditorElements(elements, fileLabel) {
  const errors = [];
  const idToElement = new Map();

  for (const el of elements) {
    const id = el.inspectorId;
    if (!id) {
      errors.push({
        file: fileLabel,
        id: "<leer>",
        line: el.line,
        message: "Pflichtattribut data-ui-inspector-id darf nicht leer sein.",
      });
      continue;
    }

    if (idToElement.has(id)) {
      errors.push({
        file: fileLabel,
        id,
        line: el.line,
        message: "Doppelte data-ui-inspector-id gefunden.",
      });
    } else {
      idToElement.set(id, el);
    }
  }

  for (const el of elements) {
    const id = el.inspectorId || "<leer>";
    const attrs = el.attrs;

    for (const attr of REQUIRED_ATTRIBUTES) {
      if (!Object.prototype.hasOwnProperty.call(attrs, attr)) {
        errors.push({
          file: fileLabel,
          id,
          line: el.line,
          message: `Pflichtattribut fehlt: ${attr}.`,
        });
      }
    }

    const kind = (attrs["data-ui-editor-kind"] || "").trim().toLowerCase();
    if (kind && !ALLOWED_KINDS.includes(kind)) {
      errors.push({
        file: fileLabel,
        id,
        line: el.line,
        message: `Ungueltiger kind-Wert: ${attrs["data-ui-editor-kind"]}. Erlaubt: ${ALLOWED_KINDS.join(", ")}.`,
      });
    }

    const editable = (attrs["data-ui-editor-editable"] || "").trim().toLowerCase();
    if (editable && !ALLOWED_EDITABLE.includes(editable)) {
      errors.push({
        file: fileLabel,
        id,
        line: el.line,
        message: "Ungueltiger editable-Wert. Erlaubt: true oder false.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(attrs, "data-ui-editor-ops")) {
      const opsRaw = String(attrs["data-ui-editor-ops"] || "").trim();
      if (opsRaw.length > 0) {
        const invalidOps = opsRaw
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter((x) => x && !ALLOWED_OPS.includes(x));

        if (invalidOps.length > 0) {
          errors.push({
            file: fileLabel,
            id,
            line: el.line,
            message: `Ungueltige ops-Werte: ${invalidOps.join(", ")}. Erlaubt: ${ALLOWED_OPS.join(", ")}.`,
          });
        }
      }
    }

    const parent = String(attrs["data-ui-editor-parent"] || "");
    const isRoot = parent === "";

    if (!isRoot) {
      const parentId = parent.trim();
      if (!parentId) {
        errors.push({
          file: fileLabel,
          id,
          line: el.line,
          message: "Parent ist nur als exakt leerer String fuer Root erlaubt.",
        });
      } else if (!idToElement.has(parentId)) {
        errors.push({
          file: fileLabel,
          id,
          line: el.line,
          message: `Parent nicht gefunden: ${parentId}.`,
        });
      }
    }
  }

  return {
    file: fileLabel,
    elementCount: elements.length,
    valid: errors.length === 0,
    errors,
  };
}

function validateText(text, fileLabel) {
  const elements = extractEditorElements(text);
  return validateEditorElements(elements, fileLabel || "<text>");
}

function validateFiles(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    const absolutePath = path.resolve(filePath);
    let text;
    try {
      text = fs.readFileSync(absolutePath, "utf8");
    } catch (error) {
      results.push({
        file: filePath,
        elementCount: 0,
        valid: false,
        errors: [
          {
            file: filePath,
            id: "-",
            line: 0,
            message: `Datei konnte nicht gelesen werden: ${error.message}`,
          },
        ],
      });
      continue;
    }

    results.push(validateText(text, filePath));
  }

  return results;
}

function formatError(error) {
  const lineSuffix = error.line ? ` (Zeile ${error.line})` : "";
  return `- Datei: ${error.file} | Element-ID: ${error.id}${lineSuffix} | Fehler: ${error.message}`;
}

function printHelp() {
  console.log(`UI-Editor-Kit Vertragscheck

Nutzung:
  node scripts/ui-editor-contract-check.cjs --help
  node scripts/ui-editor-contract-check.cjs --self-test
  node scripts/ui-editor-contract-check.cjs <datei1> <datei2> ...

Prueft nur vorhandene data-ui-* Metadaten gemaess UI-Editor-Vertrag.`);
}

function runSelfTest() {
  const validSample = `
<div data-ui-inspector-id="demo.root" data-ui-editor-kind="frame" data-ui-editor-label="Demo Root" data-ui-editor-parent="" data-ui-editor-editable="true" data-ui-editor-ops="move,resize,hide,layout"></div>
<div data-ui-inspector-id="demo.content" data-ui-editor-kind="field" data-ui-editor-label="Demo Content" data-ui-editor-parent="demo.root" data-ui-editor-editable="false"></div>
`;

  const invalidSample = `
<div data-ui-inspector-id="demo.root" data-ui-editor-kind="frame" data-ui-editor-label="Demo Root" data-ui-editor-parent="" data-ui-editor-editable="true"></div>
<div data-ui-inspector-id="demo.root" data-ui-editor-kind="unknown" data-ui-editor-label="Dup" data-ui-editor-parent="missing.parent" data-ui-editor-editable="yes" data-ui-editor-ops="move,foo"></div>
`;

  const validResult = validateText(validSample, "self-test-valid");
  const invalidResult = validateText(invalidSample, "self-test-invalid");

  const ok = validResult.valid && !invalidResult.valid && invalidResult.errors.length >= 4;

  if (!ok) {
    console.log("SELF-TEST FAILED");
    for (const error of invalidResult.errors) {
      console.log(formatError(error));
    }
    return 1;
  }

  console.log("SELF-TEST OK");
  console.log(`- valid sample: ${validResult.elementCount} Elemente, 0 Fehler`);
  console.log(`- invalid sample: ${invalidResult.elementCount} Elemente, ${invalidResult.errors.length} Fehler`);
  return 0;
}

function runCli(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printHelp();
    return 0;
  }

  if (args.includes("--self-test")) {
    return runSelfTest();
  }

  const results = validateFiles(args);
  const allErrors = results.flatMap((r) => r.errors);

  if (allErrors.length === 0) {
    const fileCount = results.length;
    const elementCount = results.reduce((sum, r) => sum + r.elementCount, 0);
    console.log(`OK: ${fileCount} Datei(en), ${elementCount} editorrelevante(s) Element(e), 0 Fehler.`);
    return 0;
  }

  console.log(`FEHLER: ${allErrors.length} Vertragsverletzung(en) gefunden.`);
  for (const error of allErrors) {
    console.log(formatError(error));
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = runCli(process.argv);
}

module.exports = {
  REQUIRED_ATTRIBUTES,
  OPTIONAL_ATTRIBUTES,
  ALLOWED_KINDS,
  ALLOWED_OPS,
  getContractSummary,
  extractEditorElements,
  validateEditorElements,
  validateText,
  validateFiles,
};
