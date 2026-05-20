@echo off
title Setting up Phone Access for AI Receptionist
color 0E

echo ========================================================
echo   SETTING UP ANDROID PHONE ACCESS TO AI RECEPTIONIST
echo ========================================================
echo.

:: Get WSL IP
for /f "tokens=*" %%i in ('wsl -d Ubuntu hostname -I') do set WSLIP=%%i
set WSLIP=%WSLIP: =%
echo WSL IP detected: %WSLIP%

echo.
echo [1] Setting up Port Forwarding (SIP 5060)...
netsh interface portproxy delete v4tov4 listenport=5060 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy add v4tov4 listenport=5060 listenaddress=0.0.0.0 connectport=5060 connectaddress=%WSLIP%
echo     Done.

echo [2] Setting up Port Forwarding (SIP TCP 5060)...
netsh interface portproxy delete v4tov4 listenport=5060 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy add v4tov4 listenport=5060 listenaddress=0.0.0.0 connectport=5060 connectaddress=%WSLIP%
echo     Done.

echo [3] Adding Firewall Rules...
netsh advfirewall firewall delete rule name="AI_SIP_UDP" >nul 2>&1
netsh advfirewall firewall add rule name="AI_SIP_UDP" dir=in action=allow protocol=UDP localport=5060
netsh advfirewall firewall delete rule name="AI_SIP_TCP" >nul 2>&1
netsh advfirewall firewall add rule name="AI_SIP_TCP" dir=in action=allow protocol=TCP localport=5060
netsh advfirewall firewall delete rule name="AI_RTP" >nul 2>&1
netsh advfirewall firewall add rule name="AI_RTP" dir=in action=allow protocol=UDP localport=10000-20000
echo     Done.

echo.
echo ========================================================
echo   SUCCESS! Phone access is now enabled.
echo   Use this in Linphone: 192.168.1.13
echo ========================================================
echo.
pause
