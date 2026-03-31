FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@10 --activate && pnpm install --frozen-lockfile
EXPOSE 4000
CMD ["pnpm", "--filter", "@linktrend/LiNKaios", "dev"]
