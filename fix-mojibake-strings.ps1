param(
  [Parameter(Mandatory=$true)]
  [string]$Path
)

if (!(Test-Path $Path)) {
  Write-Host "File not found: $Path" -ForegroundColor Red
  exit 1
}

# backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$Path.bak_mojibake_$stamp"
Copy-Item $Path $backup -Force

# read as UTF-8 (raw)
$src = Get-Content -LiteralPath $Path -Raw -Encoding UTF8

function Convert-Mojibake([string]$s) {
  # Популярный случай: UTF-8 байты были прочитаны как CP1251 и попали в строку.
  try {
    $bytes = [System.Text.Encoding]::GetEncoding(1251).GetBytes($s)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

    # эвристика: стало больше кириллицы и исчезли типичные "Р"/"С" пачки
    $cyrBefore = ([regex]::Matches($s, "[А-Яа-яЁё]")).Count
    $cyrAfter  = ([regex]::Matches($fixed, "[А-Яа-яЁё]")).Count

    $badBefore = ([regex]::Matches($s, "(Р.|С.|Ð.|Ñ.)")).Count
    $badAfter  = ([regex]::Matches($fixed, "(Р.|С.|Ð.|Ñ.)")).Count

    if ($cyrAfter -ge ($cyrBefore + 2) -and $badAfter -lt $badBefore) {
      return $fixed
    }

    return $s
  } catch {
    return $s
  }
}

# regex по строковым литералам: "..." | '...' | `...`
$pattern = '(?s)(`(?:\\`|[^`])*`)|("(?:(?:\\.)|[^"\\])*")|(\'(?:(?:\\.)|[^\'\\])*\')'

$changed = 0

$out = [regex]::Replace($src, $pattern, {
  param($m)

  $token = $m.Value
  if ($token.Length -lt 2) { return $token }

  $quote = $token.Substring(0,1)
  $inner = $token.Substring(1, $token.Length-2)

  # трогаем только если похоже на mojibake
  if ($inner -notmatch '(Р.|С.|Ð.|Ñ.)') { return $token }

  $fixedInner = Convert-Mojibake $inner
  if ($fixedInner -ne $inner) {
    $script:changed++
    return $quote + $fixedInner + $quote
  }

  return $token
})

# write back UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Path, $out, $utf8NoBom)

Write-Host "OK. Strings fixed: $changed"
Write-Host "Backup: $backup"
