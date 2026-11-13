FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app
COPY client/package.json ./client/
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --filter @resolveai/client
COPY client ./client
# VITE_API_URL is injected at build time via --build-arg
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @resolveai/client build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
