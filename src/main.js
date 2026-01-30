/*jshint esversion: 6 */
const electron = require("electron");
const join = require("path").join;
const { ipcMain, dialog } = require("electron");
const imageManager = require("./imageManager.js");
const levenshtein = require("fast-levenshtein");
const {convertQuery} = require('./eh-search-parser.js');

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
const setting_path = join(".", "setting", "setting.json");
const historyList_json = join(".", "setting", "historyList.json");
let db;
let setting = JSON.parse(fs.readFileSync(setting_path).toString());
let imageManagerInstance = new imageManager();
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

    //appInit();

    if (pageStatus.setting.value.debug.value) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on("closed", function () {
        mainWindow = null;
    });

    fs.access(local_db_path, fs.constants.F_OK, (err) => {
        if (err) {
            mainWindow.loadURL("file://" + join(__dirname, "html", "match.html"));
        } else {
            appInit();
            mainWindow.loadURL("file://" + join(__dirname, "html", "home.html"));
        }
    });
}

let pageStatus = {
    book_id: 0,
    img_id: 0,
    full: false,
    sort_flag: false,
    home_scrollTop: 0,
    book_scrollTop: 0,
    search_str: "",
    currentSort: "name",  // 追蹤當前排序模式: "name", "random", "chronology"
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
            return JSON.parse(fs.readFileSync(setting_path).toString());
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
                JSON.stringify(JSON.parse('{"dir":[], "layers":[]}'), null, 4)
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
                JSON.stringify(JSON.parse('[]'), null, 4)
            );
            return JSON.parse('[]');
        }
    })(),
};

let defineCategory = [
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
    search(pageStatus.search_str, defineCategory, () => { });
}

function search(searchStr, category, func_cb) {
    pageStatus.book_id = 0;

    try {
        // 使用 convertQuery 解析搜尋字串
        const result = convertQuery(searchStr);

        if (result.error) {
            console.log('Search parse error:', result.error);
            func_cb();
            return;
        }

        let sql = result.sql;

        // 如果有 category 過濾條件，添加到 SQL
        if (category.length && category.length != defineCategory.length) {
            let categoryCondition = "(";
            for (let i in category) {
                categoryCondition += `category LIKE '%${category[i]}%'`;
                if (i < category.length - 1) {
                    categoryCondition += " OR ";
                }
            }
            categoryCondition += ")";

            // 根據原始 SQL 是否已有 WHERE 來決定連接方式
            if (sql.includes('WHERE')) {
                sql += ` AND ${categoryCondition}`;
            } else {
                sql += ` WHERE ${categoryCondition}`;
            }
        }

        console.log('Search SQL:', sql);

        db.serialize(() => {
            db.all(sql, [], (err, rows) => {
                if (err != null) {
                    console.log(err);
                }
                pageStatus.group = rows || [];
                pageStatus.group.sort((a, b) =>
                    a.local_name.localeCompare(b.local_name, "zh-Hant-TW", { numeric: true })
                );
                imageManagerInstance.setGroup(pageStatus.group);
                func_cb();
            });
        });
    } catch (err) {
        console.log(err);
        func_cb();
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
    pageStatus.search_str = arg.str;
    search(pageStatus.search_str, arg.category, () => {
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
        dir: pageStatus.dir,
        search_str: pageStatus.search_str,
        group: pageStatus.group,
        uiLanguage: pageStatus.uiLanguage,
        definition: pageStatus.definition_db,
        globalHotkeys: pageStatus.setting.value.keyboard_setting.value.global.value,
        homeHotkeys: pageStatus.setting.value.keyboard_setting.value.home.value,
        bookHotkeys: pageStatus.setting.value.keyboard_setting.value.book.value,
        viewHotkeys: pageStatus.setting.value.keyboard_setting.value.view.value,
        historyList: pageStatus.historyList.sort((a, b) => a.order - b.order),
        setting: pageStatus.setting
    });
});

ipcMain.on('rematch', (event) => {
    const deleteAndNavigate = () => {
        try {
            if (fs.existsSync(local_db_path)) {
                fs.unlinkSync(local_db_path);
                console.log('已刪除本地資料庫: ' + local_db_path);
            }
        } catch (err) {
            console.error('刪除資料庫文件時發生錯誤:', err);
        }
        
        pageStatus.book_id = 0;
        pageStatus.img_id = 0;
        pageStatus.group = [];
        
        mainWindow.loadURL("file://" + join(__dirname, "html", "match.html"));
    };
    
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('關閉資料庫時發生錯誤:', err);
            }
            db = null;
            deleteAndNavigate();
        });
    } else {
        deleteAndNavigate();
    }
});

ipcMain.on('put-settingStatus', (event, arg) => {
    pageStatus.setting = arg.setting;
    //console.log(arg.setting);
    fs.writeFileSync(setting_path, JSON.stringify(pageStatus.setting, null, 4));
    event.reply('put-settingStatus-reply');
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
    const updatedData = JSON.stringify(pageStatus.historyList, null, 4);
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

ipcMain.on('put-match', (event, arg) => {
    const path_list = arg.path_list;
    const layers_list = arg.layers_list;
    const t_start = new Date().getTime();
    let book_count = 0;
    let book_list = [];
    let debug = [];
    let debug1 = [];

    function create_book_list(path, layers) {
        function max_string(str) {
            let r = str;
            str = str.replace(/\[[^\]]*\]/g, "%");
            str = str.replace(/\([^)]*\)/g, "%");
            str = str.replace(/\{[^}]*\}/g, "%");

            str = str.replace(/\【[^}]*\】/g, "%");
            str = str.replace(/\（[^)]*\）/g, "%");

            let arr = str.split("%");
            let max = 0, maxs;
            for (let i in arr) {
                if (max < arr[i].length) {
                    max = arr[i].length;
                    maxs = i;
                }
            }

            if (!arr[maxs]) {
                console.log(r);
                return r;
            }
            return arr[maxs].replace(/(^[\s]*)|([\s]*$)|/g, "").replace(/^-/g, '');
        }
        let files;
        let list = [];

        try {
            files = fs.readdirSync(path);
        } catch (e) {
            return list;
        }
        for (let i in files) {
            let title = files[i];
            let bookPath = join(path, title);

            if (imageManagerInstance.isBook(bookPath)) {
                list.push([title, max_string(files[i]), path]);
            }
            if (layers != 1) {
                list = list.concat(create_book_list(bookPath, layers - 1));
            }
        }

        return list;
    }
    function levens(rows, str) {
        //去除ex下載&H@H下載時的後綴
        str = str.replace(/\[\d+\]|\[\d+\-\d+x\]|\-\d+x/g, "");
        if (!Array.isArray(rows) || rows.length === 0) {
            return null;
        }
        let min = Infinity;
        let reg = null;
        rows.forEach(row => {
            let title = levenshtein.get(row.title, str);
            let title_jpn = levenshtein.get(row.title_jpn, str);

            if (title <= min) {
                min = title;
                reg = row;
            }
            if (title_jpn <= min) {
                min = title_jpn;
                reg = row;
            }
        });
        return reg;
    }
    //推入local資料庫
    function push_local_db(exdb_row, name, path) {
        let instr = "local_name, local_path";
        for (let i in exdb_row) {
            instr += "," + i;
        }
        db.serialize(() => {
            function progressBar() {
                event.reply("put-match-reply", { totalBooks: book_list.length, currentBooks: book_count });
            }

            let str = `"${name}", "${join(path, name)}"`;
            for (let i in exdb_row) {
                str += `,"${exdb_row[i]}"`;
            }
            book_count++;
            db.run(`INSERT INTO data (${instr}) VALUES (${str});`, [], () => {
                if (book_count == book_list.length) {
                    let end = new Date().getTime();
                    console.log((end - t_start) / 1000 + "sec");
                    //全部push進local.db結束時執行
                    db.run("COMMIT");
                    //console.log(debug);
                    //console.log(debug1);
                }
                progressBar();
            });
        });
    }
    function sql_where() {
        function fullwidth(str) {
            str = str.replace("！", "!");
            str = str.replace("？", "?");
            str = str.replace("：", ":");
            str = str.replace("＆", "&amp;");
            str = str.replace("&", "&amp;");
            str = str.replace("　", " ");
            str = str.replace("-", " ");
            return str;
        }
        if (book_list.length == 0) {
            console.log("sql_where");
            return;
        }
        let meta_db = new sqlite3.Database(ex_db_path);

        db.run(
            "CREATE TABLE IF NOT EXISTS  data(" +
            "local_id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "local_name nvarchar," +
            "local_path nvarchar," +
            "gid    int," +
            "token  nvarchar," +
            //                "archiver_key nvarchar," +
            "title  nvarchar," +
            "title_jpn  nvarchar," +
            "category nvarchar," +
            //                "thumb  nvarchar," +
            //                "uploader nvarchar," +
            "posted nvarchar," +
            "filecount nvarchar," +
            //                "filesize  int," +
            //                "expunged   bool," +
            //                "rating    nvarchar," +
            //                "torrentcount   nvarchar," +
            //                "torrents   nvarchar," +
            "tags   nvarchar," +
            "error   nvarchar" +
            ");"
        );
        db.run("BEGIN TRANSACTION;");

        for (let book of book_list) {
            //console.log(book[1]);
            //console.log(fullwidth(book[1]));
            /*
            let sql =
                "SELECT * FROM data " +
                `WHERE title_jpn LIKE "%${book[1]}%"`+
                `OR title LIKE "%${book[1]}%"`+
                `OR title_jpn LIKE "%${fullwidth(book[1])}"`+
                `OR title LIKE "%${fullwidth(book[1])}%"`;
            */
            let sql =
                "SELECT * FROM data " +
                `WHERE title_jpn MATCH "${book[1]}"` +
                `OR title MATCH "${book[1]}"` +
                `OR title_jpn MATCH "${fullwidth(book[1])}"` +
                `OR title MATCH "${fullwidth(book[1])}"`;
            meta_db.serialize(() => {
                meta_db.all(sql, [], (err, rows) => {
                    if (err) {
                        //console.log(err);
                        console.log(sql);
                        push_local_db(null, book[0], book[2]);
                        return;
                        throw err;
                    }
                    //把候選檔名和原始檔名做比對
                    let r = levens(rows, book[0]);
                    if (!Array.isArray(r) || r.length === 0) {
                        debug.push(sql);
                        debug1.push(book[2]);
                    }
                    push_local_db(r, book[0], book[2]);
                });
            });
        }
    }

    pageStatus.dir.dir = path_list;
    pageStatus.dir.layers = layers_list;
    db = new sqlite3.Database(local_db_path);

    for (let i in path_list) {
        book_list = book_list.concat(
            create_book_list(path_list[i], layers_list[i])
        );
    }
    book_list = [...new Set(book_list.map(JSON.stringify))].map(JSON.parse);
    sql_where();

    console.log(path_list);
    console.log(layers_list);
    fs.writeFileSync(dir_path, JSON.stringify(pageStatus.dir, null, 4));
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
    // 更新當前排序模式
    pageStatus.currentSort = arg; 
    //pageStatus.book_id = pageStatus.group.findIndex(element => element.local_id === id);

    imageManagerInstance.setGroup(pageStatus.group);
    event.reply("sort-reply", {
        group: pageStatus.group,
        book_id: pageStatus.book_id
    });
});

// main
ipcMain.on('show-context-menu', (event, arg) => {
    const template = [];

    if (arg.selectedText) {
        template.push({
            label: getTranslation('Copy'),
            click: () => { event.sender.send('context-menu-command', 'copy', arg.selectedText); }
        });
    }

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

    if (arg.previousPage) {
        template.push({
            label: getTranslation('Previous page'),
            click: () => { event.sender.send('context-menu-command', 'previousPage'); }
        });
    }

    if (arg.isInput) {
        template.push({
            label: getTranslation('paste'),
            click: () => { event.sender.send('context-menu-command', 'Paste'); }
        });
    }
    
    // 添加排序子菜單
    template.push({
        label: getTranslation('Sort'),
        submenu: [
            {
                label: getTranslation('Name'),
                type: 'checkbox',
                checked: pageStatus.currentSort === 'name',
                click: () => { event.sender.send('context-menu-command', 'sort', 'name'); }
            },
            {
                label: getTranslation('Random'),
                type: 'checkbox',
                checked: pageStatus.currentSort === 'random',
                click: () => { event.sender.send('context-menu-command', 'sort', 'random'); }
            },
            {
                label: getTranslation('Chronology'),
                type: 'checkbox',
                checked: pageStatus.currentSort === 'chronology',
                click: () => { event.sender.send('context-menu-command', 'sort', 'chronology'); }
            }
        ]
    });
    
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
