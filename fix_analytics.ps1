$files = Get-ChildItem -Path "client\src\components\analytics\*.css"
$files += Get-Item -Path "client\src\pages\LeadAnalyticsDashboard.module.css"

foreach ($f in $files) {
    (Get-Content $f.FullName) -replace 'var\(--bg\)', 'var(--color-surface)' -replace 'var\(--border\)', 'var(--color-border)' -replace 'var\(--text\)', 'var(--color-text-secondary)' -replace 'var\(--text-h\)', 'var(--color-text)' | Set-Content $f.FullName
}
