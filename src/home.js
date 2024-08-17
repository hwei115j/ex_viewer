/*jshint esversion: 8 */
const dialogs = require("dialogs")();
const image = require("../image_manager");
const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('jquery');

let page = 0;
let uiLanguage;
let page_max;
let groupLength;
let book_id;
let search_str;
let group;
let keyboardEventHome;

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
        function click() {
            console.log(page * page_max + i, group[page * page_max + i].local_name);
            ipcRenderer.send('put-homeStatus', { book_id: page * page_max + i });
            ipcRenderer.on('put-homeStatus-reply', (event, data) => {
                window.location.href = "book.html";
            });
        }

        pageDiv.getElementsByClassName("gl1t")[i].querySelector("a").addEventListener("click", click);
        pageDiv.getElementsByClassName("gl3t")[i].querySelector("a").addEventListener("click", click);
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
    document.getElementById("updateMatch").innerText = "update match"
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
}

function createKeyboardEvent() {
    window.onkeydown = e => {
        function is_key(str) {
            let arr = keyboardEventHome[str].value;
            let key = e.keyCode;

            if (key == 33 || key == 34) {
                //去除pageup、pagedown
                return false;
            }
            for (let i in arr) {
                if (typeof arr[i] == "number" && key == arr[i]) {
                    console.log(str);
                    return true;
                } else if (key == arr[i][1] && e[arr[i][0]]) {
                    console.log(str);
                    return true;
                }
            }
            return false;
        }

        if (is_key("prev")) {
            goto_page("-1")();
        } else if (is_key("next")) {
            goto_page("-2")();
        } else if (is_key("full_screen")) {
            ipcRenderer.send("full_screen");
        } else if (is_key("exit")) {
            ipcRenderer.send("exit");
        } else if (is_key("name_sort")) {
            ipcRenderer.send("sort", "name");
        } else if (is_key("random_sort")) {
            ipcRenderer.send("sort", "random");
        } else if (is_key("chronology")) {
            ipcRenderer.send("sort", "chronology");
        }

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

    createSearch();
    createKeyboardEvent();
    updataHome();
});

ipcRenderer.on("sort-reply", (event, data) => {
    book_id = data.book_id;
    group = data.group;
    updataHome();
});