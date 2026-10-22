param(
 [string]$EvidenceDirectory='.private-backups/heat-layer-coverage-qa-20261019',
 [string]$OutputRelativePath='replica/statshunters/validation/heat-layer-coverage-existing-history.json'
)
. (Join-Path $PSScriptRoot 'heatmap-release-common.ps1')
$proof=[IO.Path]::GetFullPath((Join-Path $HeatmapWorkspace $EvidenceDirectory))
$output=[IO.Path]::GetFullPath((Join-Path $HeatmapWorkspace $OutputRelativePath))
if(-not $proof.StartsWith((Join-Path $HeatmapWorkspace '.private-backups')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'History evidence must remain in workspace private backups'}
if(-not $output.StartsWith((Join-Path $HeatmapWorkspace 'replica/statshunters/validation')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'History report must remain in workspace validation'}
$baseline=Join-Path $proof 'before.tsv'
$rows=@{};foreach($line in Get-Content -LiteralPath $baseline){if($line){$parts=$line.Split('|');$rows[$parts[0]]=$parts}}
$queries=@('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;')
$tables=@($rows.Keys | Where-Object {$_ -notlike 'sequence:*' -and $_ -match 'activity|record|route|shoe'} | Sort-Object)
foreach($name in $tables){
 if($name -notmatch '^([a-z_]+)\.([a-z_]+)$'){throw 'Unexpected table identifier'}
 $schema=$Matches[1];$table=$Matches[2];$where='';$newRows='0'
 $sequence=$rows['sequence:'+$schema+'.'+$table+'_id_seq']
 if($sequence -and $sequence[1] -match '^\d+$'){$cutoff=[long]$sequence[1];$where=' WHERE id<='+$cutoff;$newRows='(SELECT count(*) FROM '+$name+' WHERE id>'+$cutoff+')'}
 $queries+="SELECT '$name',count(*),md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')),$newRows FROM $name t$where;"
}
$queries+='COMMIT;'
$sql=Join-Path $proof 'existing-history.sql';[IO.File]::WriteAllText($sql,($queries -join [Environment]::NewLine),[Text.UTF8Encoding]::new($false))
$pin=Get-Content (Join-Path $HeatmapWorkspace 'backend/reviewed-release.json') -Raw | ConvertFrom-Json
$connection=Get-HeatmapLiveConnection $pin;$oldPassword=$env:PGPASSWORD
try {
 $env:PGPASSWORD=$env:APP_DB_PASSWORD
 $result=& (Join-Path $HeatmapPgBin 'psql.exe') @connection -X -q -t -A -v ON_ERROR_STOP=1 -f $sql 2> (Join-Path $proof 'existing-history.error.log')
 if($LASTEXITCODE){throw 'Read-only existing-history comparison failed; inspect protected logs'}
} finally {$env:PGPASSWORD=$oldPassword}
$checks=@();foreach($line in $result){if(-not$line){continue};$value=$line.Split('|');$expected=$rows[$value[0]]
 if($expected[1] -ne $value[1] -or $expected[2] -ne $value[2]){throw ('Existing rows changed in '+$value[0])}
 $checks+=@{table=$value[0];existingRows=[long]$value[1];unchanged=$true;additionalRows=[long]$value[3]}
}
if($checks.Count -ne $tables.Count){throw 'Existing-history comparison was incomplete'}
$report=@{passed=$true;readOnly=$true;atUtc=[DateTime]::UtcNow.ToString('o');baselineSha256=(Get-FileHash $baseline).Hash;historyEntries=$checks.Count;allExistingRowsUnchanged=$true;tables=$checks;policy='Compare original rows using baseline sequence cutoffs; preserve additional synced rows. No database writes.'}
$report | ConvertTo-Json -Depth 8 | Set-Content $output
Write-Output ('All existing rows preserved in '+$checks.Count+' history tables; additional synced rows retained.')
