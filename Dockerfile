# Next.js 16 — production image for Invictus Pharma
FROM node:20-alpine AS builder

WORKDIR /app

ARG DJANGO_API_URL=http://backend:8000
ARG NEXT_PUBLIC_SITE_URL=https://invictuspharma.net
ARG NEXT_PUBLIC_SITE_NAME="Invictus Pharma"
ARG IMAGE_ORIGIN=https://greatlifepharma.com
ARG AUTH_SECRET

ENV DJANGO_API_URL=${DJANGO_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SITE_NAME=${NEXT_PUBLIC_SITE_NAME}
ENV IMAGE_ORIGIN=${IMAGE_ORIGIN}
ENV AUTH_SECRET=${AUTH_SECRET}

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
