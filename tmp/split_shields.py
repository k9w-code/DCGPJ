import os
from PIL import Image

def split_shields(input_path, output_dir):
    img = Image.open(input_path)
    width, height = img.size
    
    # 画像全体の幅を3等分
    part_width = width // 3
    
    # 左: intact, 中央: back, 右: broken
    parts = ['intact.png', 'back.png', 'broken.png']
    
    for i, name in enumerate(parts):
        left = i * part_width
        right = (i + 1) * part_width if i < 2 else width
        
        # 切り抜き（余白があるかもしれないので少し調整が必要かもしれないが、まずは均等割り）
        cropped = img.crop((left, 0, right, height))
        
        # 透明な背景を維持しつつ、トリミング
        # (今回は単純に3分割とする)
        
        output_path = os.path.join(output_dir, name)
        cropped.save(output_path)
        print(f"Saved {output_path}")

if __name__ == "__main__":
    # 最新の media__*.png を探す (ここでは特定できないので引数または検索が必要)
    import glob
    # ユーザーのデスクトップやダウンロード、またはテンポラリを検索
    # ここでは便宜上 /tmp などを想定
    media_files = glob.glob(r"C:\Users\imai\AppData\Local\Temp\media__*.png")
    if not media_files:
        print("No media files found.")
    else:
        latest_media = max(media_files, key=os.path.getmtime)
        print(f"Processing latest media: {latest_media}")
        split_shields(latest_media, r"C:\Users\imai\workspace\dcgpj\public\assets\images\icon\shield")
