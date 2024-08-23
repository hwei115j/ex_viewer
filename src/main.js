/*jshint esversion: 6 */
const electron = require("electron");
const { nativeImage } = require('electron');
const join = require("path").join;
const { ipcMain, dialog } = require("electron");
const mainApp = require("./mainApplication");

// 創建應用程序對象
const app = electron.app;
// 創建一個瀏覽器窗口，主要用來加載HTML頁面
const BrowserWindow = electron.BrowserWindow;
// 聲明一個BrowserWindow對象實例
let mainWindow;


function createWindow() {

    // 創建一個瀏覽器窗口對象，並指定窗口的大小
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            //enableRemoteModule: true
        }
    });
    //隱藏工具列
    electron.Menu.setApplicationMenu(null);

    mainApp.appInit();

    if (mainApp.setting.value.debug.value) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on("closed", function () {
        mainWindow = null;
    });
    mainWindow.loadURL("file://" + join(__dirname, "html", "home.html"));
}

ipcMain.on("exit", event => {
    app.quit();
});

ipcMain.on('toggle-fullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

app.on("ready", createWindow);

app.on("window-all-closed", function () {
    if (process.platform != "darwin") {
        app.quit();
    }
});

app.on("activate", function () {
    if (mainWindow === null) {
        createWindow();
    }
});
