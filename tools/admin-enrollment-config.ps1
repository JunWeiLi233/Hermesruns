# Pure config transformation: parse assignments rather than matching secret
# values or removing arbitrary lines from the user's local configuration.
function Remove-AdminBootstrapAssignments([string]$Config) {
    $parseTokens = $null
    $parseErrors = $null
    $configAst = [Management.Automation.Language.Parser]::ParseInput($Config,
        [ref]$parseTokens, [ref]$parseErrors)
    if ($parseErrors.Count) {
        throw 'Local config has syntax errors. Remove its admin bootstrap settings manually.'
    }
    $assignments = $configAst.FindAll({ param($node)
        $node -is [Management.Automation.Language.AssignmentStatementAst] -and
        $node.Left -is [Management.Automation.Language.VariableExpressionAst] -and
        $node.Left.VariablePath.UserPath -in @('env:APP_BOOTSTRAP_ADMIN_EMAIL',
            'env:APP_BOOTSTRAP_ADMIN_PASSWORD', 'env:HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN')
    }, $true)
    foreach ($assignment in @($assignments | Sort-Object { $_.Extent.StartOffset } -Descending)) {
        $Config = $Config.Remove($assignment.Extent.StartOffset,
            $assignment.Extent.EndOffset - $assignment.Extent.StartOffset)
    }
    [Management.Automation.Language.Parser]::ParseInput($Config,
        [ref]$parseTokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count) {
        throw 'Could not safely edit local config. Remove its admin bootstrap settings manually.'
    }
    return $Config
}
