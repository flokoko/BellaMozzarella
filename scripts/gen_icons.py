from PIL import Image, ImageDraw
import math

def create_icon(size, path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background: gradient 6c5ce7 -> a29bfe
    for y in range(size):
        t = y / size
        r = int(108 + (162 - 108) * t)
        g = int(92 + (155 - 92) * t)
        b = int(231 + (254 - 231) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    
    # Rounded corners
    radius = int(size * 0.22)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    img.putalpha(mask)
    
    # Cheese wheel (mozzarella)
    cx, cy = size // 2, size // 2
    r = int(size * 0.32)
    
    # Cheese body
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(253, 248, 235, 255))
    
    # Wedge cut (triangle pointing up)
    wedge_angle = 0.35
    p1 = (cx, cy)
    p2 = (cx + r * math.cos(-wedge_angle/2 - math.pi/2), cy + r * math.sin(-wedge_angle/2 - math.pi/2))
    p3 = (cx + r * math.cos(wedge_angle/2 - math.pi/2), cy + r * math.sin(wedge_angle/2 - math.pi/2))
    draw.polygon([p1, p2, p3], fill=(108, 92, 231, 255))
    
    # Cheese holes
    hole_r = max(2, int(size * 0.025))
    for hx, hy in [(cx - r*0.3, cy - r*0.2), (cx + r*0.25, cy + r*0.15), (cx - r*0.1, cy + r*0.35)]:
        draw.ellipse([hx-hole_r, hy-hole_r, hx+hole_r, hy+hole_r], fill=(230, 220, 195, 200))
    
    img.save(path, 'PNG')
    print(f"Created {path} ({size}x{size})")

create_icon(192, '/opt/data/urlaubsliste/public/icon-192.png')
create_icon(512, '/opt/data/urlaubsliste/public/icon-512.png')
create_icon(180, '/opt/data/urlaubsliste/public/apple-touch-icon.png')
print("All icons created!")