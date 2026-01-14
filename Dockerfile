FROM node:lts-trixie

WORKDIR /usr/src/app

ENV NODE_ENV=production

# copy package metadata and install production deps (falls back if no lockfile)
COPY package*.json ./
RUN npm ci --only=production --silent || npm install --production --silent

# copy app source
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
