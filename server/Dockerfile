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

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "index.js"]
