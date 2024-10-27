/*jshint esversion: 6 */
const electron = require("electron");
const join = require("path").join;
const { ipcMain, dialog } = require("electron");
const image = require("./image_manager.js");
const levenshtein = require("fast-levenshtein");

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

ipcMain.on('put-settingStatus', (event, arg) => {
    pageStatus.setting = arg.setting;
    //console.log(arg.setting);
    fs.writeFileSync(setting_path, JSON.stringify(pageStatus.setting));
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

            if (image.isbook(bookPath)) {
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
    book_list = [...new Set(book_list)]; //消除重複
    sql_where();

    console.log(path_list);
    console.log(layers_list);
    fs.writeFileSync(dir_path, JSON.stringify(pageStatus.dir));
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
