# App-Starterpaket - Manifestvertrag

`ui-editor-target.json` verwendet Schema 2 und enthaelt mindestens:

`schemaVersion`, `starterPackageVersion`, `applicationId`, `displayName`, `framework`, `integrationMode`, `contractVersion`, `adapterVersion`, `registryVersion`, `registryFingerprint`, `registryStatus`, `activeScopes`, `uiCapability`, `pdfCapability`, `profileRoot`, `supportedOperations`, `selectionCapability`, `visibilityCapability`, `labelFieldSeparation`, `transportProtocolVersion`, `installationOwnership`, `installedAt`, `updatedAt`.

Zulaessige Frameworks sind `wpf` und `electron`; Integrationsmodi sind `new-app` und `existing-app`. Registryzustaende sind `development`, `registrationRequired`, `registrationInProgress`, `incomplete`, `complete`, `changed`, `incompatible` und `blocked`.

`development` und `registrationRequired` besitzen keine aktiven Scopes. Der Fingerprint ist `sha256:` plus 64 Kleinbuchstaben-Hexzeichen. Manifest, Registry und Fingerprint enthalten keine Fach-, Kunden- oder Datensatzwerte.

`managerTarget` ist optional. Es bleibt `null`, solange nur das Entwicklungsgeruest vorliegt. Nach der ausdruecklich geprueften M79-Registrierung einer WPF-App enthaelt es den bestehenden nativen Manager-Zielvertrag. Registryversion, Fingerprint, aktive Scopes und `registryStatus = complete` stammen weiterhin aus der Ziel-App-Registry. Updates des Starterpakets erhalten diese zielapp-eigenen Werte.
