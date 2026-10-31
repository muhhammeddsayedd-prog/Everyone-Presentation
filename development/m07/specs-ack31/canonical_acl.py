"""Pure Owner/SYSTEM DACL projection and fixed PowerShell program builder."""
import re


def need(value):
    if not value:raise ValueError('ACK31_PRIVATE_ACL_UNCONFIRMED')


def validate(value):
    need(type(value)is dict and set(value)=={'current_sid','owner_sid','protected','rules'})
    sid=value['current_sid'];need(type(sid)is str and len(sid)<=256 and re.fullmatch(r'S-1-[0-9]+(?:-[0-9]+)+',sid))
    need(value['owner_sid']==sid and value['protected']is True)
    allowed={sid,'S-1-5-18'};need(len(allowed)==2 and type(value['rules'])is list and len(value['rules'])==2)
    seen=set()
    for rule in value['rules']:
        need(type(rule)is dict and set(rule)=={'sid','rights','inheritance_flags','propagation_flags','inherited','type'})
        need(type(rule['sid'])is str and rule['sid']in allowed and rule['sid']not in seen);seen.add(rule['sid'])
        need(all(type(rule[key])is int for key in('rights','inheritance_flags','propagation_flags','type')))
        need(rule['rights']==0x1f01ff and rule['inheritance_flags']==3 and rule['propagation_flags']==0 and rule['inherited']is False and rule['type']==0)
    need(seen==allowed)


def program(created):
    need(type(created)is bool)
    setup="""
$a=New-Object System.Security.AccessControl.DirectorySecurity;
$a.SetAccessRuleProtection($true,$false);
foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){
 $r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)
};Set-Acl -LiteralPath $p -AclObject $a;
"""if created else''
    return """$ErrorActionPreference='Stop';$p=$env:EPS_ACK31_RELEASE_PRIVATE;
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
"""+setup+"""
$v=Get-Acl -LiteralPath $p;
$rules=@($v.Access|ForEach-Object{@{sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;rights=[int]$_.FileSystemRights;inheritance_flags=[int]$_.InheritanceFlags;propagation_flags=[int]$_.PropagationFlags;inherited=[bool]$_.IsInherited;type=[int]$_.AccessControlType}});
@{current_sid=$sid.Value;owner_sid=$v.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;protected=[bool]$v.AreAccessRulesProtected;rules=$rules}|ConvertTo-Json -Depth 4 -Compress;
"""
