param(
    [ValidateSet("Archive","Restore","Status")]
    [string]$Mode = "Status"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

$surfaces = @(
    @{
        Label = "home"
        SkillsRoot = Join-Path $env:USERPROFILE ".codex\skills"
        ArchiveRoot = Join-Path $env:USERPROFILE ".codex\skills-disabled"
        OptionalSkills = @(
            "book-study",
            "code-review-expert",
            "repomix-explorer",
            "sigma",
            "skill-forge",
            "wiki-ingest"
        )
    },
    @{
        Label = "repo"
        SkillsRoot = Join-Path $repoRoot ".codex\skills"
        ArchiveRoot = Join-Path $repoRoot ".codex\skills-disabled"
        OptionalSkills = @(
            "architecture-diagram-generator",
            "ask-claude",
            "ask-gemini",
            "autopilot",
            "configure-notifications",
            "doctor",
            "help",
            "hud",
            "note",
            "omx-setup",
            "security-review",
            "skill",
            "ui-ux-pro-max"
        )
    }
)

function Ensure-Directory {
    param([string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Move-SkillDirectory {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return $false
    }

    Ensure-Directory (Split-Path -Parent $Destination)
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    Move-Item -LiteralPath $Source -Destination $Destination
    return $true
}

foreach ($surface in $surfaces) {
    Ensure-Directory $surface.SkillsRoot
    Ensure-Directory $surface.ArchiveRoot

    Write-Host "[$($surface.Label)]"

    foreach ($skill in $surface.OptionalSkills) {
        $livePath = Join-Path $surface.SkillsRoot $skill
        $archivedPath = Join-Path $surface.ArchiveRoot $skill

        switch ($Mode) {
            "Archive" {
                if (Move-SkillDirectory -Source $livePath -Destination $archivedPath) {
                    Write-Host " archived $skill"
                } elseif (Test-Path -LiteralPath $archivedPath) {
                    Write-Host " archived $skill (already)"
                } else {
                    Write-Host " skipped  $skill (missing)"
                }
            }
            "Restore" {
                if (Move-SkillDirectory -Source $archivedPath -Destination $livePath) {
                    Write-Host " restored $skill"
                } elseif (Test-Path -LiteralPath $livePath) {
                    Write-Host " restored $skill (already)"
                } else {
                    Write-Host " skipped  $skill (missing)"
                }
            }
            "Status" {
                $state =
                    if (Test-Path -LiteralPath $livePath) { "live" }
                    elseif (Test-Path -LiteralPath $archivedPath) { "archived" }
                    else { "missing" }
                Write-Host (" {0,-32} {1}" -f $skill, $state)
            }
        }
    }

    Write-Host ""
}
