param([Parameter(Mandatory)][string]$ProjectRoot,[Parameter(Mandatory)][string]$GuardFile)
$ErrorActionPreference='Stop'
try {
 Get-Command Get-NetTCPConnection,Get-CimInstance,Get-FileHash -ErrorAction Stop|Out-Null
 $root=[IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
 $marker=Join-Path $env:USERPROFILE '.hermes/runtime.json'
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq 8080|Select-Object -ExpandProperty OwningProcess -Unique)
 if(-not$listeners.Count){
  if(Test-Path $marker){Remove-Item -LiteralPath $marker -Force}
  if(Test-Path $GuardFile){Remove-Item -LiteralPath $GuardFile}
  exit 0
 }
 $record=$null;if(Test-Path $marker){$record=Get-Content -LiteralPath $marker -Raw|ConvertFrom-Json}
 foreach($listener in $listeners){
  $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener);$origin=$null
  if($process.Name -ne 'java.exe'){exit 4}
  if($record -and $record.pid -eq $listener -and $record.projectRoot){
   $verifiedJar=$record.jarPath -and $record.jarSha256 -and $process.CommandLine.Contains([string]$record.jarPath) -and (Get-FileHash -LiteralPath $record.jarPath).Hash -eq $record.jarSha256
   if($verifiedJar -or $process.CommandLine -match 'BackendApplication'){$origin=[IO.Path]::GetFullPath([string]$record.projectRoot).TrimEnd('\')}
  }
  if(-not$origin -and $process.CommandLine -match 'BackendApplication'){
   if($process.CommandLine -match '@(\S+\.argfile)'){
    $argumentFile=$Matches[1]
    if(Test-Path $argumentFile){
     $classpath=(Get-Content -LiteralPath $argumentFile -TotalCount 1).Trim().Trim([char]34).Replace('\\','\')
     if($classpath.Split(';')[0] -match '^(.+?)\\backend\\(?:target|build\\local-runtime)\\classes$'){$origin=$Matches[1]}
    }
   }
   if(-not$origin){foreach($piece in ($process.CommandLine -split '[ ;]')){if($piece.Trim().Trim([char]34) -match '^([A-Za-z]:\\.*?)\\backend\\(?:target|build\\local-runtime)\\classes'){$origin=$Matches[1];break}}}
  }
  if(-not$origin){exit 4}
  if($origin -ne $root){[IO.File]::WriteAllText($GuardFile,$origin,[Text.Encoding]::ASCII);exit 2}
 }
 if(Test-Path $GuardFile){Remove-Item -LiteralPath $GuardFile}
 exit 0
}catch{Write-Output ('[Hermes] Port ownership check failed: ' + $_.Exception.Message);exit 5}
