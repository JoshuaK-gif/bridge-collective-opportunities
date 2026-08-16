FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Bundle and minify all server code into a single file — removes all comments,
# minifies variable names, and reduces image size
# NPM packages are kept external (resolved from node_modules at runtime),
# only the app's own source files are bundled.
RUN npx --yes esbuild index.js --bundle --platform=node --format=esm --outfile=bundle.js --minify $(node -e "Object.keys(require('./package.json').dependencies).forEach(d => console.log('--external:' + d))") 2>&1

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

# Only copy the production bundle and bare essentials
COPY --from=builder /build/bundle.js ./index.js
COPY --from=builder /build/node_modules ./node_modules

# GrantKit engine (Python CLI) — powers the BCO Grant Assistant funder check & build tool.
# Installed in a virtualenv so the system pip stays clean on Alpine.
RUN apk add --no-cache python3 py3-pip pango cairo gdk-pixbuf libffi openssl \
    && python3 -m venv /opt/grantkit-venv \
    && /opt/grantkit-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/grantkit-venv/bin/pip install --no-cache-dir 'grantkit[all]' \
    && ln -s /opt/grantkit-venv/bin/grantkit /usr/local/bin/grantkit \
    && ln -s /opt/grantkit-venv/bin/python /usr/local/bin/grantkit-python

ENV GRANTKIT_PYTHON=/usr/local/bin/grantkit-python

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "index.js"]
