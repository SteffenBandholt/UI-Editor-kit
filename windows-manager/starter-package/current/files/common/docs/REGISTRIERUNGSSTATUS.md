# Registrierungsstatus

- `development`: neue App, Geruest vorhanden, noch keine fertige UI
- `registrationRequired`: bestehende App, Registrierung fehlt
- `registrationInProgress`: kontrollierte Ziel-App-Registrierung laeuft
- `incomplete`: Registry, Refs, Baseline oder Capabilities fehlen
- `complete`: alle erwarteten Elemente und Refs des Scopes sind vollstaendig
- `changed`: kompatible Registryaenderung erkannt
- `incompatible`: Migration oder Vertragskorrektur erforderlich
- `blocked`: Scope darf nicht bearbeitet werden

Nur vollstaendige Scopes werden in `activeScopes` aufgenommen.
