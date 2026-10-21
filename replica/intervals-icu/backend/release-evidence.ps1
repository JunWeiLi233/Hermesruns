# Shared release identity/artifact checks. Contains no credentials or account rows.
function Get-ReleaseArtifacts([string]$Workspace) {
 $files=@('backend/target/backend-0.0.1-SNAPSHOT.jar')+@(Get-ChildItem (Join-Path $Workspace 'backend/src/main/resources/db/training/V*.sql')|Sort-Object Name|ForEach-Object {'backend/src/main/resources/db/training/'+$_.Name})+@(Get-ChildItem (Join-Path $Workspace 'replica/intervals-icu/backend') -File|Where-Object {$_.Extension -in @('.ps1','.sql')}|Sort-Object Name|ForEach-Object {'replica/intervals-icu/backend/'+$_.Name})
 $result=@{};foreach($file in $files){$result[$file]=(Get-FileHash -LiteralPath (Join-Path $Workspace $file) -Algorithm SHA256).Hash};return $result
}
function Assert-ReleaseArtifacts([string]$Workspace,$Expected) {
 $current=Get-ReleaseArtifacts $Workspace
 if(-not$Expected -or $current.Count -ne $Expected.Count){throw 'Release artifact inventory changed; repeat backup/rehearsal.'}
 foreach($file in $current.Keys){if($current[$file] -ne $Expected[$file]){throw "Release artifact changed: $file. Repeat backup/rehearsal."}}
}
function Get-ReleaseTarget([string]$PgBin) {
 $value=& (Join-Path $PgBin 'psql.exe') -X -t -A -v ON_ERROR_STOP=1 -c "select json_build_object('database',current_database(),'databaseOid',(select oid from pg_database where datname=current_database()),'serverAddress',inet_server_addr(),'serverPort',inet_server_port(),'serverStarted',pg_postmaster_start_time(),'role',current_user)" 2>$null
 if($LASTEXITCODE -ne 0){throw 'Cannot verify configured PostgreSQL identity.'}
 $result=($value -join "`n")|ConvertFrom-Json -AsHashtable
 $result.host=$env:PGHOST;$result.port=$env:PGPORT;return $result
}
function Assert-ReleaseTarget([string]$PgBin,$Expected) {
 if(-not$Expected){throw 'Backup has no bound PostgreSQL identity; take a new backup.'}
 $current=Get-ReleaseTarget $PgBin
 foreach($key in $Expected.Keys){if([string]$current[$key] -ne [string]$Expected[$key]){throw "Configured PostgreSQL identity changed ($key); release stopped."}}
}
