param([int]$Port = 8091)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$demoDirectory = Join-Path $workspace '.tmp/intervals-backend-demo'
New-Item -ItemType Directory -Force -Path $demoDirectory | Out-Null
$database = (Join-Path $demoDirectory 'training_demo').Replace('\','/')
$privateFiles = (Join-Path $demoDirectory 'private').Replace('\','/')
$arguments = "--server.address=127.0.0.1 --server.port=$Port --spring.datasource.url=jdbc:h2:file:$database --spring.datasource.driver-class-name=org.h2.Driver --spring.datasource.username=sa --spring.datasource.password= --spring.jpa.hibernate.ddl-auto=update --app.training-workspace.enabled=true --app.training-workspace.migrate=true --app.training-workspace.cookie-secure=false --app.training-workspace.jobs-enabled=true --app.training-workspace.private-directory=$privateFiles --app.local-shared-runner.enabled=false --app.official-course.startup-seed.enabled=false --strava.sync.enabled=false --garmin.wellness.sync.enabled=false --app.coach.nightly.enabled=false --app.mail.provider=disabled"
Push-Location (Join-Path $workspace 'backend')
try {
    & .\mvnw.cmd spring-boot:run '-Dspring-boot.run.jvmArguments=-Dspring.devtools.restart.enabled=false' "-Dspring-boot.run.arguments=$arguments"
    if ($LASTEXITCODE -ne 0) { throw 'Demo server failed.' }
} finally { Pop-Location }
