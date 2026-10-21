param([ValidateSet('Seed','PrepareCleanup','VerifyCleanup')][string]$Phase='Seed',[Parameter(Mandatory)][string]$RunDirectory)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not$run.StartsWith((Join-Path $workspace '.private-backups')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'QA credentials require the private backup root.'}
$runtime=Get-Content C:/Users/Junwei/.hermes/runtime.json -Raw|ConvertFrom-Json
if($runtime.projectRoot -ne $workspace -or (Get-NetTCPConnection -State Listen -LocalPort 8080).OwningProcess -ne $runtime.pid){throw 'Verify the real Hermes runtime before QA provisioning.'}
. (Join-Path $workspace 'Hermes.local.env.ps1') *> $null
$uri=[Uri]($env:APP_DB_URL -replace '^jdbc:','')
if(-not$uri.IsLoopback -or $uri.Scheme -ne 'postgresql'){throw 'This fixture only supports configured local PostgreSQL.'}
$env:PGHOST=$uri.DnsSafeHost;$env:PGPORT=if($uri.Port -gt 0){[string]$uri.Port}else{'5432'}
$env:PGDATABASE=$uri.AbsolutePath.Trim('/');$env:PGUSER=$env:APP_DB_USERNAME;$env:PGPASSWORD=$env:APP_DB_PASSWORD
$pg='C:/Program Files/PostgreSQL/17/bin/psql.exe'
function Sql([string]$Query){
 $result=& $pg -X -t -A -v ON_ERROR_STOP=1 -c $Query 2>(Join-Path $run 'database-check.error.log')
 if($LASTEXITCODE -ne 0){throw 'QA database operation failed; see private log.'}
 return ($result -join "`n").Trim()
}
if($Phase -eq 'Seed'){
 if(Test-Path (Join-Path $run 'actors.json')){throw 'Fixture identity file already exists.'}
 New-Item -ItemType Directory -Force -Path $run|Out-Null
 $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 Set-Acl -LiteralPath $run -AclObject $acl
 $baseline=Sql "select json_build_object('runnerIds',(select json_agg(id order by id) from runner),'activityIds',(select json_agg(id order by id) from activities),'database',current_database(),'port',inet_server_port())"
 $baseline|Set-Content (Join-Path $run 'baseline.json')
 $tag=[Guid]::NewGuid().ToString('N');$actors=@{}
 foreach($role in @('athlete','coach','follower','outsider','member')){
  $token=[Guid]::NewGuid().ToString();$hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
  $email="qa-training-$tag-$role@example.test";$name="QA $role $($tag.Substring(0,6))"
  $id=Sql "insert into runner(email,display_name,deleted,role,status,session_token,token_issued_at,time_zone,max_heart_rate_bpm) values('$email','$name',false,'USER','ACTIVE','$hash',localtimestamp,'America/New_York',180) returning id"
  $actors[$role]=@{runnerId=[long]($id -split "`n")[0];email=$email;name=$name;token=$token}
 }
 @{baseURL='http://localhost:8080';tag=$tag;actors=$actors;runtimePid=$runtime.pid;createdUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Set-Content (Join-Path $run 'actors.json')
 'Five synthetic QA accounts created; private session material saved under the protected run directory.'
}else{
 $fixture=Get-Content (Join-Path $run 'actors.json') -Raw|ConvertFrom-Json -AsHashtable
 $baseline=Get-Content (Join-Path $run 'baseline.json') -Raw|ConvertFrom-Json -AsHashtable
 $ids=@($fixture.actors.Values.runnerId)-join ','
 if($Phase -eq 'PrepareCleanup'){
  if(@($fixture.actors.Values.runnerId|Where-Object {$_ -in $baseline.runnerIds}).Count){throw 'QA identities overlap the original runner baseline.'}
  $owned=Sql "select json_build_object('activityIds',(select coalesce(json_agg(id),'[]'::json) from activities where runner_id in ($ids)))"
  $owned|Set-Content (Join-Path $run 'qa-cleanup-baseline.json')
  'Synthetic activity IDs captured privately for deletion verification.'
  return
 }
 $owned=Get-Content (Join-Path $run 'qa-cleanup-baseline.json') -Raw|ConvertFrom-Json -AsHashtable
 $remaining=[int](Sql "select count(*) from runner where id in ($ids)")
 $remainingProfiles=[int](Sql "select count(*) from tw_profile where runner_id in ($ids)")
 $ownedIds=$owned.activityIds -join ','
 $remainingQaActivities=if($ownedIds){[int](Sql "select count(*) from activities where id in ($ownedIds)")}else{0}
 $oldRunnerIds=$baseline.runnerIds -join ',';$oldActivityIds=$baseline.activityIds -join ','
 $missingRunners=[int](Sql "select count(*) from unnest(array[$oldRunnerIds]::bigint[]) b(id) where not exists(select 1 from runner r where r.id=b.id)")
 $missingActivities=[int](Sql "select count(*) from unnest(array[$oldActivityIds]::bigint[]) b(id) where not exists(select 1 from activities a where a.id=b.id)")
 $result=@{qaAccountsRemaining=$remaining;qaProfilesRemaining=$remainingProfiles;qaActivitiesRemaining=$remainingQaActivities;syntheticActivitiesDeleted=@($owned.activityIds).Count;existingRunnersMissing=$missingRunners;existingActivitiesMissing=$missingActivities;pass=($remaining -eq 0 -and $remainingProfiles -eq 0 -and $remainingQaActivities -eq 0 -and $missingRunners -eq 0 -and $missingActivities -eq 0)}
 $result|ConvertTo-Json|Set-Content (Join-Path $run 'cleanup-verification.json');$result|ConvertTo-Json
 if(-not$result.pass){throw 'QA cleanup/preservation verification failed.'}
}
