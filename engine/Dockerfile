# BCO engine — Nhost Run container.
# Contains Node (Express API) + Python GrantKit CLI + Playwright Chromium (PDFs).
#
# Build & push (then register in Nhost → Run with the image URL):
#   docker build -t ghcr.io/<you>/bco-engine:latest ./engine
#   docker push ghcr.io/<you>/bco-engine:latest
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# GrantKit Python CLI + PDF system libraries (WeasyPrint: pango+cairo).
# Installed in a virtualenv so the system pip stays clean on Alpine.
RUN apk add --no-cache python3 py3-pip pango cairo gdk-pixbuf libffi openssl \
    && python3 -m venv /opt/grantkit-venv \
    && /opt/grantkit-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/grantkit-venv/bin/pip install --no-cache-dir 'grantkit[all]' \
    && ln -s /opt/grantkit-venv/bin/grantkit /usr/local/bin/grantkit \
    && ln -s /opt/grantkit-venv/bin/python /usr/local/bin/grantkit-python

ENV GRANTKIT_PYTHON=/usr/local/bin/grantkit-python

# Playwright Chromium (used as the PDF fallback for GrantKit and for CV PDFs).
RUN npx playwright install --with-deps chromium

EXPOSE 3000

CMD ["node", "index.js"]
