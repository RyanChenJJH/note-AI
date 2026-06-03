@echo off
chcp 65001 >nul 2>&1
REM ===========================================================
REM  AI Dialog Archive - One-click start (Stage 6)
REM  - Build web/dist only if missing
REM  - Start backend in a separate window (kept open to show errors)
REM  - Probe /api/sources, then open default browser
REM ===========================================================

setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo [AIDA] 工作目录: %CD%
echo [AIDA] 检查前端构建产物 web\dist ...

if not exist "web\dist\index.html" (
  echo [AIDA] 未发现 web\dist，开始构建 ^(首次较慢，约 10-30 秒^) ...
  pushd web
  call npm run build
  if errorlevel 1 (
    echo.
    echo [AIDA] 前端构建失败。请确认 web\ 下已经 npm install。
    popd
    pause
    exit /b 1
  )
  popd
) else (
  echo [AIDA] 已存在 web\dist，跳过构建。
)

echo.
echo [AIDA] 启动后端 http://127.0.0.1:8787 ...
echo        ^(后端窗口标题: AIDA-API；保持打开以便看到日志^)

REM 用 /D 指定工作目录避免嵌套引号；/k 让窗口保留，npm 错误也能看见
start "AIDA-API" /D "%~dp0server" cmd /k "npm run serve"

echo [AIDA] 等待服务就绪（最多 20 秒）...
set /a tries=0
:waitloop
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8787/api/sources).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% GEQ 20 goto giveup
timeout /t 1 /nobreak >nul
goto waitloop

:ready
echo.
echo [AIDA] 服务已就绪，打开浏览器...
start "" http://127.0.0.1:8787
echo.
echo [AIDA] 启动完成。
echo        关闭工具: 关掉标题为 AIDA-API 的窗口。
echo        本窗口可以关闭，不影响服务运行。
echo.
pause
exit /b 0

:giveup
echo.
echo [AIDA] 等待服务超时（20 秒）。后端没起来。
echo        请切到标题为 AIDA-API 的窗口查看红色报错。
echo.
echo        常见原因：
echo          1) server\ 下没跑过 npm install
echo          2) Node 版本 ^< 24（命令行 node -v 验证；需要 v24.x.x 或更高）
echo          3) 端口 8787 被占用（netstat -ano ^| findstr 8787）
echo.
pause
exit /b 1
