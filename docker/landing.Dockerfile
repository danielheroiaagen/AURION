# AURION landing — static marketing site behind nginx (phase 27).
FROM nginx:1.27-alpine
COPY apps/landing/ /usr/share/nginx/html/
# Long cache for assets, no cache for HTML so edits show immediately.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location ~* \\.html$ { add_header Cache-Control "no-cache"; }\n  location / { try_files $uri $uri/ =404; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
