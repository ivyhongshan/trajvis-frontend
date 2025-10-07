FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine


RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run expects PORT env variable
ENV PORT 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
