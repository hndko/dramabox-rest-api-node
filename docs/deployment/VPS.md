# Deploy to VPS (Ubuntu/Debian)

For full control and performance, deploy on a Virtual Private Server (VPS).

## Prerequisites
- VPS with Ubuntu 20.04/22.04
- Root access (SSH)
- Domain pointing to VPS IP

## Steps

### 1. Install Node.js & PM2
```bash
# Update repo
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2
```

### 2. Setup Project
```bash
# Clone repo
git clone https://github.com/yourusername/dramabox-rest-api-node.git /var/www/dramabox-api

# Install dependencies
cd /var/www/dramabox-api
npm install
```

### 3. Start Application
```bash
# Start with PM2
pm2 start server.js --name "dramabox-api"

# Save list to restart on boot
pm2 save
pm2 startup
```

### 4. Setup Nginx (Reverse Proxy)
```bash
sudo apt install nginx -y
```

Create config file: `/etc/nginx/sites-available/dramabox`
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/dramabox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Setup SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com
```

Your API is now live at `https://api.yourdomain.com`!
