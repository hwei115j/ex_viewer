/*jshint esversion: 6 */
const { ipcRenderer } = require("electron");
let uiLanguage;
let path_list = [];
let dir;

function replace(name, text) {
    if (text) {
        return uiLanguage[name] ? uiLanguage[name] : text;
    }
    return uiLanguage[name] ? uiLanguage[name] : name;
}

function renderDirectoryList() {
    let pathContainer = document.getElementById("path");
    pathContainer.innerHTML = "";
    for (let i in path_list) {
        pathContainer.innerHTML += `
            <div class="layers">
            <h1>${path_list[i]}</h1>
            <select>
            <option value="1">${replace("init_text2", "1")}</option>
            <option value="2">2</option>
            <option value="3">3</option>
            </select>
            <button class="delete-dir-btn" data-index="${i}">✕</button>
            </div>`;
    }
    // 恢復之前的 layers 選擇值
    let layers = document.getElementsByClassName("layers");
    for (let i = 0; i < layers.length; i++) {
        if (dir.layers && dir.layers[i] !== undefined) {
            layers[i].getElementsByTagName("select")[0].value = dir.layers[i];
        }
    }
}

function create_init_html() {
    function create_book_list(path, layers) {
        let files;
        let list = [];

        try {
            files = fs.readdirSync(path);
        } catch (e) {
            return list;
        }
        for (let i in files) {
            let title = files[i];
            let p = join(path, title);
            if (image.isbook(p)) {
                list.push([title, max_string(files[i]), path]);
            }
            if (layers != 1) {
                list = list.concat(create_book_list(p, layers - 1));
            }
        }

        return list;
    }

    function template() {
        document.getElementById("body").innerHTML = `
        <button id="select-directory" style="display:none">
        ${replace("select_directory")}</button></select>
        <div id='count'></div>
        <p></p>
        <button id="start" style="display:none">${replace("start")}</button>
        <p></p>
        <div id='path'></div>
        <p></p>
        <p></p>`;
    }

    function insert() {
        let start = document.getElementById("start");
        let selectDirBtn = document.getElementById("select-directory");
        let path = document.getElementById("path");

        start.style = selectDirBtn.style = "";
        renderDirectoryList();

        // 事件委派處理刪除按鈕點擊
        path.addEventListener("click", event => {
            if (event.target.classList.contains("delete-dir-btn")) {
                let index = parseInt(event.target.getAttribute("data-index"));
                path_list.splice(index, 1);
                // 同步更新 dir.layers
                if (dir.layers) {
                    dir.layers.splice(index, 1);
                }
                renderDirectoryList();
            }
        });

        start.addEventListener("click", event => {
            let layers = document.getElementsByClassName("layers");
            layers_list = [];
            start.style = selectDirBtn.style = "display:none";

            for (let i = 0; i < layers.length; i++) {
                layers_list.push(
                    parseInt(layers[i].getElementsByTagName("select")[0].value)
                );
            }

            console.log(path_list);
            console.log(layers_list);
            ipcRenderer.send('put-match', { path_list: path_list, layers_list: layers_list });
            ipcRenderer.on('put-match-reply', (event, ret) => {
                document.getElementById(
                    "count"
                ).innerHTML = `<h1>${ret.currentBooks}/${ret.totalBooks}</h1>`;
                if(ret.currentBooks == ret.totalBooks) {
                    window.location.href = "home.html";
                }
            });
        });

        selectDirBtn.addEventListener("click", event => {
            ipcRenderer.send("open-file-dialog");
        });

        ipcRenderer.on("selected-directory", (event, selectedDir) => {
            console.log(selectedDir);
            path_list.push(selectedDir[0]);
            path_list = [...new Set(path_list)]; //消除重複
            renderDirectoryList();
        });
    }

    template();

    let body = document.getElementById("body");
    body.innerHTML = replace("init_text1") + body.innerHTML;
    path_list = [...new Set(dir.dir)];
    insert();
}



ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    console.log("match.js");
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
    dir = data.dir;
    create_init_html();
});