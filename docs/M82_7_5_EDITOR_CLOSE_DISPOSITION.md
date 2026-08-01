# M82.7.5 – Eindeutige Editor-Close-Disposition

## Status

`[A]` – Der gemeinsame native Editor meldet seinen Sitzungsabschluss eindeutig und appneutral.

## Vertrag

Der WPF-Editor unterscheidet beim erfolgreichen Abschluss:

- `saved`: UI- und PDF-Zustand wurden erfolgreich gespeichert.
- `clean`: Es gab keine ungespeicherten Änderungen.
- `discarded`: Der Nutzer hat ausdrücklich „Ohne Speichern“ gewählt.
- `unknown`: Abbruch, Fehler oder nicht eindeutig abgeschlossener Pfad.

Die Disposition wird über die vorhandene Electron-Pipe mit `shutdownTargetSession` übertragen. Sie entscheidet nicht selbst über Layoutwerte oder Profile; die Ziel-App bildet sie an ihrer bereits vorhandenen Sitzungsgrenze ab. Der gemeinsame Core enthält keine BBM-ID und keinen BBM-Profilcode.

## Nachweis

- Der neue Vertrags-Test prüft alle vier Dispositionen, den Save-/Discard-/Clean-Pfad und die unveränderte Fehler-/Abbruchsemantik.
- Solution-Build: 0 Fehler, 0 Warnungen; Manager-Tests: 103/103 grün.
- Referenz-App-Build: 0 Fehler, 0 Warnungen; Referenz-App-Tests: 106/106 grün.
- `npm test`, `npm pack --dry-run` und `npm run release:check`: grün.
- Der BBM-Zweilauf bestätigt `saved` sowie den erneuten Startup-Restore über den bestehenden atomaren Profilstore.

Keine neue Editoroberfläche, Registry oder Profilablage wurde ergänzt.
