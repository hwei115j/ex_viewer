/*jshint esversion: 8 */
const dialogs = require("dialogs")();
const { webFrame } = require('electron');
const { ipcRenderer, clipboard } = require("electron");
//window.$ = window.jQuery = require('jquery');

let page = 0;
let uiLanguage;
let page_max;
let groupLength;
let book_id;
let search_str;
let group;
let globalHotkeys;
let homeHotkeys;
let historyList;
let definition;

const defineCategory = [
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
let category;

function goto_page(str) {
    let p = parseInt(str);
    let len = Math.floor(groupLength / page_max) + 1;

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
                book_id = (p - 1) * page_max;
                updateHome();
                //ipcRenderer.send('get-pageStatus', book_id);
                return;
            });
            return;
        }
        if (p == -1 && page != 0) {
            book_id = (page - 1) * page_max;
        } else if (p == -2 && page < groupLength / page_max - 1) {
            book_id = (page + 1) * page_max;
        } else if (p >= 0) {
            book_id = (p - 1) * page_max;
        }
        updateHome();
        //ipcRenderer.send('get-pageStatus', book_id);
    };
}

function replace(name) {
    return uiLanguage[name] ? uiLanguage[name] : name;
}

function get_chinese_name(namespace, tag) {
    // 檢查標籤翻譯開關
    if (setting && setting.value && setting.value.tag_translate && !setting.value.tag_translate.value) {
        return tag;
    }
    if (Object.keys(definition).length == 0) {
        return tag;
    }
    let data = definition["data"].find(obj => obj.namespace === namespace);
    if (data != undefined) {
        return (data["data"][tag] != undefined) ? data["data"][tag]["name"] : tag;
    }
    return tag;
}

const NAMESPACE_ALIASES = {
    artist: "artist", a: "artist",
    character: "character", c: "character", char: "character",
    cosplayer: "cosplayer", cos: "cosplayer",
    female: "female", f: "female",
    group: "group", g: "group", circle: "group",
    language: "language", l: "language", lang: "language",
    location: "location", loc: "location",
    male: "male", m: "male",
    mixed: "mixed", x: "mixed",
    other: "other", o: "other",
    parody: "parody", p: "parody", series: "parody",
    reclass: "reclass", r: "reclass"
};

const NAMESPACE_ABBR = {
    artist: "a",
    character: "c",
    cosplayer: "cos",
    female: "f",
    group: "g",
    language: "l",
    location: "loc",
    male: "m",
    mixed: "x",
    other: "o",
    parody: "p",
    reclass: "r"
};

function translateHistoryText(text) {
    // 檢查標籤翻譯開關，關閉時直接返回原始文字
    if (setting && setting.value && setting.value.tag_translate && !setting.value.tag_translate.value) {
        return text;
    }
    
    // 匹配格式：namespace:"tag$"
    const tagPattern = /([\w]+):"([^"]+)\$"/g;
    
    return text.replace(tagPattern, (match, namespace, tag) => {
        const normalizedNamespace = NAMESPACE_ALIASES[namespace] || namespace;
        const displayNamespace = NAMESPACE_ABBR[normalizedNamespace] || namespace;
        const displayName = get_chinese_name(normalizedNamespace, tag);
        return `<span style="display:inline-block;font-weight:bold;padding:1px 6px;margin:0;border-radius:5px;border:1px solid #989898;background:#4f535b;color:#f1f1f1;white-space:nowrap;vertical-align:baseline;line-height:1.4;">${displayNamespace}:${displayName}</span>`;
    });
}

function createPage() {
    let pageDiv = document.getElementById("page");
    let strHtml = "";
    let thisPageMax = ((page + 1) * page_max < group.length) ? page_max : (group.length - page * page_max);

    console.log(page, thisPageMax, (page + 1) * page_max, group.length);
    function fa(gid) {
        let date = "null";
        if (group[gid]["posted"] != null) {
            let dd = new Date(parseInt(group[gid]["posted"]) * 1000);
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
    for (
        let i = page * page_max;
        i < group.length && i < page * page_max + page_max;
        i++
    ) {
        let local_title = group[i].local_name;
        let db_title = (group[i].title_jpn) ? group[i].title_jpn : (group[i].title) ? group[i].title : local_title;
        let date = fa(i);
        let category = cat[group[i]["category"]];
        strHtml += `<div class="gl1t">
            <a>
                <div class="gl4t glname glink">${local_title}</div>
            </a>
            <div class="gl3t" style="height: auto; width: 250px;"><a><img loading="auto"
                        title="${db_title}" alt="${local_title}"
                        style="height: auto; width: auto; max-width: 100%; max-height: 100%;"></a></div>
            <div class="gl5t">
                <div>
                    <div class="${category[0]}">${category[1]}</div>
                    <div class="glnew">${date}</div>
                </div>
                <div>
                    <div></div>
                    <div>${group[i]["filecount"]} pages</div>
                </div>
            </div>
        </div>`
    }

    pageDiv.innerHTML = `<div class="itg gld">${strHtml}</div>`;
    for (let i = 0; i < thisPageMax; i++) {
        const click = (event) => {
            const selectedText = window.getSelection().toString().trim();

            if (selectedText.length) {
                return;
            }

            console.log(page * page_max + i, group[page * page_max + i].local_name);
            ipcRenderer.send('put-homeStatus', { book_id: page * page_max + i });

            // 確保只添加一次事件監聽器
            ipcRenderer.once('put-homeStatus-reply', (event, data) => {
                window.location.href = "book.html";
            });
        };

        const contextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedText = window.getSelection().toString();
            ipcRenderer.send('show-context-menu', {
                filePath: group[i].local_path,
                fileName: group[i].local_name,
                selectedText: selectedText
            });
        }

        const gl1tLink = pageDiv.getElementsByClassName("gl1t")[i].querySelector("a");
        const gl3tLink = pageDiv.getElementsByClassName("gl3t")[i].querySelector("a");

        gl1tLink.addEventListener("click", click);
        gl3tLink.addEventListener("click", click);

        gl1tLink.addEventListener('contextmenu', contextmenu);
        gl3tLink.addEventListener('contextmenu', contextmenu);

        // image.getheadAsync(group[page * page_max + i].local_path).then(url => {
        //     pageDiv.getElementsByTagName("img")[i].src = url;
        // });
        ipcRenderer.invoke('image:getFirstImagePath', { index: page * page_max + i }).then(imageData => {
            if (imageData && imageData.type === 'file') {
                pageDiv.getElementsByTagName("img")[i].src = imageData.path;
            } else {
                // 處理錯誤情況 - 例如設定一個預設圖片或顯示錯誤訊息
                console.error(`無法載入索引 ${page * page_max + i} 的封面圖片`);
                pageDiv.getElementsByTagName("img")[i].src = ''; // 或設定一個預設的錯誤圖片
            }
        }).catch(error => {
            console.error(`獲取索引 ${page * page_max + i} 的封面時出錯:`, error);
            pageDiv.getElementsByTagName("img")[i].src = ''; // 或設定一個預設的錯誤圖片
        });
    }
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
    let len = Math.floor(groupLength / page_max) + 1;
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
        for (let i = page - 3; i <= page + 3; i++) {
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

function createSearch() {
    function categoryEvent(event) {
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
        const id = event.target.id;
        if (event.target.getAttribute("data-disabled")) {
            event.target.removeAttribute("data-disabled");
            category.push(c[id]);
        } else {
            event.target.setAttribute("data-disabled", 1);
            category.splice(category.indexOf(c[id]), 1);
        }
        console.log(category);
    }

    document.getElementById("cat_1").innerText = replace("Misc");
    document.getElementById("cat_1").addEventListener("click", categoryEvent);
    document.getElementById("cat_2").innerText = replace("Doujinshi");
    document.getElementById("cat_2").addEventListener("click", categoryEvent);
    document.getElementById("cat_4").innerText = replace("Manga");
    document.getElementById("cat_4").addEventListener("click", categoryEvent);
    document.getElementById("cat_8").innerText = replace("Artist CG");
    document.getElementById("cat_8").addEventListener("click", categoryEvent);
    document.getElementById("cat_16").innerText = replace("Game CG");
    document.getElementById("cat_16").addEventListener("click", categoryEvent);
    document.getElementById("cat_32").innerText = replace("Image Set");
    document.getElementById("cat_32").addEventListener("click", categoryEvent);
    document.getElementById("cat_64").innerText = replace("Cosplay");
    document.getElementById("cat_64").addEventListener("click", categoryEvent);
    document.getElementById("cat_128").innerText = replace("Asian Porn");
    document.getElementById("cat_128").addEventListener("click", categoryEvent);
    document.getElementById("cat_256").innerText = replace("Non-H");
    document.getElementById("cat_256").addEventListener("click", categoryEvent);
    document.getElementById("cat_512").innerText = replace("Western");
    document.getElementById("cat_512").addEventListener("click", categoryEvent);

    // 根據 category 狀態還原按鈕的 disabled 樣式
    let catIdMap = {
        cat_1: "Misc",
        cat_2: "Doujinshi",
        cat_4: "Manga",
        cat_8: "Artist CG",
        cat_16: "Game CG",
        cat_32: "Image Set",
        cat_64: "Cosplay",
        cat_128: "Asian Porn",
        cat_256: "Non-H",
        cat_512: "Western"
    };
    for (let id in catIdMap) {
        if (!category.includes(catIdMap[id])) {
            document.getElementById(id).setAttribute("data-disabled", 1);
        }
    }

    let f_search = document.getElementById("f_search");
    let searchClear = document.getElementById("searchClear");
    let from_onsubmit = document.getElementById("from_onsubmit");

    f_search.onkeydown = (e) => { e.stopPropagation(); }
    f_search.placeholder = replace("search text");
    f_search.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // 阻止默认的上下文菜单
        event.stopPropagation(); // 阻止事件冒泡

        const start = f_search.selectionStart;
        const end = f_search.selectionEnd;

        if (start !== end) {
            const selectedText = f_search.value.substring(start, end);
            ipcRenderer.send('show-context-menu', {
                isInput: true,
                selectedText: selectedText
            });
        } else {
            ipcRenderer.send('show-context-menu', {
                isInput: true
            });
        }
    });
    document.getElementById("searchSubmit").value = replace("search");
    searchClear.value = replace("clear");

    from_onsubmit.onsubmit = () => {
        if (!historyList.some(item => item.text === f_search.value) && f_search.value !== "") {
            const newItem = {
                text: f_search.value,
                pinned: false,
                order: 2434
            }
            historyList.push(newItem);
            ipcRenderer.send("put-historyList", historyList);
            ipcRenderer.once("put-historyList-reply", () => {
                console.log("update");
                updateHistoryList();
            });
        }
        ipcRenderer.send("put-search", { str: f_search.value, category: category });
        ipcRenderer.on("put-search-reply", (event, data) => {
            book_id = data.book_id;
            group = data.group;
            search_str = data.search_str;
            groupLength = group.length;
            console.log(data.search_str);
            updateHome();
        });


        return false;
    }

    document.getElementById("notMatched").innerText = "not matched"
    document.getElementById("notMatched").onclick = () => {
        f_search.value = ".null";
        from_onsubmit.onsubmit();
    }
    searchClear.onclick = () => {
        // 重置 category 為全選狀態
        category = [...defineCategory];
        
        // 更新分類按鈕的 disabled 狀態
        let catIdMap = {
            cat_1: "Misc",
            cat_2: "Doujinshi",
            cat_4: "Manga",
            cat_8: "Artist CG",
            cat_16: "Game CG",
            cat_32: "Image Set",
            cat_64: "Cosplay",
            cat_128: "Asian Porn",
            cat_256: "Non-H",
            cat_512: "Western"
        };
        for (let id in catIdMap) {
            document.getElementById(id).removeAttribute("data-disabled");
        }
        
        f_search.value = null;
        from_onsubmit.onsubmit();
    }
    //document.getElementById("updateMatch").innerText = "update match"
}
function updateHistoryList() {
    let historyHtml = "";
    for (const i in historyList) {
        let star_class = (historyList[i].pinned) ? "bi-star-fill" : "bi-star";
        let button_class = (historyList[i].pinned) ? "pinButton active" : "pinButton";
        let displayText = translateHistoryText(historyList[i].text);
        historyHtml += `<li><a class="history-link" title='${historyList[i].text}'>${displayText}</a><button class="${button_class}"><i class='${star_class}'></i></button></li>`;
    }

    document.getElementById('historyList').innerHTML = historyHtml;

    document.querySelectorAll('.history-link').forEach((link, index) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            document.getElementById("f_search").value = historyList[index].text;
            document.getElementById("from_onsubmit").onsubmit();
        });
    });
    document.querySelectorAll('.pinButton').forEach((button, index) => {
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            const icon = button.querySelector('i');
            if (button.classList.contains('active')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
                historyList[index].pinned = true;

                let maxOrder = 0;
                historyList.forEach(item => {
                    if (item.order !== 2434) {
                        maxOrder = Math.max(maxOrder, item.order);
                    }
                });
                historyList[index].order = maxOrder + 1;
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
                historyList[index].pinned = false;
                historyList[index].order = 2434;
            }
            historyList.sort((a, b) => a.order - b.order);
            ipcRenderer.send("put-historyList", historyList);
            ipcRenderer.once("put-historyList-reply", () => {
                console.log("update");
                updateHistoryList();
            });
        });
    });
}
function createSidebar() {
    const sideMenu = document.getElementById('sideMenu');
    const menuButton = document.getElementById('menuButton');

    function closeSidebar() {
        sideMenu.classList.add('hidden');
        sideMenu.style.display = 'none';
        menuButton.style.display = 'block';
    }

    sideMenu.getElementsByTagName('button')[1].textContent = replace("Settings");
    sideMenu.getElementsByTagName('button')[2].textContent = replace("search");
    sideMenu.getElementsByTagName('button')[3].textContent = replace("Clear list");
    sideMenu.getElementsByTagName('h3')[0].textContent = replace("Search history");

    updateHistoryList();

    menuButton.addEventListener('click', function () {
        sideMenu.classList.remove('hidden');
        sideMenu.style.display = 'block';
        menuButton.style.display = 'none';
    });

    document.getElementById('closeButton').addEventListener('click', function () {
        closeSidebar();
    });

    document.getElementById('settingButton').addEventListener('click', function () {
        console.log("setting");
        ipcRenderer.send('put-homeStatus', { book_id: page * page_max });
        ipcRenderer.once('put-homeStatus-reply', (event, data) => {
            window.location.href = "setting.html";
        });
    });

    document.getElementById('sideClearButton').addEventListener('click', () => {
        historyList = historyList.filter(item => item.pinned !== false);
        ipcRenderer.send("put-historyList", historyList);
        ipcRenderer.once("put-historyList-reply", () => {
            updateHistoryList();
        });
    });

    document.addEventListener('click', function (event) {
        if (!sideMenu.contains(event.target) && !menuButton.contains(event.target)) {
            closeSidebar();
        }
    });

}

function updateHome() {
    page = Math.floor(book_id / page_max);
    document.getElementById("f_search").value = search_str;
    document.getElementById("pageSelectorText").textContent = `Showing ${page * page_max + 1} - 
        ${(page + 1) * page_max < groupLength
            ? (page + 1) * page_max
            : groupLength
        } of ${groupLength} results`;

    createPtt();
    createPage();
    createSidebar();
}

function hotkeyHandle(event) {
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
        for (i in homeHotkeys) {
            if (i === command) {
                return isSame(homeHotkeys[i].value);
            }
        }
        return null;
    }

    if (isKey("prev")) {
        goto_page("-1")();
        return;
    }
    if (isKey("next")) {
        goto_page("-2")();
        return;
    }
    if (isKey("full_screen")) {
        console.log("full_screen");
        ipcRenderer.send('toggle-fullscreen');
        return;
    }
    if (isKey("exit")) {
        ipcRenderer.send("exit");
        return;
    }
    if (isKey("name_sort")) {
        ipcRenderer.send("sort", "name");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("name_sort");
            book_id = 0;
            group = data.group;
            updateHome();
        });
        return;
    }
    if (isKey("random_sort")) {
        ipcRenderer.send("sort", "random");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("random_sort");
            book_id = 0;
            group = data.group;
            updateHome();
        });
        return;
    }
    if (isKey("chronology")) {
        ipcRenderer.send("sort", "chronology");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("chronology");
            book_id = 0;
            group = data.group;
            updateHome();
        });
        return;
    }




}

ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    console.log("home.js");
    page_max = data.home_max;
    book_id = data.book_id;
    group = data.group;
    uiLanguage = data.uiLanguage;
    search_str = data.search_str;
    keyboardEventHome = data.keyboardEventHome;
    groupLength = group.length;
    globalHotkeys = data.globalHotkeys;
    homeHotkeys = data.homeHotkeys;
    historyList = data.historyList;
    setting = data.setting;
    definition = data.definition;
    category = data.category;

    webFrame.setZoomFactor(setting.value.zoom.value / 100);
    document.addEventListener('keydown', hotkeyHandle);
    
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const selectedText = window.getSelection().toString();
        ipcRenderer.send('show-context-menu', { selectedText: selectedText });
    });
    
    createSearch();
    //console.log(search_str);
    document.getElementById("f_search").value = search_str;
    if (!Array.isArray(group) || group.length === 0) {
        document.getElementById("from_onsubmit").onsubmit();
    } else {
        updateHome();
    }
    console.log(book_id);
});

ipcRenderer.on('context-menu-command', (e, command, text) => {
    if (command === 'copy') {
        try {
            clipboard.writeText(text);
            window.getSelection().removeAllRanges();
            console.log(text);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }
    if (command === 'Paste') {
        const inputElement = document.getElementById("f_search")
        const start = inputElement.selectionStart;
        const end = inputElement.selectionEnd;
        const value = inputElement.value;
        const text = clipboard.readText('clipboard');

        console.log(clipboard.readText('clipboard'));
        inputElement.value = value.slice(0, start) + text + value.slice(end);

        const newPosition = start + text.length;
        inputElement.setSelectionRange(newPosition, newPosition);
        inputElement.focus();
    }
    if (command === 'sort') {
        ipcRenderer.send("sort", text);
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("sort:", text);
            book_id = 0;
            group = data.group;
            updateHome();
        });
    }
});