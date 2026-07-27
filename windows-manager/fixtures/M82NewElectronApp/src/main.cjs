"use strict";
const { app, BrowserWindow } = require("electron");
app.whenReady().then(() => { const window = new BrowserWindow({ width: 640, height: 420 }); void window.loadFile("src/index.html"); });
app.on("window-all-closed", () => app.quit());
