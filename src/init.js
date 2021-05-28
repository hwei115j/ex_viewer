/*jshint esversion: 6 */
const global = require("electron").remote.getGlobal("sharedObject");
const fs = require("fs");
const join = require("path").join;
const sqlite3 = require("sqlite3").verbose();
const image = require("./image_manager");
const levenshtein = require("fast-levenshtein");
const { ipcRenderer } = require("electron");
const local_db_path = join(".", "setting", "local", "local.db");
const ex_db_path = join(".", "setting", "ex.db");
const dir_path = join(".", "setting", "local", "dir.json");
let db;

function create_init_html(document) {
    //至少他能動......
    let path_list = [...new Set(global.dir.dir)];
    let layers_list = global.dir.layers;
    let book_count = 0;
    let book_list = [];

    //尋找除了[*]、(*)、{*}外的最長字串
    function max_string(str) {
        let r = str;
        str = str.replace(/\[[^\]]*\]/g, "%");
        str = str.replace(/\([^)]*\)/g, "%");
        str = str.replace(/\{[^}]*\}/g, "%");

        let arr = str.split("%");
        let max = 0,
            maxs;
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
        return arr[maxs].replace(/(^[\s]*)|([\s]*$)/g, "");
    }

    //在rows中尋找距離str最近距離的row
    function levens(rows, str) {
        //去除ex下載&H@H下載時的後綴
        str = str.replace(/\[\d+\]|\[\d+\-\d+x\]|\-\d+x/g, "");
        if (rows == null) {
            return null;
        }
        let min = 6553500;
        let reg = null;
        rows.forEach((row) => {
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

    var t_start;
    //搜尋原始資料庫，建立local資料庫
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
            let sql =
                "SELECT * FROM data " +
                `WHERE title_jpn MATCH "${book[1]}" OR title MATCH "${
                    book[1]
                }" OR title_jpn MATCH "${fullwidth(
                    book[1]
                )}" OR title MATCH "${fullwidth(book[1])}"`;
            meta_db.serialize(() => {
                meta_db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.log(err);
                        push_local_db(null, book[0], book[2]);
                        return;
                        throw err;
                    }
                    //把候選檔名和原始檔名做比對
                    let r = levens(rows, book[0]);
                    push_local_db(r, book[0], book[2]);
                });
            });
        }
    }
    //推入local資料庫
    function push_local_db(exdb_row, name, path) {
        let instr = "local_name, local_path";
        for (let i in exdb_row) {
            instr += "," + i;
        }
        db.serialize(() => {
            function progressBar() {
                document.getElementById(
                    "count"
                ).innerHTML = `<h1>${++book_count}/${book_list.length}</h1>`;
            }

            let str = `"${name}", "${join(path, name)}"`;
            for (let i in exdb_row) {
                str += `,"${exdb_row[i]}"`;
            }
            db.run(`INSERT INTO data (${instr}) VALUES (${str});`, [], () => {
                progressBar();
                if (book_count == book_list.length) {
                    let end = new Date().getTime();
                    console.log((end - t_start) / 1000 + "sec");
                    //全部push進local.db結束時執行
                    db.run("COMMIT");
                    module.exports.to_home();
                }
            });
        });
    }

    function update_db() {
        book_list = [];

        t_start = new Date().getTime();

        //刪除不在電腦上，但卻在資料庫的條目
        function deltable(del) {
            if (del.length == 0) return;
            let sql = "DELETE FROM data WHERE ";
            for (let i in del) {
                sql += `local_path="${del[i]}"` + "\n" + "OR ";
            }
            sql = sql.substring(0, sql.length - 3);
            console.log("sql = " + sql);

            db.serialize(() => {
                db.all(sql, [], (err, rows) => {
                    if (err) {
                        //有錯就算了
                        console.log(err);
                        console.log("sqlerr = " + sql);
                        return;
                    }
                });
            });
        }

        function upexdb(callback) {
            let sql = `SELECT * FROM data WHERE gid IS NULL`;
            let nullPath = [];
            db.serialize(() => {
                db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    for (let i in rows) {
                        nullPath.push(rows[i].local_path);
                    }
                    book_list = nullPath.map((x) => {
                        let path = x.match(/.*\\/g)[0];
                        let name = x.match(/([^\\]+)$/)[0];
                        return [
                            name,
                            max_string(name),
                            path.substr(0, path.length - 1),
                        ];
                    });
                    sql_where();
                    if (!book_list.length) {
                        callback();
                    }
                });
            });
        }
        let isbook_list = [];

        let sql = `SELECT * FROM data`;
        db.serialize(() => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.log(err);
                    throw err;
                }
                let old_local_path = [];
                let new_local_path = [];
                for (let i in rows) {
                    old_local_path.push(rows[i].local_path);
                }
                for (let i in path_list) {
                    let book = create_book_list(path_list[i], layers_list[i]);
                    for (let j in book) {
                        new_local_path.push(join(book[j][2], book[j][0]));
                    }
                }
                new_local_path = [...new Set(new_local_path)];

                let del = old_local_path.filter(
                    (x) => !new_local_path.includes(x)
                );
                let add = new_local_path
                    .filter((x) => !old_local_path.includes(x))
                    .filter((x) => image.isbook(x));
                book_list = add.map((x) => {
                    let path = x.match(/.*\\/g)[0];
                    let name = x.match(/([^\\]+)$/)[0];
                    return [
                        name,
                        max_string(name),
                        path.substr(0, path.length - 1),
                    ];
                });
                sql_where();
                deltable(del);
                if (!book_list.length) {
                    //upexdb(module.exports.to_home);
                    //當ex.db更新時校正回歸本機資料庫，暫時先不用，每次更新後重新匹配
                    module.exports.to_home();
                }
            });
        });
    }

    function template() {
        document.getElementById("body").innerHTML = `
        <button id="select-directory" style="display:none">選擇目錄</button></select>
        <p></p>
        <button id="start" style="display:none">開始處理</button>
        <p></p>
        <div id='path'></div>
        <p></p>
        <div id='count'></div>
        <p></p>`;
    }

    function create_book_list(path, layers) {
        let files;
        let list = [];

        console.log(path, layers);
        try {
            files = fs.readdirSync(path);
        } catch (e) {
            console.log(e);
            return list;
        }
        for (let i in files) {
            let title = files[i];
            let p = join(path, title);
            if (layers == 1) {
                if (image.isbook(p))
                    list.push([title, max_string(files[i]), path]);
            } else {
                list = list.concat(create_book_list(p, layers - 1));
            }
        }

        return list;
    }

    function insert() {
        let start = document.getElementById("start");
        let selectDirBtn = document.getElementById("select-directory");
        let path = document.getElementById("path");

        start.style = selectDirBtn.style = "";
        for (let n in path_list) {
            path.innerHTML += `
                <div class="layers">
                <h1>${path_list[n]}</h1>
                <select>
                <option value="1">選擇要深入的層數，預設是1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                </select></div>`;
        }
        let layers = document.getElementsByClassName("layers");
        for (let i = 0; i < layers.length; i++) {
            layers[i].getElementsByTagName("select")[0].value =
                global.dir.layers[i];
        }

        start.addEventListener("click", (event) => {
            t_start = new Date().getTime();
            let layers = document.getElementsByClassName("layers");
            layers_list = [];
            start.style = selectDirBtn.style = "display:none";

            for (let i = 0; i < layers.length; i++) {
                layers_list.push(
                    parseInt(layers[i].getElementsByTagName("select")[0].value)
                );
            }
            global.dir.layers = layers_list;
            fs.writeFileSync(dir_path, JSON.stringify(global.dir));
            db = new sqlite3.Database(local_db_path);
            console.log("path_list = " + path_list);
            console.log(layers_list);
            for (let i in path_list) {
                book_list = book_list.concat(
                    create_book_list(path_list[i], layers_list[i])
                );
            }

            book_list = [...new Set(book_list)]; //消除重複
            console.log(book_list);
            sql_where();
        });

        selectDirBtn.addEventListener("click", (event) => {
            ipcRenderer.send("open-file-dialog");
        });

        ipcRenderer.on("selected-directory", (event, dir) => {
            console.log(dir);
            path_list.push(dir[0]);
            path_list = [...new Set(path_list)]; //消除重複
            global.dir.dir = path_list;
            path.innerHTML = "";
            for (let i in path_list) {
                path.innerHTML += `
                <div class="layers">
                <h1>${path_list[i]}</h1>
                <select>
                <option value="1">選擇要深入的層數，預設是1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                </select></div>`;
            }
        });
    }

    template();

    if (fs.existsSync(local_db_path)) {
        db = new sqlite3.Database(local_db_path);
        if (global.setting.update && path_list.length) {
            let body = document.getElementById("body");
            body.innerHTML =
                "<h1>請稍待，等待時間取決於需要搜尋的資料夾大小</h1>" +
                body.innerHTML;
            setTimeout(() => update_db(), 2000);
        } else {
            module.exports.to_home();
        }
    } else {
        let body = document.getElementById("body");
        body.innerHTML =
            "<h1>請按「選擇目錄」選擇存放本子的資料夾，選擇的資料夾會在下方列出</h1>" +
            "<h1>當選擇完成後按「開始處理」便會開始將本子歸檔</h1>" +
            body.innerHTML;
        insert();
    }
}

module.exports = {
    create_init_html: create_init_html,
    to_home: null,
};
