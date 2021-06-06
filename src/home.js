/*jshint esversion: 8 */
const { remote, ipcRenderer, shell, clipboard } = require("electron");
const global = remote.getGlobal("sharedObject");
const { Menu, MenuItem } = remote;
const join = require("path").join;
const sqlite3 = require("sqlite3").verbose();
const dialogs = require("dialogs")();
const image = require("./image_manager");

const local_db_path = join(".", "setting", "local", "local.db");

let db;
let page_max = global.setting.home_max;
let page = 0;
let document = module.exports.docu;
let search_str = "";

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
function replace(name, text) {
    if (text) {
        return global.ui[name] ? global.ui[name] : text;
    }
    return global.ui[name] ? global.ui[name] : name;
}
function goto_page(str) {
    let p = parseInt(str);
    let len = Math.floor(global.group.length / page_max) + 1;

    return () => {
        if (isNaN(p)) {
            let reg = window.onkeydown;
            window.onkeydown = null;
            dialogs.prompt(`Jump to page: (1-${len})`, ok => {
                window.onkeydown = reg;
                let p = parseInt(ok);
                if (isNaN(p)) return;
                if (p > len) return;
                if (p < 1) return;
                global.book_id = (p - 1) * page_max;
                create_home();
            });
            return;
        }
        if (p == -1 && page != 0) {
            global.book_id = (page - 1) * page_max;
        } else if (p == -2 && page < global.group.length / page_max - 1) {
            global.book_id = (page + 1) * page_max;
        } else if (p >= 0) {
            global.book_id = (p - 1) * page_max;
        }
        create_home();
    };
}

function search(input) {
    global.book_id = 0;
    global.key_flag = false;
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
            if (token[scount] == ".null") {
                scount++;
                flag = 0;
                return " gid ISNULL";
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
        console.log(sql);
        db.serialize(() => {
            db.all(sql, [], (err, rows) => {
                if (err != null) {
                    console.log(err);
                }
                global.group = rows;
                global.group.sort((a, b) =>
                    a.local_name.localeCompare(b.local_name, "zh-Hant-TW")
                );
                create_home();
                search_str = input;
                document.getElementById("f_search").value = search_str;
                document.getElementById("f_search").focus();
            });
        });
    } catch (err) {
        console.log(err);
        search_str = input;
        document.getElementById("f_search").value = search_str;
        document.getElementById("f_search").focus();
        return;
    }
}

function create_home() {
    page = Math.floor(global.book_id / page_max);
    document.documentElement.scrollTop = 0;

    function dom(obj) {
        let r = document.createElement(obj.tag);
        for (let i in obj.data) {
            if (obj.data[i]) r[i] = obj.data[i];
        }
        for (let i in obj.child) {
            let c = dom(obj.child[i]);
            r.appendChild(c);
        }
        return r;
    }

    function template() {
        document.getElementById(
            "body"
        ).innerHTML = `<div id="ido" class="ido" style="max-width:1370px">
		<div style="position:relative; z-index:2">
			<div id="searchbox" class="idi">
				<form id="from_onsubmit" style="margin: 0px; padding: 0px;">
					<input type="hidden" id="f_cats" name="f_cats" value="0" disabled="disabled">
					<table class="itc">
						<tbody>
							<tr>
								<td>
									<div id="cat_2" class="cs ct2">
										${replace("Doujinshi")}
									</div>
								</td>
								<td>
									<div id="cat_4" class="cs ct3">
										${replace("Manga")}
									</div>
								</td>
								<td>
									<div id="cat_8"  class="cs ct4">
										${replace("Artist CG")}
									</div>
								</td>
								<td>
									<div id="cat_16" class="cs ct5">
										${replace("Game CG")}
									</div>
								</td>
								<td>
									<div id="cat_512" class="cs cta">
										${replace("Western")}
									</div>
								</td>
							</tr>
							<tr>
								<td>
									<div id="cat_256" class="cs ct9" >
										${replace("Non-H")}
									</div>
								</td>
								<td>
									<d iv="" id="cat_32" class="cs ct6">
										${replace("Image Set")}
									</d>
								</td>
								<td>
									<div id="cat_64" class="cs ct7">
										${replace("Cosplay")}
									</div>
								</td>
								<td>
									<div id="cat_128" class="cs ct8">
										${replace("Asian Porn")}
									</div>
								</td>
								<td>
									<div id="cat_1" class="cs ct1">
										${replace("Misc")}
									</div>
								</td>
							</tr>
						</tbody>
					</table>
					<p class="nopm">
						<input type="text" id="f_search" name="f_search" placeholder=${replace(
                            "search text"
                        )} size="50" maxlength="200" autocomplete="off">
						<input type="submit" value=${replace("search")}>
						<input type="button" value=${replace(
                            "clear"
                        )} onclick="document.getElementById('f_search').value = ''">
					</p>
					<div id="advdiv" style="display: none;"></div>
				</form>
			</div>
			<table class="ptt" style="margin:2px auto 0px">
			</table>
			<div id="page">	
			</div>
			<table class="ptt" style="margin:2px auto 0px">
			</table>
		    </div>
	    </div>`;
    }

    function insert_form() {
        let f_search = document.getElementById("f_search");
        let from_onsubmit = document.getElementById("from_onsubmit");
        let reg;
        let menuEvent = obj => {
            return e => {
                const menu = new Menu();

                menu.append(
                    new MenuItem({
                        label: replace("copy"),
                        click: function() {
                            clipboard.writeText(obj.title);
                        }
                    })
                );
                e.stopPropagation();
                menu.popup({ window: remote.getCurrentWindow() });
            };
        };

        f_search.oncontextmenu = e => {
            const menu = new Menu();
            menu.append(
                new MenuItem({
                    label: replace("paste"),
                    role: "paste"
                })
            );
            e.stopPropagation();
            menu.popup({ window: remote.getCurrentWindow() });
        };
        from_onsubmit.onsubmit = () => {
            search(f_search.value);
            return false;
        };
        f_search.value = search_str;
        f_search.onfocus = () => {
            reg = window.onkeydown;
            window.onkeydown = null;
        };
        f_search.onblur = () => {
            window.onkeydown = reg;
        };
    }

    async function insert_page() {
        async function node(onclick, title, src, category, date, filecount) {
            let root = {
                tag: "div",
                data: {
                    className: "gl1t",
                    oncontextmenu: menuEvent({ path: src, title: title })
                },
                child: []
            };
            root.child.push({
                tag: "a",
                data: {
                    onclick: onclick
                },
                child: [
                    {
                        tag: "div",
                        data: {
                            className: "gl4t glname glink",
                            textContent: title
                        }
                    }
                ]
            });
            root.child.push({
                tag: "div",
                data: {
                    className: "gl3t",
                    style: "height:auto;width:250px",
                    textContent: ""
                },
                child: [
                    {
                        tag: "a",
                        data: {
                            onclick: onclick
                        },
                        child: [
                            {
                                tag: "img",
                                data: {
                                    style:
                                        "height:auto;width:auto;max-width:100%;max-height:100%",
                                    loading: "auto",
                                    title: title,
                                    alt: title,
                                    src: await image.getheadAsync(src)
                                }
                            }
                        ]
                    }
                ]
            });
            root.child.push({
                tag: "div",
                data: {
                    className: "gl5t"
                },
                child: [
                    {
                        tag: "div",
                        child: [
                            {
                                tag: "div",
                                data: {
                                    className: category[0],
                                    textContent: category[1]
                                }
                            },
                            {
                                tag: "div",
                                data: {
                                    className: "glnew",
                                    textContent: date
                                }
                            }
                        ]
                    },
                    {
                        tag: "div",
                        child: [
                            {
                                tag: "div"
                            },
                            {
                                tag: "div",
                                data: {
                                    textContent: filecount
                                }
                            }
                        ]
                    }
                ]
            });

            return dom(root);
        }

        function fa(gid) {
            let date = "null";
            if (global.group[gid]["posted"] != null) {
                let dd = new Date(parseInt(global.group[gid]["posted"]) * 1000);
                date =
                    dd.toISOString().split("T")[0] +
                    " " +
                    dd
                        .toISOString()
                        .split("T")[1]
                        .substr(0, 5);
            }
            return date;
        }

        let cat = {
            Doujinshi: ["cs ct2", replace("Doujinshi")],
            Manga: ["cs ct3", replace("Manga")],
            "Artist CG": ["cs ct4", replace("Artist CG")],
            "Game CG": ["cs ct5", replace("Game CG")],
            Western: ["cs cta", replace("Western")],
            "Non-H": ["cs ct9", replace("Non-H")],
            "Image Set": ["cs ct6", replace("Image Set")],
            Cosplay: ["cs ct7", replace("Cosplay")],
            "Asian Porn": ["cs ct8", replace("Asian Porn")],
            Misc: ["cs ct1", replace("Misc")],
            null: ["cs ct1", replace("null")]
        };

        let root = dom({
            tag: "div",
            data: {
                className: "itg gld"
            },
            child: []
        });

        let menuEvent = obj => {
            return e => {
                const menu = new Menu();
                menu.append(
                    new MenuItem({
                        label: replace("open"),
                        click: function() {
                            shell.openPath(obj.path);
                        }
                    })
                );
                menu.append(
                    new MenuItem({
                        label: replace("copy"),
                        click: function() {
                            clipboard.writeText(obj.title);
                        }
                    })
                );
                e.stopPropagation();
                menu.popup({ window: remote.getCurrentWindow() });
            };
        };
        for (
            let i = page * page_max;
            i < global.group.length && i < page * page_max + page_max;
            i++
        ) {
            if (image.isbook(global.group[i].local_path)) {
                root.appendChild(
                    await node(
                        (function(gid) {
                            return () => {
                                global.book_id = gid;
                                global.home_scrollTop =
                                    document.documentElement.scrollTop;
                                document.documentElement.scrollTop = 0;
                                to_book();
                            };
                        })(i),
                        global.group[i].local_name,
                        global.group[i].local_path,
                        cat[global.group[i]["category"]],
                        fa(i),
                        global.group[i]["filecount"] + " pages"
                    )
                );
            }
        }

        let p = document.getElementById("page");
        p.appendChild(root);
    }

    function insert_ptt() {
        function create_dom() {
            function _dom(text, onclick, css) {
                return {
                    tag: "td",
                    data: {
                        className: css,
                        onclick: onclick
                    },
                    child: [
                        {
                            tag: "a",
                            data: {
                                textContent: text
                            }
                        }
                    ]
                };
            }

            function ispage(i) {
                tr.push(
                    i == page
                        ? _dom(i + 1, null, "ptds")
                        : _dom(i + 1, goto_page(i + 1))
                );
            }

            let len = Math.floor(global.group.length / page_max) + 1;
            let root = {
                tag: "tbody",
                child: [
                    {
                        tag: "tr"
                    }
                ]
            };
            let tr = root.child;

            tr.push(_dom("<", goto_page("-1")));
            if (len < 7) {
                //7
                for (let i = 0; i < len; i++) ispage(i);
            } else if (page + 1 < 7) {
                //7, ..., len
                for (let i = 0; i < 7; i++) ispage(i);
                tr.push(_dom("...", goto_page(null)));
                tr.push(_dom(len, goto_page(len)));
            } else if (page > len - 7) {
                //1, ..., 7
                tr.push(_dom("1", goto_page(1)));
                tr.push(_dom("...", goto_page(null)));
                for (let i = len - 7; i < len; i++) ispage(i);
            } else {
                //1, ..., 5, ..., len
                tr.push(_dom("1", goto_page(1)));
                tr.push(_dom("...", goto_page(null)));
                for (let i = page - 2; i <= page + 2; i++) ispage(i);
                tr.push(_dom("...", goto_page(null)));
                tr.push(_dom(len, goto_page(len)));
            }
            tr.push(_dom(">", goto_page("-2")));
            //console.log(root);
            return dom(root);
        }
        create_dom();
        let ptt = document.getElementsByClassName("ptt");
        ptt[0].appendChild(create_dom());
        ptt[1].appendChild(create_dom());
    }

    function insert_key() {
        window.onkeydown = e => {
            //e.preventDefault();

            function is_key(e, str) {
                let arr = global.setting.keyboard[str];
                let key = e.keyCode;

                if (key == 33 || key == 34) return false; //去除pageup、pagedown
                for (let i in arr) {
                    if (typeof arr[i] == "number") {
                        if (key == arr[i]) return true;
                    } else {
                        //console.log("aaa " + arr[i][0]);
                        if (key == arr[i][1] && e[arr[i][0]]) return true;
                    }
                }
                return false;
            }

            if (is_key(e, "prev")) {
                goto_page("-1")();
            } else if (is_key(e, "next")) {
                goto_page("-2")();
            } else if (is_key(e, "full_screen")) {
                global.full = !global.full;
                global.mainWindow.setFullScreen(global.full);
            } else if (is_key(e, "exit")) {
                ipcRenderer.send("exit");
            }
        };
    }

    function insert_cat() {
        function func(id) {
            let c = {
                cat_2: "Doujinshi",
                cat_4: "Manga",
                cat_8: "Artist CG",
                cat_16: "Game CG",
                cat_512: "Western",
                cat_256: "Non-H",
                cat_32: "Image Set",
                cat_64: "Cosplay",
                cat_128: "Asian Porn",
                cat_1: "Misc"
            };
            let r = document.getElementById(id);
            r.setAttribute("data-disabled", 1);

            if (category.indexOf(c[id]) > -1) {
                r.removeAttribute("data-disabled");
            }

            return () => {
                if (r.getAttribute("data-disabled")) {
                    r.removeAttribute("data-disabled");
                    category.push(c[id]);
                } else {
                    r.setAttribute("data-disabled", 1);
                    let index = category.indexOf(c[id]);
                    category.splice(index, 1);
                }
            };
        }
        document.getElementById("cat_1").onclick = func("cat_1");
        document.getElementById("cat_2").onclick = func("cat_2");
        document.getElementById("cat_4").onclick = func("cat_4");
        document.getElementById("cat_8").onclick = func("cat_8");
        document.getElementById("cat_16").onclick = func("cat_16");
        document.getElementById("cat_32").onclick = func("cat_32");
        document.getElementById("cat_64").onclick = func("cat_64");
        document.getElementById("cat_128").onclick = func("cat_128");
        document.getElementById("cat_256").onclick = func("cat_256");
        document.getElementById("cat_512").onclick = func("cat_512");
    }

    template();
    insert_form();
    insert_page();
    insert_ptt();
    insert_key();
    insert_cat();

    /*
    let img = image.init(global.group[0].local_path);
    console.log(img.gethead());
    */
}

function create_home_html(docu) {
    document = docu;

    if (global.group) {
        create_home();
    } else {
        db = new sqlite3.Database(local_db_path);
        search(search_str);
    }
}

module.exports = {
    create_home_html: create_home_html,
    search: search
};
