# M58.1 Browser-ESM-Einstieg fuer Selection-Runtime

## Ursache des Renderer-Importfehlers

Der bisherige Paket-Root `ui-editor-kit` ist ein CommonJS-Einstieg ueber `src/index.cjs`. In einem Electron-Renderer, der natives Browser-ESM ohne Bundler verwendet, kann `import("ui-editor-kit")` diesen Root-Export nicht als Browser-Modul aufloesen, weil `package.json` am Root nur die `require`-Bedingung anbietet.

## CommonJS versus Browser-ESM

CommonJS bleibt fuer bestehende Node- und Paketnutzer unveraendert ueber `require("ui-editor-kit")` erhalten. Der Browser-ESM-Einstieg ist ein separates Artefakt ohne `require()`, ohne `module.exports`, ohne Node-Core-Imports und ohne nackte Paketimporte. Er ist fuer native Browser-ESM-Lader gedacht und wird nicht zur Laufzeit der Zielanwendung gebaut.

## Artefaktpfad

Das browserfaehige Runtime-Artefakt liegt hier:

```text
dist/selection-runtime.browser.mjs
```

## Exports

Der ESM-Einstieg exportiert mindestens:

- `createSelectionController`
- `createHoverOverlay`
- `createSelectedOverlay`
- `resolveSelectionTarget`
- `SelectionRuntimeErrorCodes`
- `SELECTION_CONTRACT_VERSION`

Die Vertragsversion bleibt `selection-target-contract-v1.0` und ist unabhaengig von der Paketversion `0.2.0`.

## Buildverfahren

Das Artefakt wird deterministisch aus den bestehenden M57/M58-Quellen erzeugt:

```bash
npm run build:selection-runtime:browser
```

Der Build liest die bestehenden Selection-Contract- und Selection-Runtime-Quellen unter `src/contracts/` und `src/selection/`, entfernt CommonJS-Huellcode und schreibt ein eigenstaendiges ESM-Artefakt nach `dist/selection-runtime.browser.mjs`. Es gibt keinen manuell gepflegten zweiten Runtime-Fork.

## Integrationsbeispiel mit relativem Pfad

Ein nativer Renderer kann das Artefakt ueber einen relativen Pfad laden, wenn es mit der Zielanwendung ausgeliefert wird:

```js
const selectionRuntime = await import("./vendor/ui-editor-kit/selection-runtime.browser.mjs");

const controller = selectionRuntime.createSelectionController({
  host: selectionHost,
  document,
  window,
});

controller.start();
```

Alternativ kann direkt aus dem Paket-Unterpfad importiert werden, wenn der Host diesen Unterpfad vorher in eine browserlesbare Dateiablage kopiert:

```js
const { createSelectionController } = await import("./ui-editor-kit/selection-runtime.browser.mjs");
```

## Sicherheitsgrenzen

Der Browser-ESM-Einstieg enthaelt keine Electron- oder IPC-Abhaengigkeit, keine Node-Core-Imports, keine BBM-Namen und keine DOM-Suche. Die Runtime arbeitet nur mit explizit gelieferten Element-Referenzen des `SelectionHost`; sie fuehrt keine neue Selection-Logik, keine Layoutbearbeitung, kein Drag und kein Resize ein.

## Folgeschritt fuer BBM-PR #197

BBM-PR #197 soll das gebaute Artefakt `dist/selection-runtime.browser.mjs` aus `ui-editor-kit` in eine browserlesbare Vendor-/Runtime-Ablage kopieren und im Electron-Renderer ausschliesslich per relativem nativen ESM-Import laden. Der Renderer darf weiterhin nicht `require("ui-editor-kit")` oder CommonJS direkt laden.
