/*jshint esversion: 8 */
const { group } = require("console");
const { ipcMain, dialog } = require("electron");
const join = require("path").join;
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { event } = require("jquery");
const url = require("url");

const ex_db_path = join(".", "setting", "ex.db");
const dir_path = join(".", "setting", "local", "dir.json");
const definition_json = join(".", "setting", "language", "definition.json");
const ui_json = join(".", "setting", "language", "ui.json");
const local_db_path = join(".", "setting", "local", "local.db");
const setting_json = join(".", "setting", "setting.json");

let db;
let setting = JSON.parse(fs.readFileSync(setting_json).toString());

let pageStatus = {
    book_id: 0,
    img_id: 0,
    full: false,
    sort_flag: false,
    home_scrollTop: 0,
    book_scrollTop: 0,
    group: [],
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

function appInit() {
    db = new sqlite3.Database(local_db_path);
    search("");
}

function search(input) {
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
            });
        });
    } catch (err) {
        console.log(err);
        search_str = input;
        return;
    }
}

function getHead(path) {
    const exten = /^.*(\.jpg)|(\.jpeg)|(\.jfif)|(\.pjpeg)|(\.pjp)|(\.svg)|(\.webp)|(\.png)|(\.gif)/;

    let imgPath, name;
    let dir = fs.readdirSync(path);

    for (let i in dir) {

        if (exten.test(dir[i])) {
            imgPath = join(path, dir[i]);
            break;
        }
    }
    const fileData = fs.readFileSync(imgPath);

    return fileData;
}


ipcMain.on('get-pageStatus', (event, arg) => {
    if (arg != undefined) {
        pageStatus.book_id = arg;
    }
    let r = [];
    let page_max = pageStatus.setting.value.home_max.value;
    for (let i = 0; pageStatus.group[pageStatus.book_id + i] && i < page_max; i++) {
        let n = JSON.parse(JSON.stringify(pageStatus.group[pageStatus.book_id + i]));
        //n.local_path = getHead(pageStatus.group[pageStatus.book_id + i].local_path);
        r.push(n);
    }
    event.reply('get-pageStatus-reply', {
        home_max: pageStatus.setting.value.home_max.value,
        page_max: pageStatus.setting.value.page_max.value,
        book_id: pageStatus.book_id,
        img_id: pageStatus.img_id,
        group: pageStatus.group,
        uiLanguage: pageStatus.ui,
        definition: pageStatus.definition_db,
    });
});

ipcMain.on('put-homeStatus', (event, arg) => {
    pageStatus.book_id = arg.book_id;
    console.log(arg.book_id);
    event.reply('put-homeStatus-reply', {
    });
});

ipcMain.on('get-book', (event, arg) => {
    let r = [];
    let page_max = pageStatus.setting.value.home_max.value;
    for (let i = 0; pageStatus.group[arg + i] && i < page_max; i++) {
        r.push(pageStatus.group[arg + i]);
    }
    event.reply('book-data', r);
});

ipcMain.on("open-file-dialog", event => {
    event.sender.send(
        "selected-directory",
        dialog.showOpenDialogSync({
            properties: ["openDirectory"]
        })
    );
});




module.exports = {
    pageStatus: pageStatus,
    appInit: appInit, 
    setting: setting
};