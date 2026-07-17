$b = "d:\Aplikasi Antigravity\Aplikasi Klinik\klinik-accounting\src"
New-Item -ItemType Directory -Force -Path "$b\components\ui" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\components\layout" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\pages\accounting" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\pages\inventory" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\pages\billing" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\pages\reports" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\pages\tax" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\store" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\hooks" | Out-Null
New-Item -ItemType Directory -Force -Path "$b\data" | Out-Null
Write-Host "All directories created successfully"
