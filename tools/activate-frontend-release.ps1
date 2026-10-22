param([Parameter(Mandatory)][string]$CandidatePinPath,[Parameter(Mandatory)][string]$VerificationPath)
. (Join-Path $PSScriptRoot 'heatmap-release-common.ps1')
$pinPath=Join-Path $HeatmapWorkspace 'backend/reviewed-release.json'
$current=Get-Content $pinPath -Raw | ConvertFrom-Json
$next=Get-Content $CandidatePinPath -Raw | ConvertFrom-Json
$verified=Get-Content $VerificationPath -Raw | ConvertFrom-Json
if(-not$verified.passed -or -not$verified.frontendOnly -or $verified.jarSha256 -ne $next.jarSha256 -or $verified.previousJarSha256 -ne $current.jarSha256){throw 'This exact frontend-only candidate must be verified against the current release'}
if((Get-FileHash $next.jarPath).Hash -ne $next.jarSha256 -or (Get-FileHash $next.manifestPath).Hash -ne $next.manifestSha256){throw 'Verified candidate changed'}
& (Join-Path $PSScriptRoot 'assert-analysis-release.ps1') -JarPath $next.jarPath
$runtime=Assert-HeatmapRuntime $current
$directory=Split-Path -Parent $CandidatePinPath
$previous=Join-Path $directory 'before-activation-release.json'
Copy-Item -LiteralPath $pinPath -Destination $previous
$stopped=$false
try {
 $runtime=Assert-HeatmapRuntime $current
 Stop-Process -Id $runtime.pid
 $stopped=$true
 Wait-Process -Id $runtime.pid -Timeout 15 -ErrorAction SilentlyContinue
 Copy-Item -LiteralPath $CandidatePinPath -Destination $pinPath
 & (Join-Path $PSScriptRoot 'run-reviewed-release.ps1')
 if($LASTEXITCODE){throw 'Frontend release failed to start'}
 $live=Assert-HeatmapRuntime $next
 $result=@{status='activated';frontendOnly=$true;databaseMigrationPerformed=$false;jarSha256=$next.jarSha256;previousJarSha256=$current.jarSha256;pid=$live.pid;rollbackPin=$previous;atUtc=[DateTime]::UtcNow.ToString('o')}
 $result | ConvertTo-Json | Set-Content (Join-Path $directory 'activation.json')
 $result | ConvertTo-Json | Set-Content (Join-Path $HeatmapWorkspace 'replica/statshunters/validation/simple-heatmap-activation.json')
 $result | ConvertTo-Json
} catch {
 $_ | Out-String | Set-Content (Join-Path $directory 'activation-error.log')
 if($stopped){
  foreach($listener in @(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)){
   $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
   if($process.Name -ne 'java.exe' -or -not$process.CommandLine.Contains([string]$next.jarPath)){throw 'Port ownership changed; preserved release state needs review'}
   Stop-Process -Id $listener.OwningProcess
   Wait-Process -Id $listener.OwningProcess -Timeout 15 -ErrorAction SilentlyContinue
  }
  Copy-Item -LiteralPath $previous -Destination $pinPath
  & (Join-Path $PSScriptRoot 'run-reviewed-release.ps1')
  if($LASTEXITCODE){throw 'The previous release did not restart; inspect protected recovery logs'}
  throw 'Frontend activation failed; the previous release was restored. No migration or database restore was performed.'
 }
 throw
}
