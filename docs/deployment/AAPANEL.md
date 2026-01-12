# Deploy to aaPanel

aaPanel provides a GUI to manage your VPS, making deployment easier.

## Prerequisites
- VPS installed with aaPanel.
- Node.js Manager plugin installed (via App Store).

## Steps

### 1. Upload Project
- Go to **Files**.
- Create folder `/www/wwwroot/dramabox-api`.
- Upload your project files (or use **Terminal** to `git clone`).
- **Do not** upload `node_modules` (install fresh).

### 2. Install Dependencies
- Open **Terminal** in aaPanel.
- Navigate to folder: `cd /www/wwwroot/dramabox-api`.
- Run: `npm install`.

### 3. Create Node Project
- Go to **Website** > **Node Project**.
- Click **Add Node Project**.
- **Path**: Select project folder.
- **Startup Option**: `Start command` -> `npm start` OR `server.js`.
- **Port**: `3000`.
- **Domain**: Add your domain (e.g., `api.yourdomain.com`).
- Click **Submit**.

### 4. Configuration
- The project status should be "Running".
- Go to **Configuration** (click the project name).
- Here you can manage:
  - **Domain**: Manage domains.
  - **SSL**: One-click Let's Encrypt SSL.
  - **Service**: Start/Stop/Restart.

### 5. Reverse Proxy (If needed)
- If you didn't add the domain during creation, you can manually map a domain in **Website** > **PHP Project** (create dummy) -> **Reverse Proxy** to `http://127.0.0.1:3000`.
- *Note: Using the "Node Project" feature is recommended over manual proxy.*
