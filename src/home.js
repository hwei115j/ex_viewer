/*jshint esversion: 8 */
const dialogs = require("dialogs")();
const { webFrame } = require('electron');
const { ipcRenderer, clipboard } = require("electron");

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
let appVersion;
let currentSort;

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
    let len = Math.max(1, Math.ceil(groupLength / page_max));

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

function getTranslation(name) {
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

function escapeHomeText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function createPage() {
    const pageDiv = document.getElementById("page");
    const first = page * page_max;
    const last = Math.min(first + page_max, group.length);
    const categoryStyle = {
        Doujinshi: "ct2", Manga: "ct3", "Artist CG": "ct4", "Game CG": "ct5",
        Western: "cta", "Non-H": "ct9", "Image Set": "ct6", Cosplay: "ct7",
        "Asian Porn": "ct8", Misc: "ct1"
    };
    let html = "";

    for (let i = first; i < last; i++) {
        const book = group[i];
        const title = escapeHomeText(book.local_name);
        const imageTitle = escapeHomeText(book.title_jpn || book.title || book.local_name);
        const date = book.posted ? new Date(parseInt(book.posted, 10) * 1000).toISOString().slice(0, 10) : "—";
        const categoryName = book.category || "Unmatched";
        const categoryClass = categoryStyle[book.category] || "ct1";
        html += '<article class="home-card">' +
            '<button type="button" class="home-cover-button home-open" aria-label="' + escapeHomeText(getTranslation("Open")) + ' ' + title + '">' +
                '<img class="home-cover" alt="" title="' + imageTitle + '">' +
            '</button>' +
            '<div class="home-card-info">' +
                '<button type="button" class="home-card-title home-open" title="' + title + '">' + title + '</button>' +
                '<span class="home-card-category ' + categoryClass + '">' + escapeHomeText(getTranslation(categoryName)) + '</span>' +
                '<div class="home-card-bottom">' + date + ' · ' + escapeHomeText(book.filecount) + ' ' + escapeHomeText(getTranslation("pages")) + '</div>' +
            '</div>' +
        '</article>';
    }

    pageDiv.innerHTML = '<div class="home-grid">' +
        (html || '<div class="home-empty">' + escapeHomeText(getTranslation("No results")) + '</div>') +
        '</div>';

    for (let i = first; i < last; i++) {
        const card = pageDiv.getElementsByClassName("home-card")[i - first];
        const image = card.querySelector("img");
        const open = () => {
            if (window.getSelection().toString().trim()) return;
            ipcRenderer.send("put-homeStatus", { book_id: i });
            ipcRenderer.once("put-homeStatus-reply", () => {
                window.location.href = "book.html";
            });
        };
        card.querySelectorAll(".home-open").forEach(button => button.addEventListener("click", open));
        card.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
            ipcRenderer.send("show-context-menu", {
                filePath: group[i].local_path,
                fileName: group[i].local_name,
                selectedText: window.getSelection().toString()
            });
        });
        ipcRenderer.invoke("image:getFirstImagePath", { index: i }).then(imageData => {
            if (image.isConnected && imageData && imageData.type === "file") image.src = imageData.path;
        }).catch(error => console.error("Failed to load cover:", error));
    }
}

function createPtt() {
    const totalPages = Math.max(1, Math.ceil(groupLength / page_max));
    const pages = [];
    if (totalPages <= 7) {
        for (let i = 0; i < totalPages; i++) pages.push(i + 1);
    } else if (page + 1 < 7) {
        for (let i = 0; i < 7; i++) pages.push(i + 1);
        pages.push("jump", totalPages);
    } else if (page > totalPages - 7) {
        pages.push(1, "jump");
        for (let i = totalPages - 7; i < totalPages; i++) pages.push(i + 1);
    } else {
        pages.push(1, "jump");
        for (let i = page - 3; i <= page + 3; i++) pages.push(i + 1);
        pages.push("jump", totalPages);
    }
    let html = '<button type="button" data-page="prev"' + (page === 0 ? " disabled" : "") + '>‹</button>';
    for (const n of pages) {
        if (n === "jump") {
            html += '<button type="button" data-page="jump" aria-label="' + escapeHomeText(getTranslation("Jump to page")) + '">…</button>';
        } else {
            html += '<button type="button" data-page="' + n + '"' + (n === page + 1 ? ' class="current" aria-current="page"' : "") + '>' + n + '</button>';
        }
    }
    html += '<button type="button" data-page="next"' + (page === totalPages - 1 ? " disabled" : "") + '>›</button>';
    document.querySelectorAll(".home-pager").forEach(pager => {
        pager.innerHTML = html;
        pager.onclick = event => {
            const button = event.target.closest("button[data-page]");
            if (!button || button.disabled) return;
            const target = button.dataset.page;
            if (target === String(page + 1)) return;
            goto_page(target === "prev" ? "-1" : target === "next" ? "-2" : target === "jump" ? null : target)();
        };
    });
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
        event.target.setAttribute("aria-pressed", !event.target.hasAttribute("data-disabled"));
        console.log(category);
    }

    document.getElementById("cat_1").innerText = getTranslation("Misc");
    document.getElementById("cat_1").addEventListener("click", categoryEvent);
    document.getElementById("cat_2").innerText = getTranslation("Doujinshi");
    document.getElementById("cat_2").addEventListener("click", categoryEvent);
    document.getElementById("cat_4").innerText = getTranslation("Manga");
    document.getElementById("cat_4").addEventListener("click", categoryEvent);
    document.getElementById("cat_8").innerText = getTranslation("Artist CG");
    document.getElementById("cat_8").addEventListener("click", categoryEvent);
    document.getElementById("cat_16").innerText = getTranslation("Game CG");
    document.getElementById("cat_16").addEventListener("click", categoryEvent);
    document.getElementById("cat_32").innerText = getTranslation("Image Set");
    document.getElementById("cat_32").addEventListener("click", categoryEvent);
    document.getElementById("cat_64").innerText = getTranslation("Cosplay");
    document.getElementById("cat_64").addEventListener("click", categoryEvent);
    document.getElementById("cat_128").innerText = getTranslation("Asian Porn");
    document.getElementById("cat_128").addEventListener("click", categoryEvent);
    document.getElementById("cat_256").innerText = getTranslation("Non-H");
    document.getElementById("cat_256").addEventListener("click", categoryEvent);
    document.getElementById("cat_512").innerText = getTranslation("Western");
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
        document.getElementById(id).setAttribute("aria-pressed", category.includes(catIdMap[id]));
    }

    let f_search = document.getElementById("f_search");
    let searchClear = document.getElementById("searchClear");
    let from_onsubmit = document.getElementById("from_onsubmit");

    f_search.onkeydown = (e) => { e.stopPropagation(); }
    f_search.placeholder = getTranslation("search text");
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
    document.getElementById("searchSubmit").value = getTranslation("Search");
    searchClear.value = getTranslation("Clear");

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
        ipcRenderer.once("put-search-reply", (event, data) => {
            book_id = data.book_id;
            group = data.group;
            search_str = data.search_str;
            groupLength = group.length;
            currentSort = "name";
            console.log(data.search_str);
            updateHome();
        });


        return false;
    }

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
            document.getElementById(id).setAttribute("aria-pressed", "true");
        }
        
        f_search.value = null;
        from_onsubmit.onsubmit();
    }
    //document.getElementById("updateMatch").innerText = "update match"
}
function updateHistoryList() {
    let historyHtml = "";
    for (const i in historyList) {
        let pinIcon = historyList[i].pinned ? "&#9733;" : "&#9734;";
        let button_class = (historyList[i].pinned) ? "pinButton active" : "pinButton";
        let displayText = translateHistoryText(historyList[i].text);
        historyHtml += `<li><a class="history-link" title='${historyList[i].text}'>${displayText}</a><button class="${button_class}"><span class="pinIcon">${pinIcon}</span></button></li>`;
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
            const icon = button.querySelector('.pinIcon');
            if (button.classList.contains('active')) {
                icon.innerHTML = '&#9733;';
                historyList[index].pinned = true;

                let maxOrder = 0;
                historyList.forEach(item => {
                    if (item.order !== 2434) {
                        maxOrder = Math.max(maxOrder, item.order);
                    }
                });
                historyList[index].order = maxOrder + 1;
            } else {
                icon.innerHTML = '&#9734;';
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
    const sidebar = document.getElementById("sideMenu");
    const shell = document.getElementById("homeShell");
    const menuButton = document.getElementById("menuButton");

    document.getElementById("libraryHeading").textContent = getTranslation("Library");
    document.getElementById("allBooksLabel").textContent = getTranslation("All books");
    document.getElementById("notMatchedLabel").textContent = getTranslation("Unmatched");
    for (const [id, key] of [["allBooks", "All books"], ["notMatched", "Unmatched"], ["settingButton", "Settings"]]) {
        document.getElementById(id).setAttribute("aria-label", getTranslation(key));
        document.getElementById(id).title = getTranslation(key);
    }
    document.getElementById("historyHeading").textContent = getTranslation("Search history");
    document.getElementById("sideClearButton").textContent = getTranslation("Clear list");
    document.getElementById("settingsLabel").textContent = getTranslation("Settings");
    document.getElementById("categoryLabel").textContent = getTranslation("Categories");
    document.getElementById("sortLabel").textContent = getTranslation("Sort");
    document.querySelector('#sortSelect option[value="name"]').textContent = getTranslation("Name");
    document.querySelector('#sortSelect option[value="random"]').textContent = getTranslation("Random");
    document.querySelector('#sortSelect option[value="chronology"]').textContent = getTranslation("Chronology");

    updateHistoryList();

    menuButton.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
            sidebar.classList.toggle("expanded");
        } else {
            shell.classList.toggle("sidebar-collapsed");
        }
    });

    document.getElementById("allBooks").addEventListener("click", () => {
        document.getElementById("searchClear").click();
        sidebar.classList.remove("expanded");
    });

    document.getElementById("settingButton").addEventListener("click", () => {
        ipcRenderer.send("put-homeStatus", { book_id: page * page_max });
        ipcRenderer.once("put-homeStatus-reply", () => {
            window.location.href = "setting.html";
        });
    });

    document.getElementById("sideClearButton").addEventListener("click", () => {
        historyList = historyList.filter(item => item.pinned !== false);
        ipcRenderer.send("put-historyList", historyList);
        ipcRenderer.once("put-historyList-reply", updateHistoryList);
    });

    document.getElementById("sortSelect").addEventListener("change", event => {
        applySort(event.target.value);
    });

    document.addEventListener("click", event => {
        if (window.innerWidth <= 900 && sidebar.classList.contains("expanded") &&
            !sidebar.contains(event.target)) {
            sidebar.classList.remove("expanded");
        }
    });
}

function applySort(mode) {
    ipcRenderer.send("sort", mode);
    ipcRenderer.once("sort-reply", (event, data) => {
        currentSort = mode;
        book_id = 0;
        group = data.group;
        groupLength = group.length;
        updateHome();
    });
}

function updateHome() {
    page = Math.floor(book_id / page_max);
    document.getElementById("f_search").value = search_str;
    const label = search_str === ".null" ? getTranslation("Unmatched") :
        search_str ? getTranslation("Search") + ": " + search_str : getTranslation("All books");
    document.getElementById("viewTitle").textContent = label;
    document.getElementById("allBooks").classList.toggle("active", !search_str);
    document.getElementById("notMatched").classList.toggle("active", search_str === ".null");
    document.getElementById("sortSelect").value = currentSort;
    const first = groupLength ? page * page_max + 1 : 0;
    const last = Math.min((page + 1) * page_max, groupLength);
    document.getElementById("pageSelectorText").textContent =
        getTranslation("Showing") + " " + first + " - " + last + " " +
        getTranslation("of") + " " + groupLength + " " + getTranslation("results");

    createPtt();
    createPage();
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
        applySort("name");
        return;
    }
    if (isKey("random_sort")) {
        applySort("random");
        return;
    }
    if (isKey("chronology")) {
        applySort("chronology");
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
    appVersion = data.appVersion;
    currentSort = data.currentSort || "name";

    document.title = `ex_viewer v${appVersion}`;

    webFrame.setZoomFactor(setting.value.zoom.value / 100);
    document.addEventListener('keydown', hotkeyHandle);
    
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const selectedText = window.getSelection().toString();
        ipcRenderer.send('show-context-menu', { selectedText: selectedText });
    });
    
    createSearch();
    createSidebar();
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
        applySort(text);
    }
});
