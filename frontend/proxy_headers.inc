proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header Host $host;
# Overwrite (never append) so clients cannot spoof their address to dodge rate limits.
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
# nginx sets the security headers for every response; drop the app's copies so each appears once.
proxy_hide_header X-Frame-Options;
proxy_hide_header X-Content-Type-Options;
proxy_hide_header Content-Security-Policy;
proxy_hide_header Referrer-Policy;
proxy_hide_header Permissions-Policy;
