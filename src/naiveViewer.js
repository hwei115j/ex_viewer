/*jshint esversion: 8 */
const { ipcRenderer } = require("electron");
const Viewer = require("viewerjs");
const ImageCache = require("../cache.js"); // 修正快取模組路徑

let viewer = null;
let element = null;
let sizeWidth = 0;

let book_id;
let img_id;
let group;
let uiLanguage;
let globalHotkeys;
let viewHotkeys;
let bookInfo = null; // 存儲當前書本的信息 {length, names, filePaths}

// 初始化快取
let imageCache = new ImageCache({
    sameGroupPreloadCount: 3,  // 同一資料夾往前往後快取3張
    otherGroupPreloadCount: 2,  // 其他資料夾往前往後快取1個
    firstPageWindowSize: 1,     // 第一頁時的窗口大小
    maxRetries: 3,              // 最大重試次數
    retryDelay: 1000            // 重試間隔
});

function eventEnable() {
    window.onkeydown = hotkeyHandle;
    window.onwheel = mouse;
    window.onresize = image_view;
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        const selectedText = window.getSelection().toString();
        ipcRenderer.send('show-context-menu', {
            selectedText: selectedText,
            previousPage: true
        });
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
    // 檢查 viewer 是否為 null，若為 null 則不執行
    if (!viewer) {
        console.log("Viewer is null, skipping create_viewer");
        return;
    }
    
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

// 使用快取獲取當前頁面的圖像元素
async function getElement(pageId) {
    try {
        return await imageCache.getImageElement(book_id, pageId);
    } catch (error) {
        console.error("透過快取獲取圖片時出錯", error);
        const img = new Image();
        img.id = "pic";
        img.src = "?";
        return img;
    }
}

let viewerUpdateInProgress = false;
let pendingImgId = null;

async function image_view() {
    // 如果有更新正在進行中，記錄最新的請求並退出
    if (viewerUpdateInProgress) {
        pendingImgId = img_id;
        return;
    }
    
    viewerUpdateInProgress = true;
    
    // 現有的清理及初始化程式碼
    if (element) {
        element.onload = null;
    }
    
    if(viewer) {
        try {
            viewer.destroy();
        } catch (error) {
            console.error("銷毀舊 viewer 時出錯:", error);
        }
    }
    
    // 重置 viewer 和 element
    viewer = null;
    element = null;
    
    // 捕獲當前的 img_id，避免在等待期間被改變
    const currentImgId = img_id;
    
    try {
        // 獲取新的圖片元素
        element = await getElement(currentImgId);
        
        // 更新標題，使用書本名稱和文件名
        const fileName = bookInfo && bookInfo.names ? bookInfo.names[img_id] : `頁面 ${img_id + 1}`;
        document.title = "ex_viewer - " + group[book_id].local_name + "【" + fileName + "】";

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

        // 創建新的 viewer
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

        // 確保 viewer 已經正確創建後才調用 create_viewer
        if (element.complete && viewer) {
            create_viewer();
        } else if (viewer) {
            console.log("element is not complete, waiting for load event");
            element.onload = create_viewer;
        }
        
    } finally {
        // 完成後檢查是否有待處理的請求
        viewerUpdateInProgress = false;
        if (pendingImgId !== null && pendingImgId !== currentImgId) {
            console.log("有待處理的請求，將 img_id 更新為:", pendingImgId);
            const nextImgId = pendingImgId;
            pendingImgId = null;
            img_id = nextImgId; // 更新全域 img_id
            setTimeout(() => image_view(), 0); // 使用 setTimeout 避免遞迴調用堆疊過深
        }
    }
}

async function hotkeyHandle(event) {
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
        //setTimeout(() => image_view(), 50);
        sizeWidth = 0;
        return;
    }
    if (isKey("next_book")) {
        //路徑清單的下一個路徑
        console.log("next_book");
        book_id = (book_id + 1 == group.length) ? 0 : (book_id + 1);
        img_id = 0;
        book_scrollTop = 0;

        // 使用 IPC 獲取新的書本資訊
        await loadBookInfo().then(() => {
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

        // 使用 IPC 獲取新的書本資訊
        await loadBookInfo().then(() => {
            image_view();
        });
        return;
    }
    if (isKey("prev")) {
        //上一頁
        if (!bookInfo) return;
        img_id = img_id < 1 ? bookInfo.length - 1 : img_id - 1;
        await image_view();
        return;
    }
    if (isKey("next")) {
        //下一頁
        if (!bookInfo) return;
        img_id = img_id < bookInfo.length - 1 ? img_id + 1 : 0;
        await image_view();
        return;
    }
    if (isKey("end")) {
        //END
        if (!bookInfo) return;
        img_id = bookInfo.length - 1;
        await image_view();
        return;
    }
    if (isKey("home")) {
        //HOME
        img_id = 0;
        await image_view();
        return;
    }
    if (isKey("full_screen")) {
        //全螢幕
        console.log("full_screen");
        window.onresize = image_view;
        //setTimeout(() => image_view(), 50);
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
            let ttt = document.getElementById("ttt");
            ttt.style =
                "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            ttt.value = "Name";
            setTimeout(() => {
                ttt.style =
                    "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            }, 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    if (isKey("random_sort")) {
        ipcRenderer.send("sort", "random");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("random_sort");
            let ttt = document.getElementById("ttt");
            ttt.style =
                "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            ttt.value = "Random";
            setTimeout(() => {
                ttt.style =
                    "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            }, 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    if (isKey("chronology")) {
        ipcRenderer.send("sort", "chronology");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("chronology");
            let ttt = document.getElementById("ttt");
            ttt.style =
                "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            ttt.value = "Chronology";
            setTimeout(() => {
                ttt.style =
                    "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            }, 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    if (isKey("exit")) {
        ipcRenderer.send("exit");
        return;
    }
}

// 修改滑鼠滾輪事件處理，防止快速連續觸發
let wheelTimeout = null;
function mouse(e) {
    if (!bookInfo) return;

    // 如果已經有正在處理的滾動事件，則忽略當前滾動
    if (wheelTimeout) return;

    wheelTimeout = setTimeout(() => {
        if (e.deltaY < 0) {
            //上一頁
            img_id = img_id < 1 ? bookInfo.length - 1 : img_id - 1;
            image_view();
        } else if (e.deltaY > 0) {
            //下一頁
            img_id = img_id < bookInfo.length - 1 ? img_id + 1 : 0;
            image_view();
        }
        wheelTimeout = null;
    }, 50); // 50毫秒的節流
}

// 通過 IPC 加載書本資訊
async function loadBookInfo() {
    try {
        bookInfo = await ipcRenderer.invoke('image:getBookInfo', { index: book_id });
        console.log(`書本 ${book_id} 載入完成，共 ${bookInfo ? bookInfo.length : 0} 頁`);
        
        // 更新快取中的書本信息
        imageCache.setCurrentBookInfo(bookInfo, book_id);
        console.log(bookInfo);
        return bookInfo;
    } catch (error) {
        console.error("載入書本資訊失敗:", error);
        bookInfo = null;
        return null;
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

    loadBookInfo().then(() => {
        image_view();
    });
}

ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    book_id = data.book_id;
    img_id = data.img_id;
    page_max = data.page_max;
    group = data.group;
    uiLanguage = data.uiLanguage;
    globalHotkeys = data.globalHotkeys;
    viewHotkeys = data.viewHotkeys;

    // 初始化快取，僅設置資料夾數量
    imageCache.initialize(group.length);
    
    load_viewer();
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