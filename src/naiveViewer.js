/*jshint esversion: 6 */
const { ipcRenderer, remote } = require("electron");
const cache = require("../cache.js");
const image = require("../image_manager.js");
const Viewer = require("viewerjs");
let getElement;
let img;
let cacheObj;
let viewer = null;
let element = null;
let sizeWidth = 0;

let book_id;
let img_id;
let page_max;
let group;
let uiLanguage;
let definition;

function eventEnable() {
    window.onkeydown = key_word;
    window.onwheel = mouse;
    window.onresize = image_view;
}

function eventDisable() {
    window.onkeydown = null;
    window.onwheel = null;
    window.onresize = null;
}
function getTranslation(name) {
    return uiLanguage[name] ? uiLanguage[name] : name;
}
function create_viewer() {
    viewer.show(true);
    let naturalHeight = viewer.imageData.naturalHeight;
    let naturalWidth = viewer.imageData.naturalWidth;
    let clientHeight = document.documentElement.clientHeight - 3;
    let clientWidth = document.documentElement.clientWidth - 3;

    if (sizeWidth) {
        viewer.zoomTo(sizeWidth / naturalWidth);
    } else if (clientHeight / clientWidth >= naturalHeight / naturalWidth) {
        viewer.zoomTo(clientWidth / naturalWidth);
    } else {
        viewer.zoomTo(clientHeight / naturalHeight);
    }
    viewer.moveTo(viewer.imageData.x, 0);
}

function image_view() {
    if (viewer) viewer.destroy();
    if (element) element.onload = null;
    viewer = element = null;
    element = getElement(img_id);

    document.title = "ex_viewer - " + group[book_id].local_name + "【" + img.getname(img_id) + "】";
    if (img_id == 0) {
        let ttt = document.getElementById("ttt");
        ttt.style =
            "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        ttt.value = getTranslation("first page");
        setTimeout(() => {
            ttt.style =
                "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        }, 700);
    } else {
        let ttt = document.getElementById("ttt");
        ttt.style =
            "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
    }

    viewer = new Viewer(element, {
        backdrop: false,
        navbar: false,
        title: false,
        toolbar: false,
        fullscreen: true,
        transition: false,
        button: false,
        loading: false,
        keyboard: false,
        zoomOnWheel: false,
        toggleOnDblclick: false,
        viewed() {
            window.removeEventListener("resize", viewer.onResize);
            document.removeEventListener("pointermove", viewer.onPointerMove);
        }
    });

    if (element.complete) {
        create_viewer();
    } else {
        element.onload = create_viewer;
    }
}

function key_word(e) {
    e.preventDefault();
    function move(x, y) {
        let clienWidth = document.documentElement.clientWidth;
        let clienHeight = document.documentElement.clientHeight;
        let width = viewer.imageData.width;
        let height = viewer.imageData.height;
        let min_x = clienWidth - width;
        let max_x = 0;
        let min_y = clienHeight - height;
        let max_y = 0;
        let img_x = viewer.imageData.x;
        let img_y = viewer.imageData.y;

        if (max_x <= min_x) {
        } else if (img_x + x >= min_x && img_x + x <= max_x) {
            viewer.move(x, 0);
        } else if (img_x + x < min_x) {
            viewer.moveTo(min_x, img_y);
        } else if (img_x + x > max_x) {
            viewer.moveTo(max_x, img_y);
        }
        if (max_y <= min_y) {
        } else if (img_y + y >= min_y && img_y + y <= max_y) {
            viewer.move(0, y);
        } else if (img_y + y < min_y) {
            viewer.moveTo(img_x, min_y);
        } else if (img_y + y > max_y) {
            viewer.moveTo(img_x, max_y);
        }
    }
    function is_key(str) {
        let arr = setting.keyboard[str];
        let key = e.keyCode;

        for (let i in arr) {
            if (typeof arr[i] == "number" && !e.ctrlKey) {
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

    const xMove = viewer.imageData.width / 10;
    const yMove = viewer.imageData.height / 10;
    const MF = viewer.imageData.width > document.documentElement.clientWidth;

    if (is_key("move_up")) {
        move(0, yMove);
    } else if (is_key("move_down")) {
        move(0, -yMove);
    } else if (is_key("move_left") && MF) {
        move(xMove, 0);
    } else if (is_key("move_right") && MF) {
        move(-xMove, 0);
    } else if (is_key("zoom_in")) {
        window.onresize = null;
        viewer.zoom(0.1, true);
        sizeWidth = viewer.imageData.width;
    } else if (is_key("zoom_out")) {
        window.onresize = null;
        viewer.zoom(-0.1, true);
        sizeWidth = viewer.imageData.width;
    } else if (is_key("zoom")) {
        window.onresize = image_view;
        setTimeout(() => image_view(), 50);
        sizeWidth = 0;
    } else if (is_key("next_book")) {
        //路徑清單的下一個路徑
        book_id =
            book_id + 1 < group.length ? book_id + 1 : 0;
        group[book_id] = group[book_id];
        img_id = 0;
        book_scrollTop = 0;
        image.init(group[book_id].local_path).then(e => {
            img = e;
            cacheObj.free();
            cacheObj = cache.init(img, img_id);
            getElement = cacheObj.getElement;
            image_view();
        });
    } else if (is_key("prev_book")) {
        //路徑清單的上一個路徑
        book_id =
            book_id - 1 >= 0
                ? book_id - 1
                : group.length - 1;
        group[book_id] = group[book_id];
        img_id = 0;
        book_scrollTop = 0;
        image.init(group[book_id].local_path).then(e => {
            img = e;
            cacheObj.free();
            cacheObj = cache.init(img, img_id);
            getElement = cacheObj.getElement;
            image_view();
        });
    } else if (is_key("prev")) {
        //上一頁
        img_id = img_id < 1 ? img.length - 1 : img_id - 1;
        image_view();
    } else if (is_key("next")) {
        //下一頁
        img_id = img_id < img.length - 1 ? img_id + 1 : 0;
        image_view();
    } else if (is_key("end")) {
        //END
        img_id = img.length - 1;
        image_view();
    } else if (is_key("home")) {
        //HOME
        img_id = 0;
        image_view();
    } else if (is_key("full_screen")) {
        //全螢幕
        full = !full;
        window.onresize = image_view;
        mainWindow.setFullScreen(full);
        setTimeout(() => image_view(), 50);
        sizeWidth = 0;
    } else if (is_key("back")) {
        //back
        if (viewer) viewer.destroy();
        eventDisable();
        module.exports.back();
    } else if (is_key("name_sort")) {
        let id = group[book_id].local_id;

        console.log(group);
        let ttt = document.getElementById("ttt");
        ttt.style =
            "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        ttt.value = "Name";
        setTimeout(() => {
            ttt.style =
                "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        }, 2000);

        group.sort((a, b) =>
            a.local_name.localeCompare(b.local_name, "zh-Hant-TW", { numeric: true })
        );

        for (let i in group) {
            if (id == group[i].local_id) {
                book_id = parseInt(i, 10);
                break;
            }
        }
    } else if (is_key("random_sort")) {
        //切換排序
        let id = group[book_id].local_id;
        let ttt = document.getElementById("ttt");
        ttt.style =
            "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        ttt.value = "Random";
        setTimeout(() => {
            ttt.style =
                "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        }, 2000);
        group.sort(() => Math.random() - 0.5);

        for (let i in group) {
            if (id == group[i].local_id) {
                book_id = parseInt(i, 10);
                break;
            }
        }
    } else if (is_key("chronology")) {
        let id = group[book_id].local_id;

        let ttt = document.getElementById("ttt");
        ttt.style =
            "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        ttt.value = "Chronology";
        setTimeout(() => {
            ttt.style =
                "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
        }, 2000);
        group.sort((a, b) => {
            return b.posted - a.posted;
        });

        for (let i in group) {
            if (id == group[i].local_id) {
                book_id = parseInt(i, 10);
                break;
            }
        }
    } else if (is_key("exit")) {
        ipcRenderer.send("exit");
    }
}

function mouse(e) {
    if (e.deltaY < 0) {
        //上一頁
        img_id = img_id < 1 ? img.length - 1 : img_id - 1;
        image_view();
    } else if (e.deltaY > 0) {
        //下一頁
        img_id = img_id < img.length - 1 ? img_id + 1 : 0;
        image_view();
    }
}

function create_html_view(document) {
    eventEnable();
    //window.onresize = create_viewer;
    let body = document.getElementsByTagName("body");
    //body[0].style = "overflow:hidden";
    body[0].innerHTML =
        `<div id="imup" style="overflow:hidden"></div><div id="im"><div id="div" style="position: relative;margin:0px auto"><img id="pic"></div></div>` +
        `<div style="position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999">
        <input  type="button" id="ttt" style="display:none" value="第一頁" ></div>`;
    html = document.getElementById("im");
    image.init(group[book_id].local_path).then(e => {
        img = e;
        cacheObj = cache.init(img, img_id);
        getElement = cacheObj.getElement;
        image_view();
    });
}

function load_viewer() {
    eventEnable();
    let body = document.getElementsByTagName("body");
    body[0].innerHTML =
        `<div id="imup" style="overflow:hidden"></div><div id="im"><div id="div" style="position: relative;margin:0px auto"><img id="pic"></div></div>` +
        `<div style="position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999">
        <input  type="button" id="ttt" style="display:none" value="第一頁" ></div>`;
    html = document.getElementById("im");
    image_view();
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
        img = e;
        cacheObj = cache.init(img, img_id);
        getElement = cacheObj.getElement;
        load_viewer();
    });
});