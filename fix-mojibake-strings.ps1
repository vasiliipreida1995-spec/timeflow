param(
  [Parameter(Mandatory=$true)]
  [string]$Path
)

if (!(Test-Path $Path)) {
  Write-Host "File not found: $Path" -ForegroundColor Red
  exit 1
}

$stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$Path.bak_moj_$stamp"
Copy-Item $Path $backup -Force

# читаем как UTF-8 (как лежит в репе)
$src = Get-Content -LiteralPath $Path -Raw -Encoding UTF8

function Score([string]$s) {
  $cyr = ([regex]::Matches($s, "[А-Яа-яЁё]")).Count
  $bad = ([regex]::Matches($s, "(Р.|С.|Ð.|Ñ.)")).Count
  $nonAscii = 0
  foreach ($ch in $s.ToCharArray()) {
    if ([int]$ch -gt 127) { $nonAscii++ }
  }
  # больше кириллицы и юникода, меньше "Р…/С…/Ð…/Ñ…"
  return ($cyr * 6) + $nonAscii - ($bad * 10)
}

function TryConvert([string]$s, [int]$codepage) {
  try {
    $bytes = [System.Text.Encoding]::GetEncoding($codepage).GetBytes($s)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

    # если появились "�" — значит декод неудачный
    if ($fixed.Contains([char]0xFFFD)) { return $null }
    return $fixed
  } catch {
    return $null
  }
}

function FixChunk([string]$chunk) {
  # пробуем самые частые варианты
  $best = $chunk
  $bestScore = Score $chunk

  foreach ($cp in @(1251, 1252, 28591)) { # 1251=cp1251, 1252=cp1252, 28591=latin1
    $cand = TryConvert $chunk $cp
    if ($null -eq $cand) { continue }
    $sc = Score $cand
    if ($sc -gt $bestScore) {
      $best = $cand
      $bestScore = $sc
    }
  }

  return $best
}

# Матчим "подозрительные" подрядки с типичными маркерами mojibake:
# Р?, С?, Ð?, Ñ? (минимум 6 символов, чтобы не цеплять случайное)
$pattern = "(?:Р.|С.|Ð.|Ñ.){3,}"

$changed = 0
$out = [regex]::Replace($src, $pattern, {
  param($m)
  $orig = $m.Value
  $fixed = FixChunk $orig
  if ($fixed -ne $orig) { $script:changed++ }
  return $fixed
})

# Записываем UTF-8 без BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Path, $out, $utf8NoBom)

Write-Host "OK: fixed $changed chunk(s)."
Write-Host "Backup: $backup"
