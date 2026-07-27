param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$BbmRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\BBM-Produktiv')).Path
)
$managerRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'UI-Editor-kit\Manager'
$appRoot = Join-Path $managerRoot 'app'
dotnet publish (Join-Path $RepositoryRoot 'windows-manager\src\UiEditorKit.Manager.Wpf\UiEditorKit.Manager.Wpf.csproj') -c Release -o $appRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$executable = Join-Path $appRoot 'UiEditorManager.exe'
$arguments = @('--app-starter-package-diagnostic', "--repository-root=$RepositoryRoot", "--bbm-root=$BbmRoot")
$process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $appRoot -PassThru
$process.WaitForExit()
$exitCode = $process.ExitCode
if ($exitCode -eq 0) {
  Get-ChildItem -LiteralPath $managerRoot -Directory | Where-Object Name -in @('backups','diagnostics') | ForEach-Object {
    if (-not (Get-ChildItem -LiteralPath $_.FullName -Force)) { Remove-Item -LiteralPath $_.FullName }
  }
}
exit $exitCode
