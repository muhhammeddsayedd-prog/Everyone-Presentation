param()
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($taskRoot -ne 'D:\Everyone\Presentation\Everyone-Presentation-Studio') { throw 'Use the existing Studio checkout.' }
$taskFile = Join-Path $taskRoot '.env.job-service.local'
if (Test-Path -LiteralPath $taskFile) { throw 'Service configuration already exists. It was not replaced.' }
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$taskSystem = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$taskAcl = New-Object Security.AccessControl.FileSecurity
$taskAcl.SetOwner($taskIdentity)
$taskAcl.SetAccessRuleProtection($true, $false)
foreach ($taskSid in @($taskIdentity,$taskSystem)) {
  $taskRule = New-Object Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','Allow')
  $taskAcl.AddAccessRule($taskRule)
}
$taskEmpty = [IO.File]::Open($taskFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
$taskEmpty.Dispose()
Set-Acl -LiteralPath $taskFile -AclObject $taskAcl
$taskObserved = Get-Acl -LiteralPath $taskFile
if (-not $taskObserved.AreAccessRulesProtected -or $taskObserved.Owner -ne $taskIdentity.Translate([Security.Principal.NTAccount]).Value) { throw 'Private file ownership could not be verified.' }
$taskRules = @($taskObserved.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))
if ($taskRules.Count -ne 2 -or @($taskRules | Where-Object { $_.IdentityReference.Value -notin @($taskIdentity.Value,$taskSystem.Value) -or $_.AccessControlType -ne 'Allow' -or $_.IsInherited }).Count -ne 0) { throw 'Private file ACL could not be verified.' }
$taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $taskBearerBytes = New-Object byte[] 32
  $taskKeyBytes = New-Object byte[] 32
  $taskRandom.GetBytes($taskBearerBytes)
  $taskRandom.GetBytes($taskKeyBytes)
  $taskBearer = [Convert]::ToBase64String($taskBearerBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  $taskKey = ([BitConverter]::ToString($taskKeyBytes)).Replace('-','').ToLowerInvariant()
  $taskPayload = "EPS_JOB_SERVICE_BEARER=$taskBearer`nEPS_JOB_CLAIM_KEY_ID=job-claim-v1`nEPS_JOB_CLAIM_KEY_HEX=$taskKey`n"
  $taskBytes = (New-Object Text.UTF8Encoding($false)).GetBytes($taskPayload)
  $taskStream = [IO.File]::Open($taskFile,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $taskStream.Write($taskBytes,0,$taskBytes.Length);$taskStream.Flush($true) } finally { $taskStream.Dispose() }
  Write-Output '{"result":"created","owner_and_system_only":true,"credentials_printed":false}'
} finally { $taskRandom.Dispose();$taskBearer=$null;$taskKey=$null;$taskPayload=$null }
