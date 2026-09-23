FROM node:20-alpine
WORKDIR /app
COPY package.json server.mjs catalog.mjs ./
COPY public ./public
COPY data/voice_catalog.json ./data/voice_catalog.json
RUN mkdir -p data/uploads data/outputs && printf '[]\n' > data/tasks.json
ENV PORT=8788 HOST=0.0.0.0 LOCAL_STUDIO_DEPLOYMENT_MODE=hosted
EXPOSE 8788
CMD ["node", "server.mjs"]
