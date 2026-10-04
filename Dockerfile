FROM node:20-slim

# LibreOffice (docx/pptx/xlsx -> pdf etc) + ffmpeg (audio/video conversion)
# + assimp (3D model conversion: stl/obj/ply/3ds/dae) + pst-utils (readpst,
# extracts .pst email archives to individual .eml files).
# This runs as root during the image build, so apt-get actually works here —
# unlike Render's native Node build, which has no root access and can't
# install system packages at all.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    ffmpeg \
    assimp-utils \
    pst-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "bot.js"]
