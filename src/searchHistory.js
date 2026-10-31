// 統一紀錄格式，移除舊 order 欄位，並將缺少或無效的搜尋統計補為 0。
function normalizeHistoryList(list) {
    return list.map(item => ({
        text: item.text,
        pinned: item.pinned,
        searchCount: Number.isSafeInteger(item.searchCount) && item.searchCount >= 0 ? item.searchCount : 0,
        lastSearchedAt: Number.isSafeInteger(item.lastSearchedAt) && item.lastSearchedAt >= 0 ? item.lastSearchedAt : 0
    }));
}

// 記錄一次非空搜尋：新增紀錄或累加既有紀錄的次數，並更新最後搜尋時間。
function recordSearch(list, text, now = Date.now()) {
    list = normalizeHistoryList(list);
    if (!text.trim()) return list;

    if (!list.some(item => item.text === text)) {
        return [...list, { text, pinned: false, searchCount: 1, lastSearchedAt: now }];
    }

    return list.map(item => item.text === text ? {
        ...item,
        searchCount: item.searchCount + 1,
        lastSearchedAt: now
    } : item);
}

// 組內最近搜尋的一筆置頂，其餘依次數降序排列；同次數時以較新搜尋優先。
function sortHistoryGroup(group) {
    const sorted = group.slice().sort((a, b) =>
        b.searchCount - a.searchCount || b.lastSearchedAt - a.lastSearchedAt
    );
    let latestIndex = 0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].lastSearchedAt > sorted[latestIndex].lastSearchedAt) {
            latestIndex = i;
        }
    }
    if (latestIndex > 0) {
        sorted.unshift(sorted.splice(latestIndex, 1)[0]);
    }
    return sorted;
}

// 收藏與未收藏各自套用組內排序，再將收藏組放在未收藏組前方。
function sortHistoryList(list) {
    list = normalizeHistoryList(list);
    return [
        ...sortHistoryGroup(list.filter(item => item.pinned)),
        ...sortHistoryGroup(list.filter(item => !item.pinned))
    ];
}

module.exports = { recordSearch, sortHistoryList };
