# Registry-Regeln

Die Ziel-App besitzt genau eine fuehrende explizite Registry und einen expliziten Ref-Resolver. Der Editor scannt die App nicht.

Jedes Element enthaelt mindestens `id`, `name`, `type`, `role`, `parentId`, `order`, `visible`, `editable`, `allowedOps`, `lockedOps`, `refKey` und `baseline`. Alle IDs sind stabil und eindeutig. Jeder Parent existiert; nur ein Scope-Root hat keinen Parent. Vollstaendige Scopes besitzen ein lueckenloses `expectedElementIds`-Inventar und ausschliesslich aufgeloeste Refs.

Registryversion und SHA-256-Fingerprint aendern sich deterministisch mit dem Vertrag. Fach- und Kundendaten gehen niemals in Registry oder Fingerprint ein.
