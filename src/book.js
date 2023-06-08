/*jshint esversion: 8 */

const fs = require("fs");
const join = require("path").join;
const url = require("url");
const { remote, ipcRenderer, clipboard } = require("electron");
//const global = remote.getGlobal("sharedObject");
const dialogs = require("dialogs")();
const image = require("../image_manager");
//const Menu = remote.Menu;
//const MenuItem = remote.MenuItem;
//const { Menu, MenuItem } = remote

let book_id;
let group;
let uiLanguage;
let definition;
let page_max;
//@TODO 修改imageArray名稱
let imageArray;
let img_id = 0;
let search_str = [];

let page = 0;
//let img;
//let document;

function replace(name, text) {
    if (text) {
        return global.ui[name] ? global.ui[name] : text;
    }
    return global.ui[name] ? global.ui[name] : name;
}
function goto_page(str) {
    let p = parseInt(str);
    let len = Math.floor(imageArray.length / page_max) + 1;

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
                img_id = (p - 1) * page_max;
                updataBook();
            });
            return;
        }
        if (p == -1 && page != 0) {
            img_id = (page - 1) * page_max;
        } else if (p == -2 && page < imageArray.length / page_max - 1) {
            img_id = (page + 1) * page_max;
        } else if (p >= 0) {
            img_id = (p - 1) * page_max;
        } else return;
        updataBook();
    };
}

async function create() {
    page = Math.floor(global.img_id / page_max);
    document.documentElement.scrollTop = 0;
    document.title = "ex_viewer - " + global.group[global.book_id].local_name;

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

    function insert_template() {
        document.getElementById("body").innerHTML = `<body id="body">
        <div style="position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999">
        <input  type="button" id="ttt" style="display:none" value="" ></div>
            <div class="gm">
                <div id="gleft">
                    <div id="gd1">
                    </div>
                </div>
                <div id="gd2">
                </div>
                <div id="gright" class="ehs-introduce-box">
                </div>
                <div id="gmid">
                    <div id="gd3">
                        <div id="gdc">
                        </div>
                        <div id="gdn">
                        </div>
                        <div id="gdd">
                        </div>
                    </div>
                    <div id="gd4">
                        <div id="taglist">
                        </div>
                        <div id="tagmenu_act" style="display:none">
                            <a href="#" style="font-size:medium" onclick="goto_search()">${replace(
            "book search",
            "search"
        )}</a>
                        </div>

                    </div>
                    <div class="c"></div>
                </div>
                <div class="c"></div>
            </div>
            <div id="page">
                <p class="gpc" id="gpc"></p>
                <table class="ptt" style="margin:2px auto 0px">
                </table>
                <div id="gdt">
                </div>
                <table class="ptt" style="margin:2px auto 0px">
                </table>
                </div></body>`;
    }

    async function insert_headimg() {
        let root = {
            tag: "div",
            data: {
                style:
                    "width:250px; height:351px; background:transparent url('" +
                    (await img.gethead_async()) +
                    "') 0 0 no-repeat;background-size:contain"
            }
        };
        document.getElementById("gd1").appendChild(dom(root));
    }

    function insert_title() {
        let root = {
            tag: "div",
            data: {
                id: "gd2"
            },
            child: [
                {
                    tag: "h1",
                    data: {
                        id: "gn",
                        textContent: global.group[global.book_id].local_name
                    }
                }
            ]
        };
        if (global.group[global.book_id].title) {
            root.child.push({
                tag: "h1",
                data: {
                    id: "gn",
                    textContent: global.group[global.book_id].title
                }
            });
        }
        if (global.group[global.book_id].title_jpn) {
            root.child.push({
                tag: "h1",
                data: {
                    id: "gn",
                    textContent: global.group[global.book_id].title_jpn
                }
            });
        }
        let node = document.getElementById("gd2");
        for (let i in root.child) node.appendChild(dom(root.child[i]));
    }

    function insert_gd3() {
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
        let root = {
            tag: "div",
            data: {
                id: "gdc"
            },
            child: [
                {
                    tag: "div",
                    data: {
                        className:
                            cat[global.group[global.book_id].category][0],
                        textContent:
                            cat[global.group[global.book_id].category][1]
                    }
                }
            ]
        };
        document.getElementById("gd3").appendChild(dom(root));
    }

    function insert_tags() {
        function tags_tab() {
            //解析local.db中的tags欄位
            function db_tags(dir) {
                if (dir.tags == null) {
                    return null;
                }
                let list = dir.tags.match(
                    /[\w\ \-\.\|]+:[\w\ \-\.\|](?:,?(?![\w\ \-\.\|]+:)[\w\ \-\.\|]+)*/g
                );
                let tabs = [];
                //console.log(list);

                for (let n of list) {
                    let r = n.split(":");
                    if (!tabs[r[0]]) {
                        tabs[r[0]] = [];
                    }
                    let split = r[1].split(",");
                    for (let i in split) {
                        tabs[r[0]].push(split[i]);
                    }
                }
                return tabs;
            }

            //取得中文標籤
            function get_chinese_name(tabs, name, tag) {
                if (name == "other") {
                    return tabs[name][tag];
                }
                if (Object.keys(trans).length == 0) {
                    return tabs[name][tag];
                }
                try {
                    if (
                        trans["data"].find(obj => obj.namespace === name)["data"][tabs[name][tag]] !=
                        undefined
                    ) {
                        return trans["data"].find(obj => obj.namespace === name)["data"][tabs[name][tag]][
                            "name"
                        ];
                    }
                }
                catch {
                    return tabs[name][tag];
                }
                return tabs[name][tag];
            }

            //取得中文解釋
            function get_chinese_intro(tabs, name, tag) {
                //console.log(trans["data"].find(obj => obj.namespace === name));
                if (Object.keys(trans).length == 0) {
                    return "";
                }
                try {
                    if (
                        trans["data"].find(obj => obj.namespace === name)["data"][tabs[name][tag]] !=
                        undefined
                    ) {
                        return trans["data"].find(obj => obj.namespace === name)["data"][tabs[name][tag]][
                            "intro"
                        ];
                    }
                }
                catch {
                    return "";
                }
            }

            function get_tags_name(s1, s2) {
                if (s2.indexOf(" ") != -1) {
                    return s1 + ":" + '"' + s2 + "$" + '"';
                }
                return s1 + ":" + s2 + "$";
            }

            let tabs = db_tags(global.group[global.book_id]);
            let trans = global.definition_db;
            let root = {
                tag: "table",
                child: [
                    {
                        tag: "tbody",
                        child: []
                    }
                ]
            };
            let menuEvent = tag_name => {
                return e => {
                    const menu = new Menu();
                    menu.append(
                        new MenuItem({
                            label: replace("copy tag"),
                            click: function () {
                                console.log(tag_name);
                                clipboard.writeText(tag_name);
                            }
                        })
                    );
                    e.stopPropagation();
                    menu.popup({ window: remote.getCurrentWindow() });
                };
            };
            for (let name in tabs) {
                let tr = {
                    tag: "tr",
                    child: [
                        {
                            tag: "td",
                            data: {
                                className: "tc",
                                textContent: name + ":"
                            }
                        },
                        {
                            tag: "td",
                            oncontextmenu: null,
                            child: []
                        }
                    ]
                };
                for (let tag in tabs[name]) {
                    let tags_name = get_tags_name(name, tabs[name][tag]);
                    tr.child[1].child.push({
                        tag: "div",
                        data: {
                            className: "gt",
                            title: tags_name,
                            style: "opacity:1.0"
                        },
                        child: [
                            {
                                tag: "a",
                                data: {
                                    className: "",
                                    href: "#",
                                    id: tags_name,
                                    oncontextmenu: menuEvent(tags_name),
                                    onclick: () => {
                                        let str = "";
                                        let node = document.getElementById(
                                            "gright"
                                        );
                                        node.innerHTML = "";
                                        //console.log(tags_name);
                                        if (add(tags_name))
                                            str = get_chinese_intro(
                                                tabs,
                                                name,
                                                tag
                                            );
                                        else return;
                                        node.appendChild(
                                            dom({
                                                tag: "div",
                                                data: {
                                                    className: ""
                                                },
                                                child: [
                                                    {
                                                        tag: "div",
                                                        data: {
                                                            textContent: get_chinese_name(
                                                                tabs,
                                                                name,
                                                                tag
                                                            )
                                                        }
                                                    },
                                                    {
                                                        tag: "div",
                                                        data: {
                                                            textContent: get_tags_name(
                                                                name,
                                                                tabs[name][tag]
                                                            )
                                                        }
                                                    }
                                                ]
                                            })
                                        );
                                        node.appendChild(
                                            dom({
                                                tag: "br"
                                            })
                                        );
                                        node.appendChild(
                                            dom({
                                                tag: "div",
                                                data: {
                                                    className: ""
                                                },
                                                child: [
                                                    {
                                                        tag: "p",
                                                        data: {
                                                            textContent: str
                                                        }
                                                    }
                                                ]
                                            })
                                        );
                                    },
                                    textContent: get_chinese_name(
                                        tabs,
                                        name,
                                        tag
                                    )
                                }
                            }
                        ]
                    });
                }
                root.child[0].child.push(tr);
            }
            return root;
        }
        document.getElementById("taglist").appendChild(dom(tags_tab()));
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

            let len = Math.floor(img.length / page_max) + 1;
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
        let ptt = document.getElementsByClassName("ptt");
        ptt[0].appendChild(create_dom());
        ptt[1].appendChild(create_dom());
    }

    async function insert_form() {
        async function gdtl(count) {
            return {
                tag: "div",
                data: {
                    className: "gdtl",
                    style: "height:306px;"
                },
                child: [
                    {
                        tag: "a",
                        data: {
                            href: "#",
                            onclick: () => {
                                global.book_scrollTop =
                                    document.documentElement.scrollTop;
                                to_view(count);
                            }
                        },
                        child: [
                            {
                                tag: "img",
                                data: {
                                    style:
                                        "height:auto;width:auto;max-width:100%;max-height:100%;",
                                    loading: "lazy",
                                    alt: count,
                                    title: `Page ${count}: ${img.getname(
                                        count
                                    )}`,
                                    src: await img.getimg_async(count)
                                }
                            }
                        ]
                    }
                ]
            };
        }

        document.getElementById("gpc").textContent = `Showing ${page *
            page_max +
            1} - ${(page + 1) * page_max < img.length
                ? (page + 1) * page_max
                : img.length
            } of ${img.length} images`;
        let r = document.getElementById("page");
        let node = document.getElementById("gdt");
        let root = {
            tag: "div",
            data: {
                id: "gdt"
            },
            child: []
        };
        for (
            let i = page * page_max;
            i < img.length && i < page * page_max + page_max;
            i++
        ) {
            root.child.push(await gdtl(i));
        }
        root.child.push({
            tag: "div",
            data: {
                className: "c"
            }
        });
        r.replaceChild(dom(root), node);
    }

    function insert_key() {
        //e.preventDefault();
        window.onkeydown = e => {
            let key = e.keyCode;

            function is_key(e, str) {
                let arr = global.setting.keyboard[str];
                let key = e.keyCode;

                if (key == 33 || key == 34) return false; //去除pageup、pagedown
                for (let i in arr) {
                    if (typeof arr[i] == "number") {
                        if (key == arr[i]) {
                            return true;
                        }
                    } else {
                        if (arr[i].length == 1 && key == arr[i][0]) {
                            return true;
                        }
                        if (key == arr[i][1] && e[arr[i][0]]) {
                            return true;
                        }
                    }
                }
                return false;
            }

            if (is_key(e, "next_book")) {
                //路徑清單的下一個路徑
                global.book_id =
                    global.book_id + 1 < global.group.length
                        ? global.book_id + 1
                        : 0;
                global.img_id = 0;
                global.book_scrollTop = 0;
                create_book_html(document);
            } else if (is_key(e, "prev_book")) {
                //路徑清單的上一個路徑
                global.book_id =
                    global.book_id - 1 >= 0
                        ? global.book_id - 1
                        : global.group.length - 1;
                global.img_id = 0;
                global.book_scrollTop = 0;
                create_book_html(document);
            } else if (is_key(e, "prev")) {
                goto_page("-1")();
            } else if (is_key(e, "next")) {
                goto_page("-2")();
            } else if (is_key(e, "full_screen")) {
                global.full = !global.full;
                global.mainWindow.setFullScreen(global.full);
            } else if (is_key(e, "back")) {
                module.exports.back();
            } else if (is_key(e, "name_sort")) {
                let id = global.group[global.book_id].local_id;
                let ttt = document.getElementById("ttt");
                ttt.style =
                    "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                ttt.value = "Name";
                setTimeout(() => {
                    ttt.style =
                        "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                }, 2000);
                console.log("name_sort");

                global.group.sort((a, b) =>
                    a.local_name.localeCompare(b.local_name, "zh-Hant-TW", { numeric: true })
                );

                for (let i in global.group) {
                    if (id == global.group[i].local_id) {
                        global.book_id = parseInt(i, 10);
                        break;
                    }
                }
            } else if (is_key(e, "random_sort")) {
                //切換排序
                let id = global.group[global.book_id].local_id;
                let ttt = document.getElementById("ttt");
                ttt.style =
                    "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                ttt.value = "Random";
                setTimeout(() => {
                    ttt.style =
                        "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                }, 2000);
                console.log("Random");

                global.group.sort(() => Math.random() - 0.5);

                for (let i in global.group) {
                    if (id == global.group[i].local_id) {
                        global.book_id = parseInt(i, 10);
                        break;
                    }
                }
            } else if (is_key(e, "chronology")) {
                let id = global.group[global.book_id].local_id;
                let ttt = document.getElementById("ttt");
                ttt.style =
                    "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                ttt.value = "Chronology";
                setTimeout(() => {
                    ttt.style =
                        "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
                }, 2000);
                console.log("Chronology");
                global.group.sort((a, b) => {
                    return b.posted - a.posted;
                });

                for (let i in global.group) {
                    if (id == global.group[i].local_id) {
                        global.book_id = parseInt(i, 10);
                        break;
                    }
                }
            } else if (is_key(e, "exit")) {
                ipcRenderer.send("exit");
            }
        };
    }

    insert_template();
    insert_headimg();
    insert_title();
    insert_gd3();
    insert_tags();
    insert_ptt();
    insert_form();
    insert_key();
}

function create_book_html(docu) {
    image.init(global.group[global.book_id].local_path).then(e => {
        img = e;
        document = docu;
        window.onwheel = null;
        page = Math.floor(global.img_id / page_max);
        const menu = new Menu();
        menu.append(
            new MenuItem({
                label: replace("previous page"),
                click: function () {
                    module.exports.back();
                }
            })
        );
        document.oncontextmenu = e => {
            e.stopPropagation();
            //e.preventDefault();
            menu.popup({ window: remote.getCurrentWindow() });
        };
    });
}


function createPtt() {
    function handleClick(event) {
        let value = event.target.innerText;
        if (value == "<") {
            goto_page("-1")();
        }
        else if (value == ">") {
            goto_page("-2")();
        }
        else if (value == "1") {
            goto_page(1)();
        }
        else if (value == "...") {
            goto_page(null)();
        }
        else {
            goto_page(value)();
        }
    }

    let ptt = document.getElementsByClassName("ptt");
    let len = Math.floor(imageArray.length / page_max) + 1;
    let strHtml = "";

    if (len <= 7) {
        //7
        for (let i = 0; i < len; i++) {
            strHtml += `<td><a>${i + 1}</a></td>`
        }
    } else if (page + 1 < 7) {
        //7, ..., len
        for (let i = 0; i < 7; i++) {
            strHtml += `<td><a>${i + 1}</a></td>`;
        }
        strHtml += `<td><a>...</a></td>`;
        strHtml += `<td><a>${len}</a></td>`;
    } else if (page > len - 7) {
        //1, ..., 7
        strHtml += `<td><a>1</a></td>`;
        strHtml += `<td><a>...</a></td>`;
        for (let i = len - 7; i < len; i++) {
            strHtml += `<td><a>${i + 1}</a></td>`;
        }
    } else {
        //1, ..., 5, ..., len
        strHtml += `<td><a>1</a></td>`;
        strHtml += `<td><a>...</a></td>`;
        for (let i = page - 2; i <= page + 2; i++) {
            strHtml += `<td><a>${i + 1}</a></td>`;
        }
        strHtml += `<td><a>...</a></td>`;
        strHtml += `<td><a>${len}</a></td>`;
    }

    strHtml = `<tbody><tr></tr><td><a>&lt;</a></td>${strHtml}<td><a>&gt;</a></td></tbody></table>`
    ptt[0].innerHTML = strHtml;
    ptt[1].innerHTML = strHtml;

    //event
    let tdTags0 = ptt[0].getElementsByTagName("td");
    let tdTags1 = ptt[1].getElementsByTagName("td");
    for (let i = 0; i < tdTags0.length; i++) {
        if (tdTags0[i].getElementsByTagName("a")[0].innerText == (page + 1)) {
            tdTags0[i].classList.add("ptds");
            tdTags1[i].classList.add("ptds");
        } else {
            tdTags0[i].addEventListener("click", handleClick);
            tdTags1[i].addEventListener("click", handleClick);
        }
    }
}

function createFrom() {
    let gdt = document.getElementById("gdt");
    let strHtml = "";
    let thisPageMax = ((page + 1) * page_max < imageArray.length) ? page_max : (imageArray.length - page * page_max);

    for (let i = 0; i < thisPageMax; i++) {
        let gCount = page * page_max + i;
        strHtml += `<div class="gdtl" style="height: 306px;"><a>` +
            `<img loading="lazy" title="Page ${gCount}: ${imageArray.getname(gCount)}" src="" style="height: auto; width: auto; max-width: 100%; max-height: 100%;">` +
            `</a></div>`;
    }
    strHtml += `<div class="c"></div>`;
    gdt.innerHTML = strHtml;

    for (let i = 0; i < thisPageMax; i++) {
        let gCount = page * page_max + i;

        imageArray.getimg_async(gCount).then(url => {
            gdt.getElementsByTagName("img")[i].src = url;
        });
        gdt.getElementsByTagName("a")[i].addEventListener("click", () => {
            console.log(gCount);
        });
    }
}

function createInformation() {
    function replace(name) {
        return uiLanguage[name] ? uiLanguage[name] : name;
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

    (() => {
        let gleft = document.getElementById("gleft");
        imageArray.gethead_async().then(url => {
            gleft.innerHTML =
                `<div id="gd1"><div style="width: 250px; height: 351px; background: url(&quot;${url}&quot;) 0px 0px / contain no-repeat transparent;"></div></div>`;
        });
    })();

    (() => {
        let gd2 = document.getElementById("gd2");
        let strHtml = "";
        //@TODO 修改title 更明確資訊 
        strHtml += `<h1 id="gn" title="local name">${group[book_id].local_name}</h1>`;
        if (group[book_id].title) {
            strHtml += `<h1 id="gn" title="title">${group[book_id].title}</h1>`;
        }
        if (group[book_id].title_jpn) {
            strHtml += `<h1 id="gn" title="title jpn">${group[book_id].title_jpn}</h1>`;
        }
        gd2.innerHTML = strHtml;
    })();

    (() => {
        //解析local.db中的tags欄位
        function db_tags(dir) {
            if (dir.tags == null) {
                return null;
            }
            let list = dir.tags.match(
                /[\w\ \-\.\|]+:[\w\ \-\.\|](?:,?(?![\w\ \-\.\|]+:)[\w\ \-\.\|]+)*/g
            );
            let tabs = [];
            //console.log(list);

            for (let n of list) {
                let r = n.split(":");
                if (!tabs[r[0]]) {
                    tabs[r[0]] = [];
                }
                let split = r[1].split(",");
                for (let i in split) {
                    tabs[r[0]].push(split[i]);
                }
            }
            return tabs;
        }

        //@TODO 需要確認邊界條件
        function get_chinese_name(namespace, tag) {
            if (Object.keys(definition).length == 0) {
                return tag;
            }
            let data = definition["data"].find(obj => obj.namespace === namespace);
            if (data != undefined) {
                return (data["data"][tag] != undefined) ? data["data"][tag]["name"] : tag;
            }
            //console.log(definition["data"].find(obj => obj.namespace === namespace)["data"][tag]);
            return tag;
        }

        function get_chinese_definition(namespace, tag) {
            if (Object.keys(definition).length == 0) {
                return "";
            }
            let data = definition["data"].find(obj => obj.namespace === namespace);
            if (data != undefined) {
                return (data["data"][tag] != undefined) ? data["data"][tag]["intro"] : tag;
            }
            return "";
        }
        let tags = db_tags(group[book_id]);
        let gmid = document.getElementById("gmid");
        let strHtml = "";

        strHtml += `<div id="gd3"><div id="gdc"></div><div id="gdn"></div><div id="gdd"></div><div id="gdc">` +
            `<div class="${cat[group[book_id].category][0]}">${cat[group[book_id].category][1]}</div></div></div>`;

        strHtml += `<div id="gd4"><div id="taglist"><table><tbody>`;

        for (let name in tags) {
            strHtml += `<tr><td class="tc">${name}:</td><td>`
            //console.log(tags[name]);
            for (let i in tags[name]) {
                let tag = tags[name][i];
                strHtml += `<div class="gt" title="${name}:${tag}$" style="opacity: 1;">` +
                    `<a data-namespace="${name}" data-tag="${tag}">${get_chinese_name(name, tag)}</a></div>`;
            }
            strHtml += `</div></td></tr>`;
        }

        strHtml += `</tbody></table></div><div id="tagmenu_act" style="display:none"><a href="#" style="font-size:medium" >搜尋</a></div></div>`

        gmid.innerHTML = strHtml

        let gt = gmid.getElementsByClassName("gt")

        for (let i = 0; i < gt.length; i++) {
            let a = gt[i].getElementsByTagName("a")[0];
            let name = a.getAttribute("data-namespace");
            let tag = a.getAttribute("data-tag");
            a.addEventListener("click", () => {
                if (a.style.color == "blue") {
                    a.style.color = "";
                    document.getElementById("gright").innerHTML = "";
                } else {
                    a.style.color = "blue";
                    document.getElementById("gright").innerHTML =
                        `<div><div>${get_chinese_name(name, tag)}</div><div>${name}:"${tag}$"</div></div>` +
                        `<br><div><p>${get_chinese_definition(name, tag)}</p></div></br>`;
                }
                let index = search_str.indexOf(`${name}:"${tag}$"`);
                if (index !== -1) {
                    search_str.splice(index, 1);
                } else {
                    search_str.push(`${name}:"${tag}$"`);
                }
                document.getElementById("tagmenu_act").style = search_str.length
                    ? ""
                    : "display: none";
                //console.log(i, name, tag, get_chinese_definition(name, tag));
                console.log(search_str.join(" "));
            });
        }

    })();
}

function updataBook() {
    page = Math.floor(img_id / page_max);
    document.title = "ex_viewer - " + group[book_id].local_name;

    document.getElementById("gpc").textContent =
        `Showing ${page * page_max + 1} - ${((page + 1) * page_max < imageArray.length)
            ? ((page + 1) * page_max)
            : imageArray.length} of ${imageArray.length} images`;
    createPtt();
    createInformation();
    createFrom();
}


ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    book_id = data.book_id,
        img_id = data.img_id,
        page_max = data.page_max;
    group = data.group;
    uiLanguage = data.uiLanguage;
    definition = data.definition;
    image.init(group[book_id].local_path).then(e => {
        imageArray = e;
        /*
        const menu = new Menu();
        menu.append(
            new MenuItem({
                label: replace("previous page"),
                click: function () {
                    module.exports.back();
                }
            })
        );
        document.oncontextmenu = e => {
            e.stopPropagation();
            //e.preventDefault();
            menu.popup({ window: remote.getCurrentWindow() });
        };
        */
        updataBook();
    });
});
