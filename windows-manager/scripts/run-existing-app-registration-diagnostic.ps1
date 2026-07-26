param([string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path)
$managerRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'UI-Editor-kit\Manager'
$appRoot = Join-Path $managerRoot 'app'
$shortcut = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'UI-Editor Manager.lnk'
$shortcutExisted = Test-Path -LiteralPath $shortcut
dotnet publish (Join-Path $RepositoryRoot 'windows-manager\src\UiEditorKit.Manager.Wpf\UiEditorKit.Manager.Wpf.csproj') -c Release -o $appRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$executable = Join-Path $appRoot 'UiEditorManager.exe'
$process = Start-Process -FilePath $executable -ArgumentList @('--existing-app-registration-diagnostic', "--repository-root=$RepositoryRoot") -WorkingDirectory $appRoot -PassThru
$process.WaitForExit()
$exitCode = $process.ExitCode
if ($exitCode -eq 0) {
  Get-ChildItem -LiteralPath $managerRoot -Directory | Where-Object Name -in @('backups','diagnostics') | ForEach-Object { if (-not (Get-ChildItem -LiteralPath $_.FullName -Force)) { Remove-Item -LiteralPath $_.FullName } }
}
if (-not $shortcutExisted -and (Test-Path -LiteralPath $shortcut)) {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($shortcut)
  if ($link.Description -eq 'UI-Editor-kit M78 Manager') { Remove-Item -LiteralPath $shortcut }
}
exit $exitCode
