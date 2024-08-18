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
            ipcRenderer.send('put-homeStatus', {img_id: gCount});
            ipcRenderer.once('put-homeStatus-reply', (event, data) => {
                console.log(gCount);
            });
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

        strHtml += `</tbody></table></div><div id="tagmenu_act" style="display:none"><a id="tagmenu_act_a" href="#" style="font-size:medium">
        ${replace(
            "book search",
            "search"
        )}</a></div></div>`

        gmid.innerHTML = strHtml;

        gmid.getElementById
        console.log(gmid.getElementsByClassName("gt"));
        //console.log(gmid.getElementById("tagmenu_act-a"));
        gmid.querySelector("#tagmenu_act_a").onclick = () => {
            console.log("1");
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
            ipcRenderer.send("put-search", { str: search_str.join(" "), category: category });
            ipcRenderer.on("put-search-reply", (event, data) => {
                window.location.href = "home.html";
            });

        };
        let gt = gmid.getElementsByClassName("gt")

        for (let i = 0; i < gt.length; i++) {
            let tagNode = gt[i].getElementsByTagName("a")[0];
            let dataNamespace = tagNode.getAttribute("data-namespace");
            let dataTag = tagNode.getAttribute("data-tag");
            tagNode.addEventListener("click", () => {
                if (tagNode.style.color == "blue") {
                    tagNode.style.color = "";
                    document.getElementById("gright").innerHTML = "";
                } else {
                    tagNode.style.color = "blue";
                    //tag中文解釋
                    document.getElementById("gright").innerHTML =
                        `<div><div>${get_chinese_name(dataNamespace, dataTag)}</div><div>${dataNamespace}:"${dataTag}$"</div></div>` +
                        `<br><div><p>${get_chinese_definition(dataNamespace, dataTag)}</p></div></br>`;
                }
                let index = search_str.indexOf(`${dataNamespace}:"${dataTag}$"`);
                if (index !== -1) {
                    search_str.splice(index, 1);
                } else {
                    search_str.push(`${dataNamespace}:"${dataTag}$"`);
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
