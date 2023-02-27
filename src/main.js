/*jshint esversion: 6 */
const electron = require("electron");
const fs = require("fs");
const join = require("path").join;
const { ipcMain, dialog } = require("electron");
const local_db_path = join(".", "setting", "local", "local.db");
const ex_db_path = join(".", "setting", "ex.db");
const dir_path = join(".", "setting", "local", "dir.json");
const definition_json = join(".", "setting", "language", "definition.json");
const ui_json = join(".", "setting", "language", "ui.json");
const setting_json = join(".", "setting", "setting.json");

// 創建應用程序對象
const app = electron.app;
// 創建一個瀏覽器窗口，主要用來加載HTML頁面
const BrowserWindow = electron.BrowserWindow;

// 聲明一個BrowserWindow對象實例
let mainWindow;

let setting;

pageStatus = {
    book_id: 0,
    img_id: 0,
    full: false,
    sort_flag: false,
    home_scrollTop: 0,
    book_scrollTop: 0,
    definition_db: (() => {
        try {
            return JSON.parse(fs.readFileSync(definition_json).toString());
        } catch (err) {
            return {};
        }
    })(),
    ui: (() => {
        try {
            return JSON.parse(fs.readFileSync(ui_json).toString());
        } catch (err) {
            return {};
        }
    })(),
    setting: (() => {
        try {
            return JSON.parse(fs.readFileSync(setting_json).toString());
        } catch (err) {
            throw err;
        }
    })(),
    dir: (() => {
        try {
            return JSON.parse(fs.readFileSync(dir_path).toString());
        } catch (err) {
            fs.writeFileSync(
                dir_path,
                JSON.stringify(JSON.parse('{"dir":[], "layers":[]}'))
            );
            return JSON.parse('{"dir":[], "layers":[]}');
        }
    })(),
};

function createWindow() {
    console.log(electron.ipcMain);

    setting = JSON.parse(fs.readFileSync(setting_json).toString());

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


    mainWindow.loadURL("file://" + join(__dirname, "html", "home.html"));

    if (setting.debug) {
        mainWindow.webContents.openDevTools();
    }
    ipcMain.on('get-pageStatus', (event, arg) => {
        console.log("ipc");
        event.reply('pageStatus-data', { pageStatus });
    });
    mainWindow.on("closed", function () {
        mainWindow = null;
    });

}


ipcMain.on("open-file-dialog", event => {
    event.sender.send(
        "selected-directory",
        dialog.showOpenDialogSync({
            properties: ["openDirectory"]
        })
    );
});

ipcMain.on("exit", event => {
    app.quit();
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
