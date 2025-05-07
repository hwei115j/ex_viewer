/*jshint esversion: 8 */
const fs = require("fs").promises; // 使用 Promise 版本的 fs
const { ipcMain } = require('electron');
const path = require("path"); // 直接使用 path 模組
const url = require("url");

// 用於匹配常見圖片格式的正規表達式
const imageExtensionsRegex = /\.(jpg|jpeg|jfif|pjpeg|pjp|png|webp|gif|svg)$/i;

class ImageManager {
    // 儲存傳入的書本列表 (group)
    group = [];
    // 快取書本資訊 (key: 書本路徑, value: { names: [], filePaths: [], length: 0 })
    bookInfoCache = new Map();
    // 快取封面圖片路徑 (key: 書本路徑, value: 'file://...')
    firstImagePathCache = new Map();
    // 快取 'isBook' 的結果 (key: 路徑, value: boolean) - 可選優化
    isBookCache = new Map();

    constructor() {
        console.log("ImageManager init...");
        // 設置 IPC 監聽器
        this.setupIpcHandlers();
    }

    /**
     * 設置 IPC 通信的處理程序
     * 使用 ipcMain.handle 來處理來自 Renderer Process 的非同步請求
     */
    setupIpcHandlers() {
        // --- 獲取書本資訊 (檔案列表, 路徑列表, 頁數) ---
        ipcMain.handle('image:getBookInfo', async (event, { index }) => {
            // 日誌記錄，方便追蹤請求
            // console.log(`[IPC Recv] image:getBookInfo - index: ${index}`);
            try {
                // 檢查索引是否在 group 範圍內
                if (index < 0 || index >= this.group.length) {
                    console.error(`[getBookInfo] 無效的索引: ${index}`);
                    return null; // 索引無效返回 null
                }
                const bookPath = this.group[index].local_path;
                // 調用內部函數獲取或加載書本資訊
                return await this._loadBookInfo(bookPath);
            } catch (error) {
                console.error(`[getBookInfo] 處理索引 ${index} 時發生錯誤:`, error);
                return null; // 發生錯誤返回 null
            }
        });

        // --- 獲取單一圖片的路徑 ---
        ipcMain.handle('image:getImagePath', async (event, { index, page }) => {
            // console.log(`[IPC Recv] image:getImagePath - index: ${index}, page: ${page}`);
            try {
                if (index < 0 || index >= this.group.length) {
                    console.error(`[getImagePath] 無效的索引: ${index}`);
                    return null;
                }
                const bookPath = this.group[index].local_path;
                // 確保書本資訊已載入快取
                const bookInfo = await this._loadBookInfo(bookPath);

                if (!bookInfo) {
                    console.error(`[getImagePath] 無法載入書本資訊，路徑: ${bookPath}`);
                    return null; // 無法加載書本資訊
                }

                // 檢查頁碼是否有效
                if (page < 0 || page >= bookInfo.length) {
                    console.error(`[getImagePath] 無效的頁碼: ${page} (總頁數: ${bookInfo.length}), 路徑: ${bookPath}`);
                    return null;
                }

                // 從快取的 filePaths 中獲取路徑
                const filePath = bookInfo.filePaths[page];
                // 返回結構化數據
                return { type: 'file', path: filePath };

            } catch (error) {
                console.error(`[getImagePath] 處理索引 ${index}, 頁碼 ${page} 時發生錯誤:`, error);
                return null;
            }
        });

        // --- 獲取封面圖片路徑 ---
        ipcMain.handle('image:getFirstImagePath', async (event, { index }) => {
            // console.log(`[IPC Recv] image:getFirstImagePath - index: ${index}`);
            try {
                if (index < 0 || index >= this.group.length) {
                    console.error(`[getFirstImagePath] 無效的索引: ${index}`);
                    return null;
                }
                const bookPath = this.group[index].local_path;

                // 1. 檢查第一層快取 (封面路徑快取)
                if (this.firstImagePathCache.has(bookPath)) {
                    // console.log(`[getFirstImagePath] 命中封面快取: ${bookPath}`);
                    return { type: 'file', path: this.firstImagePathCache.get(bookPath) };
                }

                // 2. 若封面快取未命中，則加載書本資訊 (會利用 bookInfoCache)
                const bookInfo = await this._loadBookInfo(bookPath);

                if (bookInfo && bookInfo.length > 0) {
                    const firstImagePath = bookInfo.filePaths[0];
                    // 將結果存入封面快取
                    this.firstImagePathCache.set(bookPath, firstImagePath);
                    // console.log(`[getFirstImagePath] 已快取封面: ${bookPath}`);
                    return { type: 'file', path: firstImagePath };
                } else {
                    console.warn(`[getFirstImagePath] 書本不包含圖片或載入失敗: ${bookPath}`);
                    return null; // 書本沒有圖片或載入失敗
                }
            } catch (error) {
                console.error(`[getFirstImagePath] 處理索引 ${index} 時發生錯誤:`, error);
                return null;
            }
        });

        // --- 判斷指定路徑是否為有效的書本資料夾 ---
        ipcMain.handle('image:isBook', async (event, { path: targetPath }) => {
            // console.log(`[IPC Recv] image:isBook - path: ${targetPath}`);
            // 檢查 isBook 快取 (可選優化)
            if (this.isBookCache.has(targetPath)) {
                // return this.isBookCache.get(targetPath);
            }

            try {
                // 1. 檢查路徑是否存在且可讀
                await fs.access(targetPath, fs.constants.R_OK);

                // 2. 檢查是否為資料夾
                const stats = await fs.stat(targetPath);
                if (!stats.isDirectory()) {
                    // console.log(`[isBook] 路徑不是資料夾: ${targetPath}`);
                    this.isBookCache.set(targetPath, false);
                    return false;
                }

                // 3. 讀取資料夾內容，檢查是否有圖片檔案
                const dirents = await fs.readdir(targetPath, { withFileTypes: true });
                for (const dirent of dirents) {
                    // 只檢查檔案，並用正規表達式匹配擴展名
                    if (dirent.isFile() && imageExtensionsRegex.test(dirent.name)) {
                        // console.log(`[isBook] 找到圖片，判定為書本: ${targetPath}`);
                        this.isBookCache.set(targetPath, true);
                        return true; // 找到至少一張圖片，判定為 true
                    }
                }

                // console.log(`[isBook] 未找到圖片，判定非書本: ${targetPath}`);
                this.isBookCache.set(targetPath, false);
                return false; // 遍歷完畢沒有找到圖片
            } catch (error) {
                // 如果 fs.access 失敗 (不存在或不可讀) 或其他錯誤
                if (error.code !== 'ENOENT') { // ENOENT (No such file or directory) 通常是正常情況
                    console.error(`[isBook] 檢查路徑 ${targetPath} 時發生錯誤:`, error);
                }
                this.isBookCache.set(targetPath, false);
                return false; // 任何錯誤都判定為 false
            }
        });

        // --- 更新書本列表 ---
        // 使用 ipcMain.on 因為通常不需要立即回覆，但返回 Promise 確保操作完成
        ipcMain.handle('image:setGroup', async (event, { group }) => {
            console.log(`[IPC Recv] image:setGroup - 收到新的 group，數量: ${group ? group.length : 0}`);
            this.group = Array.isArray(group) ? group : []; // 確保是陣列
            // 清空所有相關快取，因為索引和路徑的對應關係可能改變
            this.clearCache();
            console.log('[setGroup] 已更新 group 並清除所有快取');
            return true; // 表示處理完成
        });

        // --- 清除快取 ---
        // 可選 API，用於外部請求清除快取
        ipcMain.handle('image:clearCache', async (event, { index } = {}) => {
            if (typeof index === 'number' && index >= 0 && index < this.group.length) {
                // 清除指定書本的快取
                const bookPath = this.group[index].local_path;
                this.clearCache(bookPath);
                console.log(`[IPC Recv] image:clearCache - 已清除索引 ${index} (${bookPath}) 的快取`);
            } else {
                // 清除所有快取
                this.clearCache();
                console.log('[IPC Recv] image:clearCache - 已清除所有快取');
            }
            return true; // 表示處理完成
        });
    }

    /**
     * 內部函數：載入或從快取獲取書本資訊
     * @param {string} bookPath 書本的絕對路徑
     * @returns {Promise<{ names: string[], filePaths: string[], length: number } | null>}
     */
    async _loadBookInfo(bookPath) {
        // 1. 檢查快取
        if (this.bookInfoCache.has(bookPath)) {
            return this.bookInfoCache.get(bookPath);
        }

        try {
            // 2. 讀取資料夾內容
            const dirents = await fs.readdir(bookPath, { withFileTypes: true });

            // 3. 過濾、排序、產生列表
            const imageFiles = dirents
                .filter(dirent => dirent.isFile() && imageExtensionsRegex.test(dirent.name))
                .map(dirent => dirent.name) // 只取檔名用於排序
                .sort((a, b) => a.localeCompare(b, 'zh-Hant-TW', { numeric: true })); // 自然排序

            // 4. 產生最終的列表
            const names = imageFiles; // 檔名列表
            const filePaths = imageFiles.map(name =>
                url.pathToFileURL(path.join(bookPath, name)).href // 轉換為 file:// URL
            );
            const length = names.length;

            // 5. 存入快取
            const bookInfo = { names, filePaths, length };
            this.bookInfoCache.set(bookPath, bookInfo);
            // console.log(`[_loadBookInfo] 已快取書本資訊: ${bookPath}, 頁數: ${length}`);

            return bookInfo;

        } catch (error) {
            console.error(`[_loadBookInfo] 讀取或處理書本 ${bookPath} 時發生錯誤:`, error);
            // 如果出錯，也將 null 存入快取，避免重複嘗試讀取錯誤的路徑？(可選策略)
            // this.bookInfoCache.set(bookPath, null);
            return null; // 返回 null 表示失敗
        }
    }

    /**
     * 清除快取
     * @param {string | undefined} bookPath 如果提供，只清除指定路徑的快取；否則清除所有快取。
     */
    clearCache(bookPath) {
        if (bookPath) {
            this.bookInfoCache.delete(bookPath);
            this.firstImagePathCache.delete(bookPath);
            this.isBookCache.delete(bookPath); // 清除 isBook 快取
            // console.log(`[clearCache] 已清除路徑 ${bookPath} 的快取`);
        } else {
            this.bookInfoCache.clear();
            this.firstImagePathCache.clear();
            this.isBookCache.clear(); // 清除 isBook 快取
            // console.log('[clearCache] 已清除所有書本快取');
        }
    }

    setGroup(group) {
        console.log(`[setGroup] 設置新的 group，數量: ${group ? group.length : 0}`);
        this.group = Array.isArray(group) ? group : []; // 確保是陣列
        // 清空所有相關快取，因為索引和路徑的對應關係可能改變
        this.clearCache();
        console.log('[setGroup] 已更新 group 並清除所有快取');
        return true;
    }

    /**
     * 同步檢查指定路徑是否為有效的書本資料夾
     * @param {string} targetPath 要檢查的路徑
     * @returns {boolean} 如果路徑是有效的書本資料夾（包含圖片），則返回 true
     */
    isBook(targetPath) {
        // 檢查 isBook 快取
        if (this.isBookCache.has(targetPath)) {
            return this.isBookCache.get(targetPath);
        }

        try {
            // 1. 檢查路徑是否存在且可讀
            const fs = require('fs'); // 使用同步版本的 fs
            fs.accessSync(targetPath, fs.constants.R_OK);

            // 2. 檢查是否為資料夾
            const stats = fs.statSync(targetPath);
            if (!stats.isDirectory()) {
                // console.log(`[isBookSync] 路徑不是資料夾: ${targetPath}`);
                this.isBookCache.set(targetPath, false);
                return false;
            }

            // 3. 讀取資料夾內容，檢查是否有圖片檔案
            const dirents = fs.readdirSync(targetPath, { withFileTypes: true });
            for (const dirent of dirents) {
                // 只檢查檔案，並用正規表達式匹配擴展名
                if (dirent.isFile() && imageExtensionsRegex.test(dirent.name)) {
                    // console.log(`[isBookSync] 找到圖片，判定為書本: ${targetPath}`);
                    this.isBookCache.set(targetPath, true);
                    return true; // 找到至少一張圖片，判定為 true
                }
            }

            // console.log(`[isBookSync] 未找到圖片，判定非書本: ${targetPath}`);
            this.isBookCache.set(targetPath, false);
            return false; // 遍歷完畢沒有找到圖片
        } catch (error) {
            // 如果 fs.accessSync 失敗 (不存在或不可讀) 或其他錯誤
            if (error.code !== 'ENOENT') { // ENOENT (No such file or directory) 通常是正常情況
                console.error(`[isBookSync] 檢查路徑 ${targetPath} 時發生錯誤:`, error);
            }
            this.isBookCache.set(targetPath, false);
            return false; // 任何錯誤都判定為 false
        }
    }
}

module.exports = ImageManager; // 匯出類別