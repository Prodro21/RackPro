# RackProBridge — Fusion 360 Add-In

HTTP bridge that lets the RackPro web app (rackpro.prodro.pro) build 3D models directly in your local Fusion 360 instance.

## How It Works

The add-in runs a small HTTP server on `localhost:9100` inside Fusion 360. When you click "Build in Fusion" in the RackPro web app, it sends your panel configuration to this local server, which executes the Fusion 360 API to create the 3D model.

## Installation

### 1. Locate your Fusion 360 Add-Ins folder

- **macOS**: `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`
- **Windows**: `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`

If the `AddIns` folder doesn't exist, create it.

### 2. Copy the add-in

Copy the entire `RackProBridge` folder into the `AddIns` directory:

```
AddIns/
  RackProBridge/
    RackProBridge.py
    RackProBridge.manifest
    commands/
      __init__.py
      build_model.py
      query_model.py
      export_model.py
    lib/
      __init__.py
      constants.py
      geometry.py
```

### 3. Start the add-in in Fusion 360

1. Open Fusion 360
2. Go to **Utilities** tab in the toolbar
3. Click **Add-Ins** (or press `Shift+S`)
4. In the Add-Ins dialog, find **RackProBridge** under "My Add-Ins"
5. Select it and click **Run**
6. You should see a message: "RackProBridge running on localhost:9100"

### 4. Connect from the web app

1. Open [rackpro.prodro.pro](https://rackpro.prodro.pro) in **Chrome or Firefox** (Safari may block localhost connections)
2. Go to the **Export** tab
3. The Fusion 360 Bridge section should show a green dot and "Connected"
4. Design your panel, then click **Build in Fusion**

## Troubleshooting

### "Not connected" in the web app
- Make sure Fusion 360 is running and the add-in is started (step 3 above)
- Click the **Refresh** button in the bridge panel
- Check that no firewall is blocking localhost:9100

### Safari doesn't connect
Safari blocks mixed-content requests (HTTPS page to HTTP localhost) more strictly than other browsers. Use **Chrome** or **Firefox** instead.

### Port conflict
If port 9100 is already in use, you'll see an error when starting the add-in. Close whatever is using that port (often a printer service) and restart the add-in.

### Add-in doesn't appear in Fusion
- Make sure the folder structure is exactly right (the `.py` and `.manifest` files must be at the top level of `RackProBridge/`)
- Restart Fusion 360 after copying the files
- The folder name must match the `.py` and `.manifest` filename: `RackProBridge`

## Auto-Start (Optional)

To have the bridge start automatically when Fusion launches:
1. Go to **Utilities > Add-Ins**
2. Select **RackProBridge**
3. Check **"Run on Startup"**
