@echo off
REM 每周更新开奖数据：下载官方最新结果、追加新期、重建 app/data.js
cd /d "%~dp0"
python update_data.py
if %ERRORLEVEL% neq 0 (
  echo.
  echo [错误] 更新失败，请检查网络或 Python 环境。
  pause
)
