# app.py -- 最终部署版

import os
import json
from flask import Flask, request, jsonify, render_template, Response, send_from_directory
import requests
import search  # 导入您现有的搜索模块

# 初始化 Flask 应用
app = Flask(__name__, static_folder='../static', template_folder='templates')

# 在应用启动时预加载字典数据到内存，提高性能
try:
    with open("data-chars.js", "r", encoding="utf-8") as f:
        DICTIONARY_DATA = json.load(f)
except Exception as e:
    DICTIONARY_DATA = {}
    print(f"警告：加载字典 data-chars.js 失败: {e}")


# ==================== 路由 (Routes) ====================

@app.route('/')
def index():
    """
    主页路由，负责渲染 index.html 模板。
    """
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    """
    提供浏览器标签页图标。
    这是一个可选的优化，可以避免服务器日志中出现 404 错误。
    """
    return send_from_directory(os.path.join(app.root_path, 'static', 'images'),
                               'favicon.png', mimetype='image/png')

# ==================== API 接口 (API Endpoints) ====================

@app.route('/api/search', methods=['GET'])
def api_search():
    """
    核心搜索 API。
    接收参数: q (查询词), type (搜索类型: person, author, work), page (页码)
    """
    query = request.args.get('q', '')
    search_type = request.args.get('type', 'work') 
    page = int(request.args.get('page', 1))
    per_page = 8

    if not query:
        return jsonify({"error": "查询词不能为空"}), 400

    results = []
    
    # 根据前端传递的搜索类型，调用 search.py 中不同的逻辑
    if search_type == 'person':
        authors_results, _ = search.search_author(query)
        results = authors_results
    elif search_type == 'author':
        _, works_results = search.search_author(query)
        results = works_results
    elif search_type == 'work':
        results = search.search_work(query)
    
    # 分页逻辑
    total_items = len(results)
    total_pages = (total_items + per_page - 1) // per_page if per_page > 0 else 0
    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_results = results[start_index:end_index]

    # 为了方便前端处理，明确告知返回的结果是'person'还是'work'
    result_item_type = 'person' if search_type == 'person' else 'work'

    return jsonify({
        "results": paginated_results,
        "result_type": result_item_type,
        "page": page,
        "total_pages": total_pages,
        "total_results": total_items
    })


@app.route('/api/dict', methods=['GET'])
def api_dict():
    """
    字典查询 API。
    """
    char = request.args.get('char', '')
    if not char:
        return jsonify({"error": "查询的字不能为空"}), 400
    
    char_to_search = char.strip()[0] if char.strip() else ''
    if not char_to_search:
        return jsonify({"error": "查询的字不能为空"}), 400

    definitions = DICTIONARY_DATA.get(char_to_search, None)
    
    if definitions:
        return jsonify({"char": char_to_search, "definitions": definitions})
    else:
        return jsonify({"char": char_to_search, "error": "未找到释义"}), 404


@app.route('/api/ai-explain', methods=['POST'])
def ai_explain_stream():
    """
    AI 解释功能的流式 API。
    作为代理，安全地调用外部 AI 服务。
    """
    data = request.get_json()
    prompt = data.get('prompt')

    if not prompt:
        return Response("Prompt is missing", status=400)

    # 【部署安全关键】从环境变量中获取 API 密钥
    api_key = os.environ.get('SILICONFLOW_API_KEY')
    if not api_key:
        # 如果在服务器上没有设置这个环境变量，就向前端返回明确的错误信息
        def error_generator():
            yield "【服务器配置错误】：管理员未设置API密钥。"
        return Response(error_generator(), mimetype='text/plain', status=500)

    def generate():
        try:
            url = "https://api.siliconflow.cn/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}", # 使用从环境变量获取的密钥
                "Content-Type": "application/json"
            }
            payload = {
                "model": "deepseek-ai/DeepSeek-V3",
                "messages": [{
                    "role": "system",
                    "content": "你是一位中国古典文学专家，请用专业但易懂的方式进行分析并返回简明易懂的结果"
                }, {
                    "role": "user",
                    "content": prompt
                }],
                "stream": True,
                "temperature": 0.3
            }
            
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=30) as r:
                r.raise_for_status() # 如果请求失败 (如 401, 403), 会抛出异常
                for chunk in r.iter_lines():
                    if chunk:
                        decoded_chunk = chunk.decode('utf-8')
                        if decoded_chunk.startswith("data:"):
                            content = decoded_chunk[5:].strip()
                            if content and content != "[DONE]":
                                try:
                                    data_chunk = json.loads(content)
                                    delta = data_chunk['choices'][0]['delta']
                                    text_chunk = delta.get('content', '')
                                    if text_chunk:
                                        yield text_chunk
                                except (json.JSONDecodeError, KeyError, IndexError):
                                    continue # 忽略格式不正确的 chunk
        except requests.exceptions.RequestException as e:
            print(f"AI请求异常: {e}") # 在服务器日志中打印错误
            yield f"\n【请求AI时出错】: 无法连接到AI服务，请稍后再试或联系管理员。"

    return Response(generate(), mimetype='text/plain')


# ==================== 主程序入口 ====================
if __name__ == '__main__':
    # 这个模式只在本地开发时使用
    # 部署时，Gunicorn 会直接调用名为 app 的 Flask 实例
    app.run(host='0.0.0.0', port=5000, debug=True)