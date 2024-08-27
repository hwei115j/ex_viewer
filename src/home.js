/*jshint esversion: 8 */
const dialogs = require("dialogs")();
const image = require("../image_manager");
const { ipcRenderer, clipboard } = require("electron");
//window.$ = window.jQuery = require('jquery');

let page = 0;
let uiLanguage;
let page_max;
let groupLength;
let book_id;
let search_str;
let group;
let keyboardEventHome;
let globalHotkeys;
let homeHotkeys;

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
                updataHome();
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
        updataHome();
        //ipcRenderer.send('get-pageStatus', book_id);
    };
}

function replace(name) {
    return uiLanguage[name] ? uiLanguage[name] : name;
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
            ipcRenderer.send('show-context-menu', {
                filePath: group[i].local_path,
                fileName: group[i].local_name
            });
        }

        const gl1tLink = pageDiv.getElementsByClassName("gl1t")[i].querySelector("a");
        const gl3tLink = pageDiv.getElementsByClassName("gl3t")[i].querySelector("a");

        gl1tLink.addEventListener("click", click);
        gl3tLink.addEventListener("click", click);

        gl1tLink.addEventListener('contextmenu', contextmenu);
        gl3tLink.addEventListener('contextmenu', contextmenu);

        image.getheadAsync(group[page * page_max + i].local_path).then(url => {
            pageDiv.getElementsByTagName("img")[i].src = url;
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

    let f_search = document.getElementById("f_search");
    f_search.placeholder = replace("search text");
    document.getElementById("searchSubmit").value = replace("search");
    document.getElementById("searchClear").value = replace("clear");

    document.getElementById("from_onsubmit").onsubmit = () => {
        ipcRenderer.send("put-search", { str: f_search.value, category: category });
        ipcRenderer.on("put-search-reply", (event, data) => {
            book_id = data.book_id;
            group = data.group;
            search_str = data.search_str;
            groupLength = group.length;
            updataHome();
        });
        return false;
    };

    document.getElementById("notMatched").innerText = "not matched"
    document.getElementById("notMatched").onclick = () => {
        f_search.value = ".null";
        document.getElementById("from_onsubmit").onsubmit();
    }
    //document.getElementById("updateMatch").innerText = "update match"
}

function updataHome() {
    page = Math.floor(book_id / page_max);
    document.getElementById("f_search").value = search_str;
    document.getElementById("pageSelectorText").textContent = `Showing ${page * page_max + 1} - 
        ${(page + 1) * page_max < groupLength
            ? (page + 1) * page_max
            : groupLength
        } of ${groupLength} results`;

    createPtt();
    createPage();
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        const selectedText = window.getSelection().toString();
        if (!selectedText) {
            return;
        }
        ipcRenderer.send('show-context-menu', { selectedText: selectedText });
    });
    document.getElementById('menuButton').addEventListener('click', function () {
        document.getElementById('sideMenu').classList.remove('hidden');
        document.getElementById('sideMenu').style.display = 'block';
        document.getElementById('menuButton').style.display = 'none';
    });

    document.getElementById('closeButton').addEventListener('click', function () {
        document.getElementById('sideMenu').classList.add('hidden');
        document.getElementById('sideMenu').style.display = 'none';
        document.getElementById('menuButton').style.display = 'block';
    });
    document.querySelectorAll('.pinButton').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        const icon = button.querySelector('i');
        if (button.classList.contains('active')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    });
});
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
            updataHome();
        });
        return;
    }
    if (isKey("random_sort")) {
        ipcRenderer.send("sort", "random");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("random_sort");
            book_id = 0;
            group = data.group;
            updataHome();
        });
        return;
    }
    if (isKey("chronology")) {
        ipcRenderer.send("sort", "chronology");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("chronology");
            book_id = 0;
            group = data.group;
            updataHome();
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

    document.addEventListener('keydown', hotkeyHandle);
    createSearch();
    updataHome();
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
});