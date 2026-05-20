#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "Updating apt..."
apt-get update -y

echo "Installing Asterisk, Node.js, and dependencies..."
apt-get install -y asterisk curl wget git build-essential ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Setting up Whisper.cpp..."
mkdir -p /opt/whisper.cpp
cd /opt
if [ ! -d "whisper.cpp" ]; then
    git clone https://github.com/ggerganov/whisper.cpp.git
fi
cd whisper.cpp
make
bash ./models/download-ggml-model.sh small.en

echo "Setting up Piper TTS..."
mkdir -p /opt/piper
cd /opt/piper
if [ ! -f "piper" ]; then
    wget -qO- https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz | tar -xvz --strip-components=1
    mkdir -p voices
    cd voices
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
fi

echo "Copying Node backend into WSL..."
mkdir -p /opt/ai_receptionist
# The backend folder is on Windows Desktop. In WSL, C: drive is mounted at /mnt/c
cp -r /mnt/c/Users/Admin/Desktop/Antigravity/Tapowan_AI_Receptionist/backend/* /opt/ai_receptionist/
cd /opt/ai_receptionist
npm install

echo "Configuring Asterisk AGI..."
cp /opt/ai_receptionist/ai_receptionist.agi /usr/share/asterisk/agi-bin/ || cp /opt/ai_receptionist/ai_receptionist.agi /var/lib/asterisk/agi-bin/
chmod +x /usr/share/asterisk/agi-bin/ai_receptionist.agi 2>/dev/null || chmod +x /var/lib/asterisk/agi-bin/ai_receptionist.agi 2>/dev/null

cat << 'EOF' > /etc/asterisk/extensions.conf
[general]
static=yes
writeprotect=no
clearglobalvars=no

[default]
exten => 7777,1,Answer()
exten => 7777,2,AGI(ai_receptionist.agi)
exten => 7777,3,Hangup()
EOF

cat << 'EOF' > /etc/asterisk/pjsip.conf
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

[100]
type=endpoint
context=default
disallow=all
allow=ulaw
auth=100
aors=100

[100]
type=auth
auth_type=userpass
password=secret
username=100

[100]
type=aor
max_contacts=1
EOF

service asterisk restart || true
echo "WSL Setup Complete."
