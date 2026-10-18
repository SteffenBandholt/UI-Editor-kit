# NU1505: Windows manager publish

## Reproduction and cause

BBMpro `366cd14` called `dotnet publish` with the **global** property
`RuntimeFrameworkVersion=10.0.13`. The previous Kit CI did not use that argument.
The exact consumer command reproduces NU1505 on the unchanged Kit `d204a73`:
Windows SDK PackageDownload entries `Microsoft.Windows.SDK.NET.Ref [10.0.13]`
and `[10.0.19041.57]` in PdfPreview, reference WPF and Manager.

This is an MSBuild framework-resolution conflict, not two manually declared
Windows SDK dependencies or a PDFsharp transitive Windows SDK reference. The
NuGet configuration and original projects have no manual PackageDownload for it.
The SDK's framework resolver applies a global runtime override to the implicit
Windows SDK framework as well as to the .NET runtime frameworks.

## Repair

- `Directory.Build.targets` pins runtime/targeting packs **only** for .NET 10
  Microsoft.NETCore.App and all WindowsDesktop variants, at 10.0.13. Both actual
  FrameworkReference metadata and matching KnownFrameworkReference metadata are
  aligned: SDK 10.0.100 would otherwise request an additional Desktop targeting
  pack 10.0.0 for an implicit/transitive framework variant.
- Windows SDK framework metadata remains SDK-controlled. It resolves one Windows
  SDK version, currently 10.0.19041.57 for the declared target platform.
- A global RuntimeFrameworkVersion is rejected with an explanatory build error.
  No PackageDownload is blindly removed, deduplicated or hidden by NoWarn.
- `scripts/publish-windows-manager.cjs` is the single real publish entry point
  for CI and BBMpro. It verifies SDK identity, restored dependency graphs,
  conflicting PackageDownload versions, PKCS 10.0.13 and both published runtime
  frameworks at 10.0.13. A structured receipt is written beside the EXE.
- Stable .NET 10 SDK 10.0.100 is supported as a compiler/bootstrap, including a
  truly isolated installation. Its original runtime/targeting packs are not
  accepted as the published runtime. global.json permits stable .NET 10 feature
  roll-forward; runtime security is enforced independently.
- CI installs SDK 10.0.100 into an empty SDK directory, asserts the exact version
  and invokes that executable explicitly. Publish is proved with that vanilla
  SDK before any additional runtime is installed. Patched Core/Desktop runtimes
  are installed afterwards only to execute framework-dependent native test
  hosts; no newer SDK/compiler is installed into that directory.

PKCS remains 10.0.13. NuGetAudit=true/Mode=all and existing TreatWarningsAsErrors
remain active. Reference UI, renderer, PDF implementation and domain code are
unchanged.

## Evidence and tests

The original global-override command reproduced the exact NU1505 conflict.
The corrected per-framework policy cross-publishes both with SDK 10.0.402 and
isolated SDK 10.0.100; both outputs include Core/Desktop runtime 10.0.13.
The actual Windows matrix runs the shared consumer command under both SDK
selections before the next local Windows acceptance command is released.
Actual CI results and test counts are recorded in PR #94.

Every one of the 67 existing JavaScript pretest/test commands is executed
independently and logged, even after a failure. Four existing UI-source snapshot
expectations remain failing; the documentation-header regression introduced by
the preceding status insertion was corrected by restoring the unchanged required
notice to the top of STATUS.md. Existing assertions were not loosened.
Both native suites run independently after publish; their previously documented
failures remain visible. This is build/installation acceptance, not a production
or interactive UI/DPI release.
