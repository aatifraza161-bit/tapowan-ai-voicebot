FROM node:20-bookworm

# Install build tools, ffmpeg, curl, wget, git
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    curl \
    wget \
    git \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Setup Whisper.cpp
WORKDIR /opt
RUN git clone https://github.com/ggerganov/whisper.cpp.git
WORKDIR /opt/whisper.cpp
# Checkout a stable tag to ensure the binary name is 'main'
RUN git checkout v1.5.4 
RUN make
# Download whisper model (ggml-base)
RUN bash ./models/download-ggml-model.sh base


# Setup Piper
WORKDIR /opt
RUN wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
RUN tar -xvzf piper_amd64.tar.gz
RUN rm piper_amd64.tar.gz
# Download Piper Voice (en_US-lessac-medium)
WORKDIR /opt/piper/voices
RUN wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
RUN wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

# Setup Node App
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 4000
CMD ["node", "server.js"]
