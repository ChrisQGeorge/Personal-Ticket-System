"""Generate simple placeholder icons for the Chrome extension."""
import struct
import zlib
import os

def create_png(width, height, color=(79, 70, 229)):
    """Create a minimal PNG with a solid color and a 'P' letter shape."""
    r, g, b = color

    # Create raw pixel data (RGBA)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            # Draw a simple "P" shape in white on the colored background
            nx = x / width  # normalized 0-1
            ny = y / height
            is_letter = False

            # Vertical bar of P (left side)
            if 0.25 <= nx <= 0.40 and 0.15 <= ny <= 0.85:
                is_letter = True
            # Top horizontal bar of P
            if 0.25 <= nx <= 0.65 and 0.15 <= ny <= 0.30:
                is_letter = True
            # Right curve of P (simplified as vertical bar)
            if 0.60 <= nx <= 0.75 and 0.15 <= ny <= 0.55:
                is_letter = True
            # Middle horizontal bar of P
            if 0.25 <= nx <= 0.65 and 0.45 <= ny <= 0.55:
                is_letter = True

            if is_letter:
                raw_data += bytes([255, 255, 255, 255])
            else:
                raw_data += bytes([r, g, b, 255])

    compressed = zlib.compress(raw_data)

    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    for size in [16, 48, 128]:
        path = os.path.join(icons_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(create_png(size, size))
        print(f'Created {path}')
    print('Icons created!')
