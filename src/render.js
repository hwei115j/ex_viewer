/*jshint esversion: 6 */
const home = require("../home.js");
const book = require("../book.js");
const view = require("../view.js");
const init = require('../init.js');
const {
    webFrame
} = require("electron");
const global = require("electron").remote.getGlobal("sharedObject");
const remote = require("electron").remote;
var search_str = [];

function to_home() {
    document.title = "ex_view";
    home.create_home_html(document);
    document.oncontextmenu = null;
    global.book_scrollTop = 0;
    document.documentElement.scrollTop = global.home_scrollTop;
    global.img_id = 0;
}

function to_book() {
    search_str = [];
    document.oncontextmenu = null;
    book.create_book_html(document);
    document.documentElement.scrollTop = global.book_scrollTop;
    document.getElementsByTagName("body")[0].style = "";
}

function to_view(gid) {
    global.img_id = gid;
    view.create_html_view(document);
}

document.addEventListener("DOMContentLoaded", event => {
    fu = to_view;
    init.to_home = book.back = to_home;
    view.back = to_book;
    webFrame.setZoomFactor(global.setting.zoom);
    init.create_init_html(document);
    //home.create_home_html(document);
});

/*
function select_page(title, len, func) {
    window.removeEventListener("keydown", func, false);
    dialogs.prompt(title, ok => {
        window.addEventListener("keydown", func, false);
        let p = parseInt(ok);
        if(isNaN(p)) return ;
        if(p > len) return ;
        if(p < 1) return ;
        goto_page(p-1);
    });
}
*/
function add(id) {
    let n = document.getElementById(id);
    //id = id.split(":")[1];

    if (n.style.color == "blue") {
        n.style.color = "";
        if (search_str.indexOf(id) != -1) {
            search_str.splice(search_str.indexOf(id), 1);
        }
    } else {
        n.style.color = "blue";
        if (search_str.indexOf(id) == -1) {
            search_str.push(id);
        }
    }

    document.getElementById("tagmenu_act").style = search_str.length ? "" : "display: none";
    console.log(search_str);
    return n.style.color == "blue";
}

function goto_search() {
    to_home();
    home.search(search_str.toString().replace(/,/g, " AND "));
}

/*
let menu = new Menu(); //new一个菜单

//添加菜单功能
menu.append(new MenuItem({label:'複製', role: 'copy' }));
menu.append(new MenuItem({label:'貼上', role: 'paste' }));

window.addEventListener(
    "contextmenu",
    function(e) {
        e.preventDefault();
        menu.popup(remote.getCurrentWindow());
    },
    false
);
*/