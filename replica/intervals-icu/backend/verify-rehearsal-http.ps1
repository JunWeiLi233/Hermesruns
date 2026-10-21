param([Parameter(Mandatory)][string]$RunDirectory)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not$run.StartsWith((Join-Path $workspace '.private-backups')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Use the private release directory.'}
. (Join-Path $PSScriptRoot 'release-evidence.ps1')
$manifest=Get-Content (Join-Path $run 'manifest.json') -Raw|ConvertFrom-Json -AsHashtable
Assert-ReleaseArtifacts $workspace $manifest.artifacts
$app=Get-Content (Join-Path $run 'Rehearsal.process.json') -Raw|ConvertFrom-Json -AsHashtable
if(-not$app.healthy -or $app.port -ne 18081 -or $manifest.rehearsalPort -ne 55432){throw 'Verified isolated rehearsal server required.'}
$env:PGHOST='127.0.0.1';$env:PGPORT=[string]$manifest.rehearsalPort;$env:PGDATABASE='hermes';$env:PGUSER='hermes_release_check'
$secret=Import-Clixml (Join-Path $run 'rehearsal-password.clixml');$env:PGPASSWORD=[Net.NetworkCredential]::new('',$secret).Password
function StageSql([string]$Query){
 & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -X -t -A -v ON_ERROR_STOP=1 -c $Query 2>(Join-Path $run 'http-fixture-sql.error.log')|Out-Null
 if($LASTEXITCODE -ne 0){throw 'Stage fixture setup failed; see private log.'}
}
$base='http://127.0.0.1:18081/api/training'
function Call([string]$Token,[string]$Method,[string]$Path,[hashtable]$Body,[int]$Expected=200){
 $headers=@{Authorization='Bearer '+$Token;'Idempotency-Key'=[Guid]::NewGuid().ToString()}
 $args=@{Uri=$base+$Path;Method=$Method;Headers=$headers;SkipHttpErrorCheck=$true}
 if($Body){$args.ContentType='application/json';$args.Body=$Body|ConvertTo-Json -Depth 15 -Compress}
 $response=Invoke-WebRequest @args
 if([int]$response.StatusCode -ne $Expected){throw "Stage request $Method $Path expected $Expected; got $($response.StatusCode): $($response.Content)"}
 if($response.Content){return $response.Content|ConvertFrom-Json -AsHashtable}
}
$tokens=@([Guid]::NewGuid().ToString(),[Guid]::NewGuid().ToString())
foreach($i in 0..1){
 $hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($tokens[$i]))).ToLowerInvariant()
 $email='release-'+[Guid]::NewGuid().ToString()+'@example.test'
 StageSql "insert into runner(email,display_name,deleted,role,status,session_token,token_issued_at) values('$email','Release fixture',false,'USER','ACTIVE','$hash',localtimestamp)" | Out-Null
}
$owner=Call $tokens[0] GET '/me';$coach=Call $tokens[1] GET '/me'
$aid=$owner.id;$cid=$coach.id
if(-not$aid -or -not$cid){throw 'Missing stage fixture identity'}
$manual=Call $tokens[0] POST "/athletes/$aid/activities/manual" @{title='Release verification';date='2026-10-15';minutes=20;sport='Running';rpe=3}
Call $tokens[1] GET "/athletes/$aid/calendar" $null 404|Out-Null
$request=Call $tokens[1] POST "/athletes/$aid/access-requests" @{level='coach';wellness=@()}
Call $tokens[0] POST "/access-relationships/$($request.id)/decision" @{decision='accepted'} |Out-Null
$event=Call $tokens[1] POST "/athletes/$aid/events" @{title='Coached release workout';date='2026-10-15';minutes=20;sport='Running'}
$calendar=Call $tokens[0] GET "/athletes/$aid/calendar"
if(@($calendar.events).Count -ne 1){throw 'Coached workout not persisted in canonical calendar'}
$team=Call $tokens[1] POST '/teams' @{name='Release verification team'}
Call $tokens[0] POST "/teams/$($team.id)/join-requests" @{} |Out-Null
Call $tokens[1] PATCH "/teams/$($team.id)/members/$aid" @{role='member'} |Out-Null
Call $tokens[0] PUT "/teams/$($team.id)/consent" @{decision='granted';scopeRevision=1;level='coach';wellness=@()} |Out-Null
$teams=Call $tokens[0] GET '/teams'
if(@($teams.items).Count -ne 1){throw 'Team membership missing'}
Call $tokens[0] POST '/me/access/revoke-all' @{}|Out-Null
Call $tokens[1] GET "/athletes/$aid/calendar" $null 404|Out-Null
$result=@{server='packaged Hermes on PostgreSQL 17 restored copy';schemaValidation='validate';jarSha256=$app.jarSha256;verifiedUtc=[DateTime]::UtcNow.ToString('o');checks=@('canonical athlete activity write','unrelated user denied','coach request and acceptance','coach-authored canonical workout','team creation','join and admission','team consent','access revocation blocks coach');realDatabaseTouched=$false}
$result|ConvertTo-Json -Depth 6|Set-Content "$run/rehearsal-http-verification.json"
$result|ConvertTo-Json -Depth 6
