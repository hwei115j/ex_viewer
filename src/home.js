/*jshint esversion: 8 */
const dialogs = require("dialogs")();

let page = 0;
let page_max;
let groupLength;
let book_id;
let pageBook;
let group;

const { ipcRenderer } = require("electron");

function dom(obj) {
    let r = document.createElement(obj.tag);
    for (let i in obj.data) {
        if (obj.data[i]) {
            r[i] = obj.data[i];
        }
    }
    for (let i in obj.child) {
        let c = dom(obj.child[i]);
        r.appendChild(c);
    }
    return r;
}
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


function createPtt() {
    let len = Math.floor(groupLength / page_max) + 1;
    let ptt = document.getElementsByClassName("ptt");
    let pageSelector = document.createElement("tbody");
    let td = document.createElement("td");
    let a = document.createElement("a");

    function ispage(i) {
        td = document.createElement("td");
        td.onclick = goto_page(i + 1);
        a = document.createElement("a");
        a.textContent = i + 1;
        if (i == page) {
            td.onclick = null;
            td.className = "ptds"
        }
        td.appendChild(a);
        pageSelector.appendChild(td);
    }

    function func(str) {
        td = document.createElement("td");
        a = document.createElement("a");

        a.textContent = str;
        if (str == "<") {
            td.onclick = goto_page("-1");
        }
        if (str == ">") {
            td.onclick = goto_page("-2");
        }
        if (str == "1") {
            td.onclick = goto_page(1);
        }
        if (str == "...") {
            td.onclick = goto_page(null);
        }
        if (str == "len") {
            a.textContent = len;
            td.onclick = goto_page(len);
        }

        td.appendChild(a);
        pageSelector.appendChild(td);
    }
    pageSelector.appendChild(document.createElement("tr"));
    func("<");
    if (len < 7) {
        //7
        for (let i = 0; i < len; i++) {
            ispage(i);
        }
    } else if (page + 1 < 7) {
        //7, ..., len
        for (let i = 0; i < 7; i++) {
            ispage(i);
        }
        func("...");
        func("len");
    } else if (page > len - 7) {
        //1, ..., 7
        func("1");
        func("...");
        for (let i = len - 7; i < len; i++) {
            ispage(i);
        }
    } else {
        //1, ..., 5, ..., len
        func("1");
        func("...");

        for (let i = page - 2; i <= page + 2; i++) {
            ispage(i);
        }
        func("...");
        func("len");
    }
    func(">");

    ptt[0].appendChild(pageSelector);
    ptt[1].appendChild(pageSelector.cloneNode(true));
}

function createPage() {
    let pageDiv = document.getElementById("page");

    function replace(name) {
        return;
        return global.ui[name] ? global.ui[name] : name;
    }
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
    function createNode(node) {
        return dom({
            tag: "div",
            data: {
                className: "gl1t"
            },
            child: [
                {
                    tag: "a",
                    data: {},
                    child: [
                        {
                            tag: "div",
                            data: {
                                className: "gl4t glname glink",
                                textContent: node.local_name
                            },
                            child: []
                        }
                    ]
                },
                {
                    tag: "div",
                    data: {
                        className: "gl3t",
                        style: "height:auto;width:250px",
                        textContent: ""
                    },
                    child: [
                        {
                            tag: "a",
                            data: {
                                //onclick: onclick
                            },
                            child: [
                                {
                                    tag: "img",
                                    data: {
                                        style:
                                            "height:auto;width:auto;max-width:100%;max-height:100%",
                                        loading: "auto",
                                        title: node.title,
                                        alt: node.title,
                                        src: URL.createObjectURL(new Blob([node.local_path]))
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    tag: "div",
                    data: {
                        className: "gl5t"
                    },
                    child: [
                        {
                            tag: "div",
                            child: [
                                {
                                    tag: "div",
                                    data: {
                                        /*
                                        className: category[0],
                                        textContent: category[1]
                                        */
                                    }
                                },
                                {
                                    tag: "div",
                                    data: {
                                        className: "glnew",
                                        //textContent: date
                                    }
                                }
                            ]
                        },
                        {
                            tag: "div",
                            child: [
                                {
                                    tag: "div"
                                },
                                {
                                    tag: "div",
                                    data: {
                                        //textContent: filecount
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    for(i in pageBook) {
        pageDiv.appendChild(createNode(pageBook[i]));
    }
}

function _updataHome() {
    let ptt = document.getElementsByClassName("ptt");
    let pageDiv = document.getElementById("page");

    ptt[0].removeChild(ptt[0].firstChild);
    ptt[1].removeChild(ptt[1].firstChild);
    pageDiv.removeChild(pageDiv.firstChild);

    page = Math.floor(book_id / page_max);
    document.getElementById("pageSelectorText").textContent = `Showing ${page * page_max + 1} - 
        ${(page + 1) * page_max < groupLength
            ? (page + 1) * page_max
            : groupLength
        } of ${groupLength} results`;
    createPtt();
    createPage();
}

function updataHome() {
    let ptt = document.getElementsByClassName("ptt");
    let pageDiv = document.getElementById("page");
    ptt[0].removeChild(ptt[0].firstChild);
    ptt[1].removeChild(ptt[1].firstChild);
    //pageDiv.removeChild(pageDiv.firstChild);
    page = Math.floor(book_id / page_max);
    document.getElementById("pageSelectorText").textContent = `Showing ${page * page_max + 1} - 
        ${(page + 1) * page_max < groupLength
            ? (page + 1) * page_max
            : groupLength
        } of ${groupLength} results`;

    createPtt();
}

ipcRenderer.send('get-pageStatus');
ipcRenderer.on('pageStatus-data', (event, data) => {
    page_max = data.page_max;
    book_id = data.book_id;
    group = data.group;

    groupLength = group.length;
    updataHome();
});