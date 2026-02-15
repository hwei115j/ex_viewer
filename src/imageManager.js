/*jshint esversion: 8 */
const fs = require("fs").promises; // 使用 Promise 版本的 fs
const fsSync = require("fs"); // 同步版本的 fs
const path = require("path"); // 直接使用 path 模組
const url = require("url");
const StreamZipAsync = require('node-stream-zip').async;

// 用於匹配常見圖片格式的正規表達式
const imageExtensionsRegex = /\.(jpg|jpeg|jfif|pjpeg|pjp|png|webp|gif|svg)$/i;
// 用於匹配支援的壓縮檔格式
const archiveExtensionsRegex = /\.(zip|cbz)$/i;

/**
 * 判斷路徑是否為支援的壓縮檔
 * @param {string} filePath
 * @returns {boolean}
 */
function isArchive(filePath) {
    return archiveExtensionsRegex.test(filePath);
}

/**
 * 為 ZIP 內的圖片產生自訂協議 URL
 * @param {string} zipPath ZIP 檔案的絕對路徑
 * @param {string} entryName ZIP 內部的檔案路徑
 * @returns {string}
 */
function buildZipImageUrl(zipPath, entryName) {
    return `image://host?zip=${encodeURIComponent(zipPath)}&file=${encodeURIComponent(entryName)}`;
}

/**
 * 過濾 ZIP entries 中的垃圾目錄（如 __MACOSX）並只保留圖片檔案
 * @param {Object} entries node-stream-zip entries 物件
 * @returns {string[]} 排序後的圖片 entry 名稱列表
 */
function filterAndSortZipImageEntries(entries) {
    return Object.values(entries)
        .filter(entry => !entry.isDirectory
            && !entry.name.startsWith('__MACOSX')
            && !entry.name.startsWith('.')
            && imageExtensionsRegex.test(entry.name))
        .map(entry => entry.name)
        .sort((a, b) => {
            // 使用 basename 進行自然排序，避免子資料夾前綴影響排序
            const nameA = path.basename(a);
            const nameB = path.basename(b);
            return nameA.localeCompare(nameB, 'zh-Hant-TW', { numeric: true });
        });
}

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
    }

    /**
     * 獲取書本資訊 (檔案列表, 路徑列表, 頁數)
     * @param {number} index 書本在 group 中的索引
     * @returns {Promise<{ names: string[], filePaths: string[], length: number } | null>}
     */
    async getBookInfo(index) {
        try {
            // 檢查索引是否在 group 範圍內
            if (index < 0 || index >= this.group.length) {
                console.error(`[getBookInfo] 無效的索引: ${index}`);
                return null;
            }
            const bookPath = this.group[index].local_path;
            // 調用內部函數獲取或加載書本資訊
            return await this._loadBookInfo(bookPath);
        } catch (error) {
            console.error(`[getBookInfo] 處理索引 ${index} 時發生錯誤:`, error);
            return null;
        }
    }

    /**
     * 獲取單一圖片的路徑
     * @param {number} index 書本在 group 中的索引
     * @param {number} page 頁碼
     * @returns {Promise<{ type: string, path: string } | null>}
     */
    async getImagePath(index, page) {
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
                return null;
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
    }

    /**
     * 獲取封面圖片路徑
     * @param {number} index 書本在 group 中的索引
     * @returns {Promise<{ type: string, path: string } | null>}
     */
    async getFirstImagePath(index) {
        try {
            if (index < 0 || index >= this.group.length) {
                console.error(`[getFirstImagePath] 無效的索引: ${index}`);
                return null;
            }
            const bookPath = this.group[index].local_path;

            // 1. 檢查第一層快取 (封面路徑快取)
            if (this.firstImagePathCache.has(bookPath)) {
                return { type: 'file', path: this.firstImagePathCache.get(bookPath) };
            }

            // 2. 若封面快取未命中，則加載書本資訊 (會利用 bookInfoCache)
            const bookInfo = await this._loadBookInfo(bookPath);

            if (bookInfo && bookInfo.length > 0) {
                const firstImagePath = bookInfo.filePaths[0];
                // 將結果存入封面快取
                this.firstImagePathCache.set(bookPath, firstImagePath);
                return { type: 'file', path: firstImagePath };
            } else {
                console.warn(`[getFirstImagePath] 書本不包含圖片或載入失敗: ${bookPath}`);
                return null;
            }
        } catch (error) {
            console.error(`[getFirstImagePath] 處理索引 ${index} 時發生錯誤:`, error);
            return null;
        }
    }

    /**
     * 非同步判斷指定路徑是否為有效的書本資料夾
     * @param {string} targetPath 要檢查的路徑
     * @returns {Promise<boolean>}
     */
    async isBookAsync(targetPath) {
        // 檢查 isBook 快取 (可選優化)
        if (this.isBookCache.has(targetPath)) {
            // return this.isBookCache.get(targetPath);
        }

        try {
            // 1. 檢查路徑是否存在且可讀
            await fs.access(targetPath, fs.constants.R_OK);

            // 2. 檢查是否為資料夾或壓縮檔
            const stats = await fs.stat(targetPath);

            if (stats.isFile() && isArchive(targetPath)) {
                // --- ZIP 分支 ---
                let zip;
                try {
                    zip = new StreamZipAsync({ file: targetPath });
                    const entries = await zip.entries();
                    const hasImage = Object.values(entries).some(entry =>
                        !entry.isDirectory
                        && !entry.name.startsWith('__MACOSX')
                        && imageExtensionsRegex.test(entry.name)
                    );
                    this.isBookCache.set(targetPath, hasImage);
                    return hasImage;
                } catch (zipErr) {
                    console.error(`[isBookAsync] 讀取壓縮檔失敗: ${targetPath}`, zipErr);
                    this.isBookCache.set(targetPath, false);
                    return false;
                } finally {
                    if (zip) await zip.close().catch(() => { });
                }
            }

            if (!stats.isDirectory()) {
                this.isBookCache.set(targetPath, false);
                return false;
            }

            // 3. 讀取資料夾內容，檢查是否有圖片檔案
            const dirents = await fs.readdir(targetPath, { withFileTypes: true });
            for (const dirent of dirents) {
                // 只檢查檔案，並用正規表達式匹配擴展名
                if (dirent.isFile() && imageExtensionsRegex.test(dirent.name)) {
                    this.isBookCache.set(targetPath, true);
                    return true;
                }
            }

            this.isBookCache.set(targetPath, false);
            return false;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`[isBookAsync] 檢查路徑 ${targetPath} 時發生錯誤:`, error);
            }
            this.isBookCache.set(targetPath, false);
            return false;
        }
    }

    /**
     * 根據索引清除指定書本的快取，或清除所有快取
     * @param {number | undefined} index 書本在 group 中的索引，未提供時清除全部
     * @returns {boolean}
     */
    clearCacheByIndex(index) {
        if (typeof index === 'number' && index >= 0 && index < this.group.length) {
            const bookPath = this.group[index].local_path;
            this.clearCache(bookPath);
            console.log(`[clearCacheByIndex] 已清除索引 ${index} (${bookPath}) 的快取`);
        } else {
            this.clearCache();
            console.log('[clearCacheByIndex] 已清除所有快取');
        }
        return true;
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
            // 判斷是資料夾還是壓縮檔
            if (isArchive(bookPath)) {
                return await this._loadBookInfoFromZip(bookPath);
            }
            return await this._loadBookInfoFromDir(bookPath);
        } catch (error) {
            console.error(`[_loadBookInfo] 讀取或處理書本 ${bookPath} 時發生錯誤:`, error);
            return null;
        }
    }

    /**
     * 從資料夾載入書本資訊
     */
    async _loadBookInfoFromDir(bookPath) {
        const dirents = await fs.readdir(bookPath, { withFileTypes: true });

        const imageFiles = dirents
            .filter(dirent => dirent.isFile() && imageExtensionsRegex.test(dirent.name))
            .map(dirent => dirent.name)
            .sort((a, b) => a.localeCompare(b, 'zh-Hant-TW', { numeric: true }));

        const names = imageFiles;
        const filePaths = imageFiles.map(name =>
            url.pathToFileURL(path.join(bookPath, name)).href
        );
        const length = names.length;

        const bookInfo = { names, filePaths, length };
        this.bookInfoCache.set(bookPath, bookInfo);
        return bookInfo;
    }

    /**
     * 從 ZIP 壓縮檔載入書本資訊
     */
    async _loadBookInfoFromZip(bookPath) {
        let zip;
        try {
            zip = new StreamZipAsync({ file: bookPath });
            const entries = await zip.entries();
            const imageEntries = filterAndSortZipImageEntries(entries);

            const names = imageEntries.map(name => path.basename(name));
            const filePaths = imageEntries.map(name => buildZipImageUrl(bookPath, name));
            const length = names.length;

            const bookInfo = { names, filePaths, length };
            this.bookInfoCache.set(bookPath, bookInfo);
            return bookInfo;
        } finally {
            if (zip) await zip.close().catch(() => { });
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
     * 從 ZIP 壓縮檔中讀取指定圖片的資料
     * @param {string} zipPath ZIP 檔案的絕對路徑
     * @param {string} fileName ZIP 內部的檔案路徑
     * @returns {Promise<{ buffer: Buffer, contentType: string }>}
     */
    async getZipImageData(zipPath, fileName) {
        const mimeTypes = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg',
            '.pjpeg': 'image/jpeg', '.pjp': 'image/jpeg',
            '.png': 'image/png', '.webp': 'image/webp',
            '.gif': 'image/gif', '.svg': 'image/svg+xml'
        };

        const zip = new StreamZipAsync({ file: zipPath });
        try {
            const buffer = await zip.entryData(fileName);
            const ext = path.extname(fileName).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            return { buffer, contentType };
        } finally {
            await zip.close().catch(() => {});
        }
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
            fsSync.accessSync(targetPath, fsSync.constants.R_OK);

            // 2. 檢查是否為資料夾或壓縮檔
            const stats = fsSync.statSync(targetPath);

            if (stats.isFile() && isArchive(targetPath)) {
                // --- ZIP 分支（使用 jszip-sync 同步讀取） ---
                const JSZip = require('jszip-sync');
                const zipInstance = new JSZip();
                try {
                    const data = fsSync.readFileSync(targetPath);
                    const hasImage = zipInstance.sync(function () {
                        let result = false;
                        JSZip.loadAsync(data).then(function (zip) {
                            result = Object.keys(zip.files).some(name =>
                                !name.endsWith('/')
                                && !name.startsWith('__MACOSX')
                                && !name.startsWith('.')
                                && imageExtensionsRegex.test(name)
                            );
                        });
                        return result;
                    });
                    this.isBookCache.set(targetPath, hasImage);
                    return hasImage;
                } catch (zipErr) {
                    console.error(`[isBookSync] 讀取壓縮檔失敗: ${targetPath}`, zipErr);
                    this.isBookCache.set(targetPath, false);
                    return false;
                }
            }

            if (!stats.isDirectory()) {
                this.isBookCache.set(targetPath, false);
                return false;
            }

            // 3. 讀取資料夾內容，檢查是否有圖片檔案
            const dirents = fsSync.readdirSync(targetPath, { withFileTypes: true });
            for (const dirent of dirents) {
                if (dirent.isFile() && imageExtensionsRegex.test(dirent.name)) {
                    this.isBookCache.set(targetPath, true);
                    return true;
                }
            }

            this.isBookCache.set(targetPath, false);
            return false;
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