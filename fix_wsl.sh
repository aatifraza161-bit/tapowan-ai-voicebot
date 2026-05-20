#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "Fixing Whisper.cpp..."
cd /opt
rm -rf whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make
bash ./models/download-ggml-model.sh small

echo "Fixing Piper TTS..."
cd /opt
rm -rf piper
mkdir -p piper
cd piper
wget -qO- https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz | tar -xvz --strip-components=1
mkdir -p voices
cd voices
wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

echo "Fixing Permissions and Restarting Asterisk..."
chmod +x /var/lib/asterisk/agi-bin/ai_receptionist.agi 2>/dev/null || true
chmod +x /usr/share/asterisk/agi-bin/ai_receptionist.agi 2>/dev/null || true
service asterisk restart || true

echo "Fixing DB Path for WSL in Node Backend..."
cd /opt/ai_receptionist
# Need to make sure the Windows path is translated to WSL path for the database!
sed -i 's|C:\\\\Users\\\\Admin\\\\Desktop\\\\My Project\\\\Slip & Receipt\\\\All fixed\\\\TapowanPublicSchool-fixed\\\\database.db|/mnt/c/Users/Admin/Desktop/My Project/Slip & Receipt/All fixed/TapowanPublicSchool-fixed/database.db|g' db.js

echo "WSL Fix Complete."
