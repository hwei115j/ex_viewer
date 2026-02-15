/*jshint esversion: 8 */
const { ipcRenderer, clipboard } = require("electron");

// 狀態變數
let book_id;
let img_id;
let group;
let uiLanguage;
let globalHotkeys;
let viewHotkeys;
let bookInfo = null;
let imageWidthPercent = 100; // 圖片寬度佔螢幕比例 (1-100%)
let baseImageWidthPercent = 100; // 從設定讀取的基礎值

// DOM 元素
let scrollContainer;
let imageContainer;
let currentPageSpan;
let totalPagesSpan;

// 圖片元素陣列
let imageElements = [];

/**
 * 上一本書
 */
async function gotoPrevBook() {
    console.log("prev_book");
    book_id = (book_id - 1 < 0) ? (group.length - 1) : (book_id - 1);
    img_id = 0;
    await initializeViewer();
}

/**
 * 下一本書
 */
async function gotoNextBook() {
    console.log("next_book");
    book_id = (book_id + 1 == group.length) ? 0 : (book_id + 1);
    img_id = 0;
    await initializeViewer();
}

/**
 * 初始化事件監聽器
 */
function eventEnable() {
    window.onkeydown = hotkeyHandle;
    scrollContainer.addEventListener('scroll', handleScroll);
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const selectedText = window.getSelection().toString();
        ipcRenderer.send('show-context-menu', {
            selectedText: selectedText,
            previousPage: true
        });
    });
}

/**
 * 禁用事件監聽器
 */
function eventDisable() {
    window.onkeydown = null;
    if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
    }
}

/**
 * 取得翻譯文字
 */
function getTranslation(name) {
    return uiLanguage[name] ? uiLanguage[name] : name;
}

/**
 * 顯示提示訊息
 */
function showToast(message, duration = 700) {
    let ttt = document.getElementById("ttt");
    ttt.style.display = "block";
    ttt.value = message;
    setTimeout(() => {
        ttt.style.display = "none";
    }, duration);
}

/**
 * 更新圖片寬度
 */
function updateImageWidth() {
    document.documentElement.style.setProperty('--image-width', imageWidthPercent + '%');
    showToast(`圖片寬度: ${imageWidthPercent}%`, 1000);
}

/**
 * 增加圖片寬度
 */
function increaseImageWidth() {
    if (imageWidthPercent < 100) {
        imageWidthPercent = Math.min(100, imageWidthPercent + 5);
        updateImageWidth();
    }
}

/**
 * 減少圖片寬度
 */
function decreaseImageWidth() {
    if (imageWidthPercent > 5) {
        imageWidthPercent = Math.max(5, imageWidthPercent - 5);
        updateImageWidth();
    }
}

/**
 * 取得目前可見的圖片索引
 */
function getCurrentVisibleIndex() {
    if (!scrollContainer || !imageElements.length) return 0;
    
    for (let i = 0; i < imageElements.length; i++) {
        const wrapper = imageElements[i];
        if (!wrapper) continue;
        
        const rect = wrapper.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        
        if (rect.top >= containerRect.top - scrollContainer.clientHeight / 2) {
            return i;
        }
    }
    
    return 0;
}

/**
 * 處理滾動事件
 */
function handleScroll() {
    // updatePageIndicator();
}

/**
 * 建立所有圖片
 * 使用原生 <img> + loading="lazy" 讓瀏覽器自動處理延遲載入
 */
async function createImages() {
    if (!bookInfo || !imageContainer) return;
    
    imageContainer.innerHTML = '';
    imageElements = [];
    
    const totalPages = bookInfo.length;
    const filePaths = bookInfo.filePaths;
    
    // 建立所有圖片元素
    for (let i = 0; i < totalPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper loading';
        wrapper.dataset.index = i;
        wrapper.id = `image-${i}`;
        
        if (filePaths[i]) {
            const img = document.createElement('img');
            img.src = filePaths[i];
            img.alt = `頁面 ${i + 1}`;
            img.loading = 'lazy'; // 瀏覽器原生延遲載入
            img.dataset.index = i;
            
            img.onload = () => {
                wrapper.classList.remove('loading');
            };
            
            img.onerror = () => {
                wrapper.classList.remove('loading');
                wrapper.classList.add('error');
                console.error(`圖片載入失敗: ${i}`);
            };
            
            wrapper.appendChild(img);
        } else {
            wrapper.classList.remove('loading');
            wrapper.classList.add('error');
        }
        
        imageElements.push(wrapper);
        imageContainer.appendChild(wrapper);
    }
    
    // 更新頁面標題
    document.title = "ex_viewer - " + group[book_id].local_name;
}

/**
 * 滾動到指定圖片
 * 混合方案：先強制載入目標圖片確認高度，再進行跳轉
 */
async function scrollToImage(index, behavior = 'auto') {
    console.log(`Scrolling to image index: ${index}`);
    if (index < 0 || index >= imageElements.length) return;
   
    const wrapper = imageElements[index];
    if (!wrapper) return;
    
    // 1. 取得該層的圖片元素
    const img = wrapper.querySelector('img');
    
    // 2. 如果圖片存在且尚未載入完成
    if (img && !img.complete) {
        // 顯示載入提示
        // showToast("正在載入...", 2000);
        
        try {
            // 將 loading 改為 eager，強迫瀏覽器優先下載
            img.loading = 'eager';
            
            // 等待圖片載入完畢
            await new Promise((resolve) => {
                if (img.complete) return resolve();
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        } catch(e) {
            console.error("預載入失敗", e);
        }
    }
    
    // 3. 執行跳轉
    // 如果圖片在遠處（>3頁），強制使用瞬間跳轉 (auto) 以避免載入過程中的佈局變動導致位置偏移
    // 如果在附近，則尊重傳入的 behavior設定 (通常是 smooth)
    const current = getCurrentVisibleIndex();
    const isLongJump = Math.abs(index - current) > 3;
    const finalBehavior = isLongJump ? 'auto' : behavior;
    
    wrapper.scrollIntoView({ behavior: finalBehavior, block: 'start' });
    
    console.log(`Scrolled to image: ${index}`);
}

/**
 * 初始化載入
 */
async function initializeViewer() {
    // 保存初始頁面索引，避免被滾動事件覆蓋
    const targetPage = img_id;
    
    // 載入書本資訊
    try {
        bookInfo = await ipcRenderer.invoke('image:getBookInfo', { index: book_id });
        console.log(`書本 ${book_id} 載入完成，共 ${bookInfo ? bookInfo.length : 0} 頁`);
    } catch (error) {
        console.error("載入書本資訊失敗:", error);
        bookInfo = null;
        return;
    }
    
    if (!bookInfo || bookInfo.length === 0) {
        console.error("書本資訊為空");
        return;
    }
    
    // 建立所有圖片
    await createImages();
    
    // 如果有指定初始頁面，滾動到該頁面
    if (targetPage >= 0 && targetPage < bookInfo.length) {
        setTimeout(() => {
            scrollToImage(targetPage);
            if (targetPage === 0) {
                // showToast(getTranslation("first page"));
            }
        }, 100);
    }
}

/**
 * 熱鍵處理
 */
async function hotkeyHandle(event) {
    event.preventDefault();
    
    function isSame(list) {
        const pressedKeys = new Set();
        
        if (event.ctrlKey) pressedKeys.add(17);
        if (event.shiftKey) pressedKeys.add(16);
        if (event.altKey) pressedKeys.add(18);
        if (event.metaKey) pressedKeys.add(91);
        pressedKeys.add(event.keyCode);
        
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
        for (let i in globalHotkeys) {
            if (i === command) {
                return isSame(globalHotkeys[i].value);
            }
        }
        for (let i in viewHotkeys) {
            if (i === command) {
                return isSame(viewHotkeys[i].value);
            }
        }
        return null;
    }
    
    if (isKey("next_book")) {
        await gotoNextBook();
        return;
    }
    
    if (isKey("prev_book")) {
        await gotoPrevBook();
        return;
    }
    
    if (isKey("prev")) {
        // 上一頁 - 向上滾動一段距離
        scrollContainer.scrollBy({ top: -300, behavior: 'auto' });
        return;
    }
    
    if (isKey("next")) {
        // 下一頁 - 向下滾動一段距離
        scrollContainer.scrollBy({ top: 300, behavior: 'auto' });
        return;
    }
    
    if (isKey("end")) {
        // 跳到最後一頁
        scrollToImage(bookInfo.length - 1, 'smooth');
        return;
    }
    
    if (isKey("home")) {
        // 跳到第一頁
        scrollToImage(0, 'smooth');
        return;
    }
    
    if (isKey("full_screen")) {
        console.log("full_screen");
        ipcRenderer.send('toggle-fullscreen');
        return;
    }
    
    if (isKey("back")) {
        //back
        ipcRenderer.send('put-bookStatus', { img_id: img_id, book_id: book_id });
        ipcRenderer.once('put-bookStatus-reply', (e) => {
            console.log("back");
            eventDisable();
            window.location.href = "book.html";
        });
        return;
    }
    
    if (isKey("name_sort")) {
        ipcRenderer.send("sort", "name");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("name_sort");
            showToast("Name", 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    
    if (isKey("random_sort")) {
        ipcRenderer.send("sort", "random");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("random_sort");
            showToast("Random", 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    
    if (isKey("chronology")) {
        ipcRenderer.send("sort", "chronology");
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("chronology");
            showToast("Chronology", 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
        return;
    }
    
    if (isKey("exit")) {
        ipcRenderer.send("exit");
        return;
    }
    
    // 圖片寬度調整 (+/-)
    if (isKey("zoom_in")) {
        increaseImageWidth();
        return;
    }
    
    if (isKey("zoom_out")) {
        decreaseImageWidth();
        return;
    }
}

/**
 * 頁面載入完成後初始化
 */
ipcRenderer.send('get-pageStatus');
ipcRenderer.on('get-pageStatus-reply', (event, data) => {
    book_id = data.book_id;
    img_id = data.img_id;
    group = data.group;
    uiLanguage = data.uiLanguage;
    globalHotkeys = data.globalHotkeys;
    viewHotkeys = data.viewHotkeys;
    
    // 讀取圖片寬度設定
    if (data.setting && data.setting.value && data.setting.value.image_width) {
        let width = data.setting.value.image_width.value;
        width = Math.max(1, Math.min(100, width));
        baseImageWidthPercent = width;
        imageWidthPercent = width;
    }
    
    // 初始化 CSS 變數
    document.documentElement.style.setProperty('--image-width', imageWidthPercent + '%');
    
    // 初始化 DOM 元素
    scrollContainer = document.getElementById('scroll-container');
    imageContainer = document.getElementById('image-container');
    
    // 綁定上一本/下一本按鈕事件
    const prevBookBtn = document.getElementById('prev-book-btn');
    const nextBookBtn = document.getElementById('next-book-btn');
    if (prevBookBtn) {
        prevBookBtn.addEventListener('click', gotoPrevBook);
    }
    if (nextBookBtn) {
        nextBookBtn.addEventListener('click', gotoNextBook);
    }
    
    // 啟用事件
    eventEnable();
    
    // 初始化瀏覽器
    initializeViewer();
});

/**
 * 右鍵選單處理
 */
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
            eventDisable();
            window.location.href = "book.html";
        });
    } else if (command === 'sort') {
        ipcRenderer.send("sort", text);
        ipcRenderer.once("sort-reply", (e, data) => {
            console.log("sort:", text);
            let ttt = document.getElementById("ttt");
            ttt.style = "position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            ttt.value = text.charAt(0).toUpperCase() + text.slice(1);
            setTimeout(() => {
                ttt.style = "display:none;position:fixed;top:0;left:0;padding:5px;margin:10px 10px 10px 10px;z-index:9999999999";
            }, 2000);
            book_id = data.group.findIndex(element => element.local_id === group[book_id].local_id);
            group = data.group;
        });
    }
});
