// static/js/app.js -- 最终版 (已实现高亮点击和指定Prompt)

document.addEventListener('DOMContentLoaded', () => {
    console.log("页面加载完成，JS开始执行！");

    const state = { currentPage: 1, totalPages: 1, currentQuery: '', currentSearchType: 'work', currentResults: [], currentWork: null };

    // ==================== DOM 元素获取 ====================
    const appContainer = document.getElementById('app-container');
    const resultsView = document.getElementById('results-view');
    const detailsView = document.getElementById('details-view');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicatorBtn = document.getElementById('page-indicator-btn');
    const searchInput = document.getElementById('search-input');
    const searchTypeControls = document.querySelector('.search-type-controls');
    const resultsList = document.getElementById('results-list');
    const placeholder = document.getElementById('placeholder');
    const loader = document.getElementById('loader');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const articleSearchInput = document.getElementById('article-search-input');
    const articleSearchBtn = document.getElementById('article-search-btn');
    const detailContent = document.getElementById('detail-content');
    const dictInput = document.getElementById('dict-input');
    const dictBtn = document.getElementById('dict-btn');
    const dictResult = document.getElementById('dict-result');
    const detailExtras = document.getElementById('detail-extras');
    const aiModal = document.getElementById('ai-modal');
    const aiModalCloseBtn = document.querySelector('.modal-close-btn');
    const aiPrompt = document.getElementById('ai-prompt');
    const aiExplanation = document.getElementById('ai-explanation');

    if (!detailContent) {
        console.error("严重错误：无法找到 ID 为 'detail-content' 的核心元素！");
        return;
    }
    
    // ==================== 事件监听 ====================
    
    // 【已实现需求1】只响应对高亮区域的点击
    detailContent.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('ai-trigger-highlight')) {
            const clickedText = target.textContent;
            const fullText = detailContent.textContent;
            let sentence = '';
            const selectionStartIndex = fullText.indexOf(clickedText);
            if (selectionStartIndex !== -1) {
                const prevPeriod = fullText.lastIndexOf('。', selectionStartIndex);
                const nextPeriod = fullText.indexOf('。', selectionStartIndex + clickedText.length);
                const start = prevPeriod !== -1 ? prevPeriod + 1 : 0;
                const end = nextPeriod !== -1 ? nextPeriod : fullText.length;
                sentence = fullText.substring(start, end).trim();
            } else {
                sentence = detailContent.textContent.substring(0, 100);
            }
            
            // 【已实现需求2】构造包含特定系统提示词的请求
            // 用户看到的部分
            const userPrompt = `在“${sentence}”这个语境下，分析“${clickedText}”的意思。`;
            // 实际发送给后端的完整请求内容
            const fullPromptForAPI = `在句子：“${sentence}”中，“${clickedText}”的意思是什么？`;
            
            showAIModal(userPrompt, fullPromptForAPI);
        }
    });
    
    // 其他事件监听...
    resultsList.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.button-action');
        if (!actionBtn) return;
        const index = actionBtn.dataset.index;
        const resultType = actionBtn.dataset.type;
        if (index === undefined) { console.error("错误：按钮上没有找到 data-index 属性。"); return; }
        const itemData = state.currentResults[index];
        if (!itemData) { console.error(`错误：无法在 currentResults 中找到索引为 ${index} 的数据。`); return; }
        if (resultType === 'person') {
            searchInput.value = itemData.Name;
            document.querySelector('.search-type-btn[data-type="author"]').click();
        } else if (resultType === 'work') {
            state.currentWork = itemData;
            showDetails();
        }
    });
    searchTypeControls.addEventListener('click', (e) => { if (e.target.classList.contains('search-type-btn')) { document.querySelectorAll('.search-type-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); state.currentSearchType = e.target.dataset.type; performSearch(1); } });
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(1); });
    pageIndicatorBtn.addEventListener('click', () => { const text = pageIndicatorBtn.textContent; if (text === '搜索' || text.includes('/')) { performSearch(1); } else if (text === '返回') { switchView('results'); } });
    prevPageBtn.addEventListener('click', () => { if (state.currentPage > 1) performSearch(state.currentPage - 1); });
    nextPageBtn.addEventListener('click', () => { if (state.currentPage < state.totalPages) performSearch(state.currentPage + 1); });
    backToListBtn.addEventListener('click', () => switchView('results'));
    articleSearchBtn.addEventListener('click', handleArticleSearch);
    articleSearchInput.addEventListener('keyup', e => { if (e.key === 'Enter') handleArticleSearch(); });
    dictBtn.addEventListener('click', handleDictionarySearch);
    dictInput.addEventListener('keyup', e => { if (e.key === 'Enter') handleDictionarySearch(); });
    aiModalCloseBtn.addEventListener('click', () => aiModal.classList.add('hidden'));
    aiModal.addEventListener('click', (e) => { if (e.target === aiModal) aiModal.classList.add('hidden'); });

    // ==================== 核心功能函数 ====================

    function showDetails() {
        const work = state.currentWork;
        if (!work) { console.error("showDetails 错误：state.currentWork 为空"); return; }
        switchView('details');
        try {
            const isCi = work.Kind && !work.Kind.includes("诗");
            const safeContent = work.Content.replace(/</g, "<").replace(/>/g, ">");
            const contentHtml = safeContent.replace(/\r\n/g, '<br>');
            detailContent.innerHTML = `<h2>${work.Title}</h2><p class="author">[${work.Dynasty}] ${work.Author}</p><div class="main-content ${isCi ? 'main-content-ci' : ''}">${contentHtml}</div>`;
            detailContent.originalHTML = detailContent.innerHTML;
            let extrasHtml = '';
            if (work.Translation) extrasHtml += `<h4>译文</h4><p>${work.Translation.replace(/\r\n/g, '<br>')}</p>`;
            if (work.Annotation) extrasHtml += `<h4>注释</h4><p>${work.Annotation.replace(/\r\n/g, '<br>')}</p>`;
            if (work.Intro) extrasHtml += `<h4>评析</h4><p>${work.Intro.replace(/\r\n/g, '<br>')}</p>`;
            if (work.Comment) extrasHtml += `<h4>评论</h4><p>${work.Comment.replace(/\r\n/g, '<br>')}</p>`;
            detailExtras.innerHTML = extrasHtml || '<p>暂无相关资料。</p>';
            dictInput.value = state.currentQuery;
            setTimeout(() => {
                handleArticleSearch(state.currentQuery);
                handleDictionarySearch();
            }, 0);
        } catch (error) {
            console.error("填充详情时发生错误:", error);
            detailContent.innerHTML = "<p>加载详情时出错。</p>";
        }
    }

    function switchView(viewName) {
        if (viewName === 'details') {
            resultsView.classList.add('hidden');
            detailsView.classList.remove('hidden');
            pageIndicatorBtn.textContent = '返回';
        } else {
            detailsView.classList.add('hidden');
            resultsView.classList.remove('hidden');
            updatePagination();
        }
    }

    async function performSearch(page) {
        const query = searchInput.value.trim();
        if (!query) { alert('请输入搜索关键词！'); return; }
        state.currentQuery = query; state.currentPage = page;
        loader.classList.remove('hidden'); placeholder.classList.add('hidden');
        resultsList.innerHTML = '';
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(state.currentQuery)}&type=${state.currentSearchType}&page=${state.currentPage}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            state.currentResults = data.results;
            state.totalPages = data.total_pages;
            renderResults(data.results, data.result_type);
            updatePagination();
        } catch (error) {
            console.error('搜索失败:', error);
            resultsList.innerHTML = `<p class="placeholder-text">搜索失败，请检查网络。</p>`;
        } finally {
            loader.classList.add('hidden');
        }
    }

    function updatePagination() {
        if (state.totalPages > 0) { pageIndicatorBtn.textContent = `${state.currentPage}/${state.totalPages}`; } 
        else { pageIndicatorBtn.textContent = '搜索'; }
        prevPageBtn.disabled = state.currentPage <= 1;
        nextPageBtn.disabled = state.currentPage >= state.totalPages;
    }

    function renderResults(results, resultType) {
        resultsList.innerHTML = '';
        if (results.length === 0) { resultsList.innerHTML = `<p class="placeholder-text">未找到结果。</p>`; return; }
        results.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'result-item';
            if (resultType === 'person') {
                itemDiv.innerHTML = `<div class="result-item-content"><h3 class="item-title" style="color: red;">${item.Name}</h3><p class="item-author">[${item.Dynasty}] ${item.BirthYear}-${item.DeathYear}</p><p class="item-snippet">${item.Desc ? item.Desc.substring(0, 100) + '...' : '暂无简介'}</p></div><div class="result-item-actions"><button class="button button-action" data-index="${index}" data-type="person">查看作品</button></div>`;
            } else {
                const highlightRegex = new RegExp(state.currentQuery, 'gi');
                const title = item.Title.replace(highlightRegex, `<span class="highlight">${state.currentQuery}</span>`);
                const content = item.Content.replace(/[\r\n\s]+/g, ' ').substring(0, 100);
                const snippet = content.replace(highlightRegex, `<span class="highlight">${state.currentQuery}</span>`);
                itemDiv.innerHTML = `<div class="result-item-content"><h3 class="item-title">${title}</h3><p class="item-author">[${item.Dynasty}] ${item.Author}</p><p class="item-snippet">${snippet}...</p></div><div class="result-item-actions"><button class="button button-action" data-index="${index}" data-type="work">详情</button></div>`;
            }
            resultsList.appendChild(itemDiv);
        });
    }

    function handleArticleSearch(queryOrEvent) {
        const query = typeof queryOrEvent === 'string' ? queryOrEvent : articleSearchInput.value.trim();
        let contentHTML = detailContent.originalHTML;
        if (query) {
            const addHighlightRegex = new RegExp(query + '(?![^<]*>|[^<>]*</)', 'gi');
            contentHTML = contentHTML.replace(addHighlightRegex, `<span class="ai-trigger-highlight">${query}</span>`);
        }
        detailContent.innerHTML = contentHTML;
    }

    async function handleDictionarySearch() {
        // ... (此函数无需修改，保持原样)
        const query = dictInput.value.trim();
        if (!query) return;
        dictResult.textContent = '查询中...';
        try {
            const charToSearch = query.charAt(0);
            const response = await fetch(`/api/dict?char=${encodeURIComponent(charToSearch)}`);
            const data = await response.json();
            if (data.error) {
                dictResult.textContent = `${charToSearch}: ${data.error}`;
            } else {
                let html = `<strong>${data.char}</strong><br>`;
                for (const pinyin in data.definitions) {
                    html += `<em>${pinyin}:</em><ul>`;
                    data.definitions[pinyin].forEach(def => { html += `<li>${def}</li>`; });
                    html += `</ul>`;
                }
                dictResult.innerHTML = html;
            }
        } catch (error) {
            console.error('查词失败:', error);
            dictResult.textContent = '查询失败。';
        }
    }

    // 【已实现需求2】showAIModal 现在接收两个参数
    async function showAIModal(displayPrompt, apiPrompt) {
        aiModal.classList.remove('hidden');
        aiPrompt.textContent = displayPrompt; // 在弹窗里显示给用户看的友好提示
        aiExplanation.textContent = '正在连接AI，请稍候...';
        try {
            const response = await fetch('/api/ai-explain', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ prompt: apiPrompt }), // 发送给API的是更精确的、不包含系统指令的prompt
            });
            if (!response.ok) throw new Error(`AI服务响应错误: ${response.statusText}`);
            aiExplanation.textContent = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                aiExplanation.textContent += chunk;
            }
        } catch (error) {
            console.error('AI请求失败:', error);
            aiExplanation.textContent = `请求失败: ${error.message}`;
        }
    }

    // 初始时，确保详情页是隐藏的
    switchView('results');
});