# Next.js 16 — production image for Invictus Pharma
# Pin alpine 3.20: Prisma 5.x needs OpenSSL where Alpine 3.21 moved libssl.
FROM node:20-alpine3.20 AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ARG DJANGO_API_URL=http://backend:8000
ARG NEXT_PUBLIC_SITE_URL=https://invictuspharma.net
ARG NEXT_PUBLIC_SITE_NAME="Invictus Pharma"
ARG IMAGE_ORIGIN=https://greatlifepharma.com
ARG AUTH_SECRET
# Prisma schema still references DATABASE_URL; app data lives in Django/MySQL.
ARG DATABASE_URL=file:./prisma/build.db

ENV DJANGO_API_URL=${DJANGO_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SITE_NAME=${NEXT_PUBLIC_SITE_NAME}
ENV IMAGE_ORIGIN=${IMAGE_ORIGIN}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Webpack is more reliable than Turbopack inside slim Alpine CI/CD images.
RUN npx prisma generate && npx next build --webpack

FROM node:20-alpine3.20 AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
