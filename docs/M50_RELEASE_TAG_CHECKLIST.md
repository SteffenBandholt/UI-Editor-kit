# M50 Release-Tag-Checkliste fuer UI-Editor-kit v0.2.0

Diese Checkliste bereitet den lokalen Git-Tag und das GitHub-Release fuer `v0.2.0` vor. M50 erstellt selbst keinen Tag, kein GitHub-Release und keine npm-Veroeffentlichung.

## Vor dem Tag

- [ ] `main` ist sauber.
- [ ] `main` entspricht `origin/main`.
- [ ] `package.json`-Version ist exakt `0.2.0`.
- [ ] `CHANGELOG.md` enthaelt den Abschnitt `0.2.0`.
- [ ] Release Notes existieren unter `docs/releases/v0.2.0.md`.
- [ ] `git diff --check` ist erfolgreich.
- [ ] `npm test` ist erfolgreich.
- [ ] Der oeffentliche Paketimport funktioniert ueber `src/index.cjs` beziehungsweise den Paket-Export.
- [ ] Kein unerwuenschter Fachbezug ist im Public Core vorhanden.

## Tag-Erstellung

- [ ] Annotierten Tag `v0.2.0` erstellen.
- [ ] Der Tag liegt auf dem finalen Merge-Commit von M50.
- [ ] Tag-Nachricht lautet: `UI-Editor-kit v0.2.0`.
- [ ] Tag lokal pruefen.
- [ ] Tag zu `origin` pushen.

Beispielbefehle nach dem Merge von M50:

```bash
git checkout main
git pull --ff-only origin main
git status --short
git tag -a v0.2.0 -m "UI-Editor-kit v0.2.0"
git show v0.2.0 --no-patch
git push origin v0.2.0
```

## GitHub-Release

- [ ] Tag `v0.2.0` auswaehlen.
- [ ] Release-Titel setzen: `UI-Editor-kit v0.2.0`.
- [ ] Inhalt aus `docs/releases/v0.2.0.md` verwenden.
- [ ] Nicht als Pre-Release markieren.
- [ ] Kein `Latest`-Zwang dokumentieren, falls spaetere Releases folgen.
- [ ] Keine Binaerdateien oder npm-Pakete anhaengen.
- [ ] Release nach der Veroeffentlichung pruefen.

## Nach dem Release

- [ ] Tag lokal pruefen.
- [ ] Tag remote pruefen.
- [ ] GitHub-Release pruefen.
- [ ] `main` ist weiterhin sauber.
- [ ] `STATUS.md` kontrollieren.
