# 콕톡 API 서버 (외부 라이브러리 없음, Node 기본 기능만 사용)
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY library ./library
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    TRUST_PROXY=true \
    CACHE_DIR=/tmp/koktok-cache
USER node
EXPOSE 8080
CMD ["node", "bin/start.js"]
