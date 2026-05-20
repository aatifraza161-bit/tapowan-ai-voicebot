# Setup Port Forwarding for AI Receptionist (WSL to Android)
$wslIp = "172.19.220.122"

echo "Setting up Port Forwarding for SIP (5060) and RTP (10000-10100)..."

# 1. Forward SIP Port
netsh interface portproxy add v4tov4 listenport=5060 listenaddress=0.0.0.0 connectport=5060 connectaddress=$wslIp

# 2. Add Firewall Rules
New-NetFirewallRule -DisplayName "AI Receptionist SIP" -Direction Inbound -Protocol UDP -LocalPort 5060 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "AI Receptionist SIP TCP" -Direction Inbound -Protocol TCP -LocalPort 5060 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "AI Receptionist RTP" -Direction Inbound -Protocol UDP -LocalPort 10000-20000 -Action Allow -ErrorAction SilentlyContinue

echo "DONE! You can now use 192.168.1.13 in your Android app."
