# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# .env.production file create karo build time pe
RUN echo "VITE_SUPABASE_URL=https://zqcspamakvfzvlqbunit.supabase.co" > .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY3NwYW1ha3ZmenZscWJ1bml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDk4MDYsImV4cCI6MjA3ODY4NTgwNn0.1ITkRtlnDA7HWlc1GisTZhikt6yhC41pN6O_8_hu9co.replace_with_actual" >> .env.production && \
    echo "VITE_N8N_WEBHOOK_URL=https://process.hairmedindia.com/webhook/48b1e48d-05ce-4ef1-a124-9f7e2537414c" >> .env.production && \
    echo "VITE_SERVER_URL=https://zqcspamakvfzvlqbunit.supabase.co/functions/v1/make-server-9c23c834" >> .env.production

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    index index.html; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]