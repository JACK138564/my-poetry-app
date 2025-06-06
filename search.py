import numpy as np
import requests  # 确保这个库在你的 requirements.txt 文件里
import io

# --- 1. 全局变量定义 ---
# 用于缓存已加载的数据，初始为 None
works = None
authors = None

# --- 2. 你的真实数据 URL ---
# 已将你提供的 URL 填入
WORKS_URL = "https://vaa9wcw8piuaxtko.public.blob.vercel-storage.com/works-aM2Ytqn4PaIPyTEft2yN9svPdBvP6s.npy"
AUTHORS_URL = "https://vaa9wcw8piuaxtko.public.blob.vercel-storage.com/authors-PDG10ZaYHLbjIW5LI9Hueu8ss87srQ.npy"

def load_data():
    """
    从云端加载 'works' 和 'authors' 数据。
    使用全局变量作为缓存，确保在单个 Serverless Function 实例的生命周期内
    只对每个文件执行一次下载和加载。
    """
    global works, authors

    # --- 加载 works.npy ---
    if works is None:
        print(f"Works data not cached. Downloading from {WORKS_URL}...")
        try:
            response_works = requests.get(WORKS_URL, timeout=60) # works 文件较大，超时设置长一些
            response_works.raise_for_status()
            print("Works download complete. Loading data into numpy...")
            file_like_works = io.BytesIO(response_works.content)
            works = np.load(file_like_works, allow_pickle=True)
            print("Works data loaded and cached successfully.")
        except Exception as e:
            print(f"FATAL: Failed to load works data. Error: {e}")
            raise # 抛出异常以中断执行并返回 500 错误

    # --- 加载 authors.npy ---
    if authors is None:
        print(f"Authors data not cached. Downloading from {AUTHORS_URL}...")
        try:
            response_authors = requests.get(AUTHORS_URL, timeout=30)
            response_authors.raise_for_status()
            print("Authors download complete. Loading data into numpy...")
            file_like_authors = io.BytesIO(response_authors.content)
            authors = np.load(file_like_authors, allow_pickle=True)
            print("Authors data loaded and cached successfully.")
        except Exception as e:
            print(f"FATAL: Failed to load authors data. Error: {e}")
            raise # 抛出异常以中断执行并返回 500 错误


# --- 3. 在模块第一次被导入时，就主动加载所有数据 ---
# 这会让首次 API 请求稍慢，但后续请求会很快
try:
    load_data()
except Exception as e:
    # 如果在模块加载时就失败，打印一个全局的错误信息
    print(f"CRITICAL: Data loading failed during initial module import. Application might not work. Error: {e}")


# --- 4. 你原有的搜索函数保持不变 ---
# 它们现在会直接使用已经加载到内存中的全局变量 'works' 和 'authors'

def search_work(search_text):
    # 增加一个保险检查，如果数据加载失败，函数不会崩溃
    if works is None:
        print("Error in search_work: 'works' data is not available.")
        return []

    result = []
    i = 0
    for work in works:
        if (search_text in work["Content"]) or (search_text in work["Title"]):
            result.append(work)
            i += 1
        if i >= 799:
            break
    return result

def search_author(search_text):
    # 增加保险检查
    if authors is None or works is None:
        print("Error in search_author: Data is not available.")
        return [], []

    result1 = []
    result2 = []
    i = 0
    for author in authors:
        if search_text in author["Name"]:
            result1.append(author)
            i += 1
        if i >= 799:
            break
    
    i = 0
    for work in works:
        if (search_text in work["Author"]):
            result2.append(work)
            i += 1
        if i >= 799:
            break
            
    return result1, result2