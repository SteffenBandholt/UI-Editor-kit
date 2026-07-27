# App-Starterpaket - bestehende App

1. Im nativen Manager **Bestehende App nachruesten** waehlen.
2. Der Manager prueft Quellcode, WPF/Electron, Adapter, vorhandene Integration, Manifest, Git, Schreibrechte und Fremddateien.
3. Ohne Quellcode oder offizielle Erweiterungsschnittstelle wird ohne Dateiaenderung blockiert.
4. Vorschau pruefen und bestaetigen.
5. WPF verwendet fuer die eigentliche Bestandsregistrierung den vorhandenen M79-Weg. Ungepruefte Vorschlaege werden nie automatisch freigegeben.
6. Electron verwendet den bestehenden Vertrag 1.2. Eine bereits angebundene App erhaelt nur Startermetadaten; Bridge, Registry, Refs und HostAdapter werden nicht doppelt installiert.
7. `registrationRequired`/`registrationInProgress` und unvollstaendige Scopes bleiben blockiert. Nur vollstaendige Scopes duerfen oeffnen.
