# Deploy to Shared Hosting (cPanel)

You can run this Node.js API on shared hosting that supports **Node.js Selector** (CloudLinux).

## Prerequisites
- cPanel access
- "Setup Node.js App" feature available

## Steps

1. **Upload Files**
   - Compress your project folder (zip).
   - Go to **File Manager** in cPanel.
   - Upload and extract to a folder (e.g., `/home/user/dramabox-api`).
   - **Important**: Do NOT upload `node_modules`.

2. **Setup Node.js App**
   - Go to cPanel > **Setup Node.js App**.
   - Click **Create Application**.
   - **Node.js Version**: Select 18.x or newer.
   - **Application Mode**: Production.
   - **Application Root**: `dramabox-api` (folder name).
   - **Application URL**: Select your domain/subdomain.
   - **Application Startup File**: `server.js` (Point this to the entry point).
   - Click **Create**.

3. **Install Dependencies**
   - Open the app you just created.
   - Click **Run NPM Install**.
   - Wait until it finishes (green success message).

4. **Environment Variables**
   - In the Node.js App page, scroll to **Environment Variables**.
   - Add variables like `DEFAULT_LANG` = `in`.

5. **Restart**
   - Click **Restart Application**.

## Troubleshooting
- If you see a default "It works!" page, ensure your `server.js` is correctly detected.
- Check `stderr.log` in your project folder for errors.
