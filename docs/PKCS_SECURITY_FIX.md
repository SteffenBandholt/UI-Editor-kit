# PKCS dependency security repair

## Cause and change

BBMpro's Windows acceptance at `8628192` failed during the native Manager
publish because NuGet auditing reported NU1902/NU1903. The source is
`ReferenceTargetApp.PdfRendering` -> `PDFsharp 6.2.4` ->
`System.Security.Cryptography.Pkcs >= 8.0.1`. `PdfPreview`, the reference WPF
application and Manager consume that project transitively. PDFsharp's NuGet
nuspec requests 8.0.1 for all its target frameworks, including net10.0.

[GHSA-2fmv-rv2c-59x7](https://github.com/advisories/GHSA-2fmv-rv2c-59x7)
and [GHSA-846f-f764-76mx](https://github.com/advisories/GHSA-846f-f764-76mx)
list 8.0.2 / 9.0.21 / 10.0.13 as patched stable versions. The projects already
target .NET 10. An explicit PKCS **10.0.13** PackageReference at the PDFsharp
boundary keeps the dependency in the native target's runtime family and avoids
the SDK's pruning of older PKCS references. PDFsharp remains 6.2.4; PDF rendering
code, editor behavior, contracts and target application domain code are unchanged.

No NoWarn, NuGetAudit suppression, audit disable, or TreatWarningsAsErrors
exception was introduced. Restore runs with `NuGetAudit=true` and
`NuGetAuditMode=all`.

## Verification

Using SDK 10.0.402 / runtime 10.0.13 in an isolated Linux build container:

- Both solutions restored successfully with full NuGet auditing.
- Actual `project.assets.json` graphs resolve PKCS 10.0.13 in consumers.
- Complete direct/transitive dependency reports captured for both solutions;
  vulnerability reports: Manager five projects, reference seven projects,
  zero known vulnerable packages reported by nuget.org.
- Release build of reference application and both native test assemblies;
  self-contained win-x64 Manager publish completed. These are cross-builds,
  not Windows execution proofs.
- Security-checker negative cases reject old resolutions, vulnerability entries,
  incomplete reports and audit errors.
- The full existing JavaScript pretest was executed and remains red at the
  pre-existing `m82-3-spacing-compact-ui.test.cjs:53` source breakpoint assertion
  (`860/1260` versus current compact view). Neither that test nor view was changed.

The `native-security.yml` Windows CI runs audited restores, complete dependency
reports, both native builds and test suites, then the same self-contained Manager
publish used by BBMpro. Its actual run result is tracked in the PR; no Windows
success is inferred from a Linux build. The existing PDF base/head regression
workflow can still fail on the unpatched base because of the reported dependency;
base security warnings are not suppressed.

BBMpro must reference the fixing Kit commit in package.json, package-lock.json
and its Windows runner. The runner must also use a patched .NET 10 SDK/runtime
when creating the self-contained editor. Installation, UIA/pipe acceptance,
physical Windows DPI, and production approval remain separate checks.
