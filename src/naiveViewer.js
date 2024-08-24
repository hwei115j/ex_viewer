/*jshint esversion: 6 */
const { ipcRenderer} = require("electron");
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
let group;
let uiLanguage;
let globalHotkeys;
let viewHotkeys;

function eventEnable() {
    window.onkeydown = hotkeyHandle;
    window.onwheel = mouse;
    window.onresize = image_view;
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        const selectedText = window.getSelection().toString();
        ipcRenderer.send('show-context-menu', { selectedText: selectedText })
    })
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

function hotkeyHandle(event) {
    event.preventDefault();
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

    const xMove = viewer.imageData.width / 10;
    const yMove = viewer.imageData.height / 10;
    const MF = viewer.imageData.width > document.documentElement.clientWidth;

    function isSame(list) {
        const pressedKeys = new Set();

        // 將 event 中的 keycode 加入到 pressedKeys 中
        if (event.ctrlKey) pressedKeys.add(17); // Control keycode
        if (event.shiftKey) pressedKeys.add(16); // Shift keycode
        if (event.altKey) pressedKeys.add(18); // Alt keycode
        if (event.metaKey) pressedKeys.add(91); // Meta keycode (Command on Mac)
        pressedKeys.add(event.keyCode); // 事件的 keycode
        // 先檢查組合鍵
        for (const item of list) {
            if (Array.isArray(item)) {
                if (pressedKeys.has(item[0]) && pressedKeys.has(item[1])) {
                    return true;
                }
            }
        }

        if (pressedKeys.size == 2) {
            return false;
        }
        // 再檢查單一按鍵
        for (const item of list) {
            if (!Array.isArray(item)) {
                if (pressedKeys.has(item)) {
                    return true;
                }
            }
        }

        return false;
    }
    function isKey(command) {
        for (i in globalHotkeys) {
            if (i === command) {
                return isSame(globalHotkeys[i].value);
            }
        }
        for (i in viewHotkeys) {
            if (i === command) {
                return isSame(viewHotkeys[i].value);
            }
        }
        return null;
    }

    if (isKey("move_up")) {
        move(0, yMove);
        return;
    }
    if (isKey("move_down")) {
        move(0, -yMove);
        return;
    }
    if (isKey("move_left") && MF) {
        move(xMove, 0);
        return;
    }
    if (isKey("move_right") && MF) {
        move(-xMove, 0);
        return;
    }
    if (isKey("zoom_in")) {
        window.onresize = null;
        viewer.zoom(0.1, true);
        sizeWidth = viewer.imageData.width;
        return;
    }
    if (isKey("zoom_out")) {
        window.onresize = null;
        viewer.zoom(-0.1, true);
        sizeWidth = viewer.imageData.width;
        return;
    }
    if (isKey("zoom")) {
        window.onresize = image_view;
        setTimeout(() => image_view(), 50);
        sizeWidth = 0;
        return;
    }
    if (isKey("next_book")) {
        //路徑清單的下一個路徑
        console.log("next_book");
        book_id = (book_id + 1 == group.length) ? 0 : (book_id + 1);
        img_id = 0;
        book_scrollTop = 0;
        image.init(group[book_id].local_path).then(e => {
            img = e;
            cacheObj.free();
            cacheObj = cache.init(img, img_id);
            getElement = cacheObj.getElement;
            image_view();
        });
        return;
    }
    if (isKey("prev_book")) {
        //路徑清單的上一個路徑
        console.log("prev_book");
        book_id = (book_id - 1 < 0) ? (group.length - 1) : (book_id - 1);
        img_id = 0;
        book_scrollTop = 0;

        image.init(group[book_id].local_path).then(e => {
            img = e;
            cacheObj.free();
            cacheObj = cache.init(img, img_id);
            getElement = cacheObj.getElement;
            image_view();
        });
        return;
    }
    if (isKey("prev")) {
        //上一頁
        img_id = img_id < 1 ? img.length - 1 : img_id - 1;
        image_view();
        return;
    }
    if (isKey("next")) {
        //下一頁
        img_id = img_id < img.length - 1 ? img_id + 1 : 0;

        image_view();
        return;
    }
    if (isKey("end")) {
        //END
        img_id = img.length - 1;
        image_view();
        return;
    }
    if (isKey("home")) {
        //HOME
        img_id = 0;
        image_view();
        return;
    }
    if (isKey("full_screen")) {
        //全螢幕
        console.log("full_screen");
        window.onresize = image_view;
        setTimeout(() => image_view(), 50);
        sizeWidth = 0;
        ipcRenderer.send('toggle-fullscreen');
        return;
    }
    if (isKey("back")) {
        //back
        ipcRenderer.send('put-bookStatus', { img_id: img_id, book_id: book_id });
        ipcRenderer.once('put-bookStatus-reply', (e) => {
            console.log("back");
            if (viewer) {
                viewer.destroy();
            }
            eventDisable();
            window.location.href = "book.html";
        });
        return;
    }
    if (isKey("name_sort")) {
        ipcRenderer.send("sort", "name");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("name_sort");
            book_id = data.book_id;
            group = data.group;
        });
        return;
    }
    if (isKey("random_sort")) {
        ipcRenderer.send("sort", "random");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("random_sort");
            book_id = data.book_id;
            group = data.group;
        });
        return;
    }
    if (isKey("chronology")) {
        ipcRenderer.send("sort", "chronology");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("chronology");
            book_id = data.book_id;
            group = data.group;
        });
        return;
    }
    if (isKey("exit")) {
        ipcRenderer.send("exit");
        return;
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
    //definition = data.definition;
    globalHotkeys = data.globalHotkeys;
    viewHotkeys = data.viewHotkeys;

    image.init(group[book_id].local_path).then(e => {
        img = e;
        cacheObj = cache.init(img, img_id);
        getElement = cacheObj.getElement;
        load_viewer();
    });
});

ipcRenderer.on('context-menu-command', (e, command, text) => {
    if (command === 'copy') {
        try {
            clipboard.writeText(text);
            console.log('Text copied to clipboard');
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    } else if (command === 'previousPage') {
        ipcRenderer.send('put-bookStatus', { img_id: img_id, book_id: book_id });
        ipcRenderer.once('put-bookStatus-reply', (e) => {
            console.log("back");
            if (viewer) {
                viewer.destroy();
            }
            eventDisable();
            window.location.href = "book.html";
        });
    }
});