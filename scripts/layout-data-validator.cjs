#!/usr/bin/env node

/*
 * UI-Editor-Kit Layoutdaten-Validator (K1.3)
 *
 * Prueft fachneutral ein Layoutdaten-JSON gemaess docs/LAYOUTDATEN_MODELL.md.
 * Keine Speicherung, keine UI-Aenderung, keine Fachlogik.
 */

const fs = require("fs");
const path = require("path");

const ROOT_ALLOWED_FIELDS = ["version", "scope", "items"];
const ITEM_ALLOWED_FIELDS = [
  "visible",
  "x",
  "y",
  "width",
  "height",
  "order",
  "layoutHint",
  "updatedAt",
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function makeError(pathValue, code, message) {
  return { path: pathValue, code, message };
}

function validateLayoutData(input, options) {
  const opts = options || {};
  const errors = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: [makeError("$", "ROOT_NOT_OBJECT", "Layoutdaten muessen ein Objekt sein.")],
    };
  }

  const rootKeys = Object.keys(input);

  if (!Object.prototype.hasOwnProperty.call(input, "version")) {
    errors.push(makeError("$.version", "MISSING_REQUIRED_FIELD", "Pflichtfeld fehlt: version."));
  } else if (typeof input.version !== "number" || Number.isNaN(input.version)) {
    errors.push(makeError("$.version", "INVALID_TYPE", "version muss eine Zahl sein."));
  }

  if (!Object.prototype.hasOwnProperty.call(input, "items")) {
    errors.push(makeError("$.items", "MISSING_REQUIRED_FIELD", "Pflichtfeld fehlt: items."));
  } else if (!isPlainObject(input.items)) {
    errors.push(makeError("$.items", "INVALID_TYPE", "items muss ein Objekt sein."));
  }

  if (Object.prototype.hasOwnProperty.call(input, "scope") && typeof input.scope !== "string") {
    errors.push(makeError("$.scope", "INVALID_TYPE", "scope muss ein String sein."));
  }

  for (const key of rootKeys) {
    if (!ROOT_ALLOWED_FIELDS.includes(key)) {
      errors.push(
        makeError(
          `$.${key}`,
          "UNKNOWN_ROOT_FIELD",
          `Unbekanntes Feld auf Root-Ebene: ${key}.`
        )
      );
    }
  }

  if (isPlainObject(input.items)) {
    const knownIds = Array.isArray(opts.knownIds) ? new Set(opts.knownIds) : null;
    const unknownIdPolicy = opts.unknownIdPolicy === "ignore" ? "ignore" : "report";

    for (const itemId of Object.keys(input.items)) {
      const itemPath = `$.items.${itemId}`;
      const itemValue = input.items[itemId];

      if (!itemId || typeof itemId !== "string") {
        errors.push(makeError(itemPath, "INVALID_ITEM_ID", "Element-ID muss ein nicht-leerer String sein."));
      }

      if (!isPlainObject(itemValue)) {
        errors.push(makeError(itemPath, "ITEM_NOT_OBJECT", "Layoutdatensatz muss ein Objekt sein."));
        continue;
      }

      if (knownIds && !knownIds.has(itemId) && unknownIdPolicy === "report") {
        errors.push(
          makeError(
            itemPath,
            "UNKNOWN_ELEMENT_ID",
            `Element-ID nicht in bekannter UI-Liste enthalten: ${itemId}.`
          )
        );
      }

      for (const field of Object.keys(itemValue)) {
        if (!ITEM_ALLOWED_FIELDS.includes(field)) {
          errors.push(
            makeError(
              `${itemPath}.${field}`,
              "UNKNOWN_ITEM_FIELD",
              `Unbekanntes Feld im Layoutdatensatz: ${field}.`
            )
          );
          continue;
        }

        const value = itemValue[field];
        const fieldPath = `${itemPath}.${field}`;

        if (field === "visible" && typeof value !== "boolean") {
          errors.push(makeError(fieldPath, "INVALID_TYPE", "visible muss boolean sein."));
        }

        if (
          (field === "x" ||
            field === "y" ||
            field === "width" ||
            field === "height" ||
            field === "order") &&
          (typeof value !== "number" || Number.isNaN(value))
        ) {
          errors.push(makeError(fieldPath, "INVALID_TYPE", `${field} muss eine Zahl sein.`));
        }

        if ((field === "width" || field === "height") && typeof value === "number" && value < 0) {
          errors.push(
            makeError(fieldPath, "NEGATIVE_DIMENSION", `${field} darf nicht negativ sein.`)
          );
        }

        if ((field === "layoutHint" || field === "updatedAt") && typeof value !== "string") {
          errors.push(makeError(fieldPath, "INVALID_TYPE", `${field} muss ein String sein.`));
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const text = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(text);
}

function formatError(error) {
  return `- ${error.path} | ${error.code} | ${error.message}`;
}

function printHelp() {
  console.log(`UI-Editor-Kit Layoutdaten-Validator

Nutzung:
  node scripts/layout-data-validator.cjs --help
  node scripts/layout-data-validator.cjs --self-test
  node scripts/layout-data-validator.cjs <layout.json>

Optional:
  node scripts/layout-data-validator.cjs <layout.json> --known-ids id1,id2,id3
  node scripts/layout-data-validator.cjs <layout.json> --unknown-id-policy ignore
`);
}

function runSelfTest() {
  const valid = {
    version: 1,
    scope: "demo.scope",
    items: {
      "demo.header": {
        visible: true,
        x: 0,
        y: 0,
        width: 800,
        height: 80,
        order: 1,
      },
    },
  };

  const invalidRoot = [];
  const missingRequired = { scope: "demo.scope", items: {} };
  const invalidTypes = {
    version: "1",
    items: {
      "demo.header": {
        visible: "true",
        width: -1,
      },
    },
  };

  const r1 = validateLayoutData(valid);
  const r2 = validateLayoutData(invalidRoot);
  const r3 = validateLayoutData(missingRequired);
  const r4 = validateLayoutData(invalidTypes);

  const ok = r1.ok && !r2.ok && !r3.ok && !r4.ok;
  if (!ok) {
    console.log("SELF-TEST FAILED");
    [r2, r3, r4].forEach((r) => r.errors.forEach((e) => console.log(formatError(e))));
    return 1;
  }

  console.log("SELF-TEST OK");
  console.log("- gueltiges minimales Beispiel: OK");
  console.log("- ungueltige Grundstruktur: erkannt");
  console.log("- fehlende Pflichtfelder: erkannt");
  console.log("- falsche Datentypen/Wertebereiche: erkannt");
  return 0;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    return { mode: "help" };
  }
  if (args.includes("--self-test")) {
    return { mode: "self-test" };
  }

  const file = args.find((x) => !x.startsWith("--"));
  if (!file) {
    return { mode: "help" };
  }

  let knownIds = null;
  const knownIdsArg = args.find((x) => x.startsWith("--known-ids"));
  if (knownIdsArg) {
    const eq = knownIdsArg.split("=");
    const value = eq.length > 1 ? eq.slice(1).join("=") : "";
    knownIds = value ? value.split(",").map((x) => x.trim()).filter(Boolean) : [];
  }

  let unknownIdPolicy = "report";
  const policyArg = args.find((x) => x.startsWith("--unknown-id-policy"));
  if (policyArg) {
    const eq = policyArg.split("=");
    const value = eq.length > 1 ? eq.slice(1).join("=") : "";
    if (value === "ignore") {
      unknownIdPolicy = "ignore";
    }
  }

  return {
    mode: "validate-file",
    file,
    options: { knownIds, unknownIdPolicy },
  };
}

function runCli(argv) {
  const parsed = parseArgs(argv);

  if (parsed.mode === "help") {
    printHelp();
    return 0;
  }

  if (parsed.mode === "self-test") {
    return runSelfTest();
  }

  try {
    const data = readJsonFile(parsed.file);
    const result = validateLayoutData(data, parsed.options);
    if (result.ok) {
      console.log("OK: Layoutdaten sind gueltig.");
      return 0;
    }
    console.log(`FEHLER: ${result.errors.length} Validierungsfehler gefunden.`);
    result.errors.forEach((e) => console.log(formatError(e)));
    return 1;
  } catch (error) {
    console.log(`FEHLER: Datei konnte nicht geprueft werden: ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv);
}

module.exports = {
  ROOT_ALLOWED_FIELDS,
  ITEM_ALLOWED_FIELDS,
  validateLayoutData,
};

