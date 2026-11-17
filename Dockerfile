FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server.js ./
COPY public ./public
EXPOSE 4317
ENV PORT=4317
CMD ["node", "server.js"]
