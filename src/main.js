/*jshint esversion: 6 */
const electron = require("electron");
const { nativeImage } = require('electron');
const join = require("path").join;
const { ipcMain, dialog } = require("electron");

// 聲明一個BrowserWindow對象實例
let mainWindow;
/*jshint esversion: 8 */
const { group } = require("console");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { event } = require("jquery");
const url = require("url");
const { app, BrowserWindow, Menu } = require('electron');


const ex_db_path = join(".", "setting", "ex.db");
const dir_path = join(".", "setting", "local", "dir.json");
const definition_json = join(".", "setting", "language", "definition.json");
const ui_json = join(".", "setting", "language", "ui.json");
const local_db_path = join(".", "setting", "local", "local.db");
const setting_json = join(".", "setting", "setting.json");
const historyList_json = join(".", "setting", "historyList.json");
let db;
let setting = JSON.parse(fs.readFileSync(setting_json).toString());

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

    appInit();

    if (setting.value.debug.value) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on("closed", function () {
        mainWindow = null;
    });
    mainWindow.loadURL("file://" + join(__dirname, "html", "home.html"));
}

let pageStatus = {
    book_id: 0,
    img_id: 0,
    full: false,
    sort_flag: false,
    home_scrollTop: 0,
    book_scrollTop: 0,
    search_str: "",
    group: [],
    definition_db: (() => {
        try {
            return JSON.parse(fs.readFileSync(definition_json).toString());
        } catch (err) {
            return {};
        }
    })(),
    uiLanguage: (() => {
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
    historyList: (() => {
        try {
            return JSON.parse(fs.readFileSync(historyList_json).toString());
        } catch (err) {
            fs.writeFileSync(
                historyList_json,
                JSON.stringify(JSON.parse('[]'))
            );
            return JSON.parse('[]');
        }
    })(),
};

let category = [
    "Doujinshi",
    "Manga",
    "Artist CG",
    "Game CG",
    "Western",
    "Non-H",
    "Image Set",
    "Cosplay",
    "Asian Porn",
    "Misc"
];

function appInit() {
    db = new sqlite3.Database(local_db_path);
    search(pageStatus.search_str, () => { });
}

function search(input, func_cb) {
    pageStatus.book_id = 0;
    //global.key_flag = false;
    //let token = input.trim().split(/\s+/);
    let token;
    let sql = `SELECT * FROM data` + "\n" + `WHERE `;
    let scount = 0;
    let flag = 1;

    //search BNF
    //
    //<sear>  ::= <elem> +   <sear>
    //          | <elem> OR  <sear>
    //          | <elem> AND <sear>
    //          | <elem> <sear>
    //          | <elem>
    //
    //<elem>  ::= -<elem>
    //          | <namespace>:string
    //          | <namespace>:string$
    //          | .<sys>
    //          | string
    //
    //<namespace> ::= artist
    //              | character
    //              | female
    //              | group
    //              | language
    //              | male
    //              | parody
    //              | reclass
    //
    //<sys> ::= null

    function lex(input) {
        let token = [];
        for (let i = 0; i < input.length; i++) {
            let str = "";
            if (input[i] == '"') {
                let j = i + 1;
                for (; j < input.length && input[j] != '"'; j++) {
                    str += input[j];
                }
                if (j < input.length || (input[j] == '"' && str != "")) {
                    token.push(str);
                    i = j;
                }
            } else {
                for (; /\s/.test(input[i]); i++);
                for (
                    ;
                    i < input.length && !/\s/.test(input[i]) && input[i] != '"';
                    i++
                ) {
                    str += input[i];
                }
                if (input[i] == '"') i--;
                if (str != "") {
                    token.push(str);
                }
            }
        }
        if (token.length != 0) return token;
        return [""];
    }

    function sear() {
        if (
            isnamespace(token[scount]) &&
            token[scount][token[scount].length - 1] == ":"
        ) {
            scount++;
        }
        if (scount + 1 == token.length) {
            return elem();
        }
        if (
            token[scount + 1] == "+" ||
            token[scount + 1] == "OR" ||
            token[scount + 1] == "or"
        ) {
            let r = elem();
            scount++;
            return r + " OR " + sear();
        } else if (token[scount + 1] == "AND" || token[scount + 1] == "and") {
            let r = elem();
            scount++;
            return r + " AND " + sear();
        } else {
            let r = elem();
            return r + " OR " + sear();
        }
    }
    function isnamespace(input) {
        let str = input.trim().split(/:/)[0];
        let namespace = [
            "artist",
            "character",
            "female",
            "group",
            "language",
            "male",
            "parody",
            "reclass"
        ];
        for (let i in namespace) {
            if (namespace[i] == str) {
                return true;
            }
        }
        return false;
    }
    function elem() {
        function sqlstr(str) {
            return (
                `(local_name LIKE '%${str}%'` +
                "\n" +
                `OR title LIKE '%${str}%'` +
                "\n" +
                `OR title_jpn LIKE '%${str}%'` +
                "\n" +
                `OR tags LIKE '%${str}%'` +
                "\n" +
                `OR category LIKE '%${str}%')` +
                "\n"
            );
        }

        if (token[scount][0] == "-") {
            token[scount] = token[scount].substring(1, token[scount].length);
            return "NOT" + elem();
        } else if (token[scount][0] == ".") {
            if (token[scount] == ".null" || token[scount] == ".NULL") {
                scount++;
                flag = 0;
                return " gid ISNULL";
            } else {
                throw err;
            }
        } else if (isnamespace(token[scount])) {
            let str = token[scount].trim().split(/:/)[1];
            let r = sqlstr(str.substring(0, str.length - 1));
            scount++;
            return r;
            /*
            let r;
            scount++;
            let tail = token[scount].length - 1;
            if (token[scount][tail] == "$") {
                console.log(token[scount].substring(0, tail));
                r = sqlstr(token[scount].substring(0, tail));
                scount++;
            } else {
                r = sqlstr(token[scount++]);
            }
            if (token[scount] == "$") {
                scount++;
            }
            return r;
            */
        } else {
            if (token[scount][token[scount].length - 1] == "$") {
                let r = sqlstr(
                    token[scount].substring(0, token[scount].length - 1)
                );
                scount++;
                return r;
            }
            return sqlstr(token[scount++]);
        }
    }
    try {
        token = lex(input);
        sql += sear();

        if (category.length && category.length != 10 && flag) {
            sql += "AND (";
            for (let i in category) {
                sql += `category LIKE '%${category[i]}%'` + "\nOR ";
            }
            sql = sql.substring(0, sql.length - 4);
            sql += ")";
        }
        //console.log(sql);
        db.serialize(() => {
            db.all(sql, [], (err, rows) => {
                if (err != null) {
                    console.log(err);
                }
                pageStatus.group = rows;
                pageStatus.group.sort((a, b) =>
                    a.local_name.localeCompare(b.local_name, "zh-Hant-TW", { numeric: true })
                );
                func_cb();
            });
        });
    } catch (err) {
        console.log(err);
        search_str = input;
        return;
    }
}

function getTranslation(name) {
    return pageStatus.uiLanguage[name] ? pageStatus.uiLanguage[name] : name;
}

ipcMain.on("open-file-dialog", event => {
    event.sender.send(
        "selected-directory",
        dialog.showOpenDialogSync({
            properties: ["openDirectory"]
        })
    );
});

ipcMain.on('put-search', (event, arg) => {
    category = arg.category;
    pageStatus.search_str = arg.str;
    search(pageStatus.search_str, () => {
        event.reply('put-search-reply', {
            book_id: pageStatus.book_id,
            group: pageStatus.group,
            search_str: pageStatus.search_str,
        });
    });
})

ipcMain.on('get-pageStatus', (event, arg) => {
    if (arg != undefined) {
        pageStatus.book_id = arg;
    }
    //let r = [];
    let page_max = pageStatus.setting.value.home_max.value;
    /*
    for (let i = 0; pageStatus.group[pageStatus.book_id + i] && i < page_max; i++) {
        let n = JSON.parse(JSON.stringify(pageStatus.group[pageStatus.book_id + i]));
        //n.local_path = getHead(pageStatus.group[pageStatus.book_id + i].local_path);
        r.push(n);
    }
        */
    event.reply('get-pageStatus-reply', {
        home_max: pageStatus.setting.value.home_max.value,
        page_max: pageStatus.setting.value.page_max.value,
        book_id: pageStatus.book_id,
        img_id: pageStatus.img_id,
        search_str: pageStatus.search_str,
        group: pageStatus.group,
        uiLanguage: pageStatus.uiLanguage,
        definition: pageStatus.definition_db,
        globalHotkeys: pageStatus.setting.value.keyboard_setting.value.global.value,
        homeHotkeys: pageStatus.setting.value.keyboard_setting.value.home.value,
        bookHotkeys: pageStatus.setting.value.keyboard_setting.value.book.value,
        viewHotkeys: pageStatus.setting.value.keyboard_setting.value.view.value,
        historyList: pageStatus.historyList.sort((a, b) => a.order - b.order),
    });
});

ipcMain.on('put-homeStatus', (event, arg) => {
    pageStatus.book_id = arg.book_id;
    console.log(arg.book_id);
    event.reply('put-homeStatus-reply');
});

ipcMain.on('put-bookStatus', (event, arg) => {
    pageStatus.img_id = arg.img_id;
    pageStatus.book_id = arg.book_id;
    event.reply('put-bookStatus-reply');
});

ipcMain.on('put-img_id', (event, arg) => {
    pageStatus.img_id = arg.img_id;
    console.log(arg.img_id);
    event.reply('put-img_id-reply');
});

ipcMain.on('put-historyList', (event, list) => {
    pageStatus.historyList = list;
    const updatedData = JSON.stringify(pageStatus.historyList);
    fs.writeFile(historyList_json, updatedData, 'utf8', (err) => {
        event.reply('put-historyList-reply');
        if (err) {
            console.error('寫入文件時發生錯誤:', err);
            return;
        }
        console.log('文件已成功更新');
    });
})

ipcMain.on('get-book', (event, arg) => {
    let r = [];
    let page_max = pageStatus.setting.value.home_max.value;
    for (let i = 0; pageStatus.group[arg + i] && i < page_max; i++) {
        r.push(pageStatus.group[arg + i]);
    }
    event.reply('book-data', r);
});

ipcMain.on("sort", (event, arg) => {
    let id = pageStatus.group[pageStatus.book_id].local_id;
    if (arg == "name") {
        pageStatus.group.sort((a, b) =>
            a.local_name.localeCompare(b.local_name, "zh-Hant-TW", { numeric: true })
        );
    }
    if (arg == "random") {
        pageStatus.group.sort(() => Math.random() - 0.5);
    }
    if (arg == "chronology") {
        pageStatus.group.sort((a, b) => {
            return b.posted - a.posted;
        });
    }
    //pageStatus.book_id = pageStatus.group.findIndex(element => element.local_id === id);
    event.reply("sort-reply", {
        group: pageStatus.group,
        book_id: pageStatus.book_id
    });
});

// main
ipcMain.on('show-context-menu', (event, arg) => {
    const template = [];

    if (arg.fileName) {
        template.push({
            label: getTranslation('Copy Name'),
            click: () => { event.sender.send('context-menu-command', 'copy', arg.fileName); }
        });
    }
    if (arg.filePath) {
        template.push({
            label: getTranslation('Copy Path'),
            click: () => { event.sender.send('context-menu-command', 'copy', arg.filePath); }
        });
    }
    if (arg.selectedText) {
        template.push({
            label: getTranslation('Copy'),
            click: () => { event.sender.send('context-menu-command', 'copy', arg.selectedText); }
        });
    }
    if (arg.previousPage) {
        template.push({
            label: getTranslation('Previous page'),
            click: () => { event.sender.send('context-menu-command', 'previousPage'); }
        });
    }

    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })
})

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
