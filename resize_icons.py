import os
from PIL import Image

img_path = 'public/lungs.jpg'
icons_dir = 'public/icons'
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

if not os.path.exists(img_path):
    print(f'Error: {img_path} Not Visible!')
else:
    img = Image.open(img_path)
    for size in sizes:
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        save_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
        resized_img.save(save_path, 'PNG')
        print(f'Create ayyindi: icon-{size}x{size}.png')
    print('All Icons Are Ready!')
