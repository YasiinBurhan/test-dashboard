import os
import zlib
import struct

def make_valid_png(width=48, height=48, color=(79, 70, 229, 255)):
    raw_data = bytearray()
    for _ in range(height):
        raw_data.append(0) # filter type 0
        for _ in range(width):
            raw_data.extend(color)
    
    def chunk(two_type, data):
        return struct.pack('>I', len(data)) + two_type + data + struct.pack('>I', zlib.crc32(two_type + data) & 0xffffffff)

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    body = zlib.compress(bytes(raw_data))
    
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', body) + chunk(b'IEND', b'')

def fix_resources(res_dir='android/app/src/main/res'):
    if not os.path.exists(res_dir):
        print(f"Directory {res_dir} does not exist.")
        return

    fixed_count = 0
    png_100 = make_valid_png(100, 100, (79, 70, 229, 255))
    png_bg = make_valid_png(100, 100, (255, 255, 255, 255))

    for root, dirs, files in os.walk(res_dir):
        for f in files:
            if f.endswith('.png'):
                path = os.path.join(root, f)
                is_valid = False
                try:
                    with open(path, 'rb') as fp:
                        header = fp.read(8)
                        if header == b'\x89PNG\r\n\x1a\n':
                            is_valid = True
                except Exception:
                    is_valid = False

                if not is_valid:
                    content = png_bg if 'background' in f else png_100
                    with open(path, 'wb') as fp:
                        fp.write(content)
                    fixed_count += 1
                    print(f"Fixed invalid PNG: {path}")

    print(f"Total invalid PNG resources fixed: {fixed_count}")

if __name__ == '__main__':
    fix_resources()
