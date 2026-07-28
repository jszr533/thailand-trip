import zlib, struct

OUT = r'D:\新建文件夹 (2)\2026-07-27-20-29-15\outputs'

def write_png(path, S):
    m = int(S * 0.10)          # margin
    r = int(S * 0.26)          # corner radius
    top = (91, 141, 239)       # #5b8def
    bot = (63, 111, 208)       # #3f6fd0
    # paper-plane triangles (normalized, centered)
    tip = (0.17, -0.20); lb = (-0.21, -0.04); rb = (-0.03, 0.23); ctr = (0.01, -0.01)

    def in_tri(px, py, a, b, c):
        def s(p1, p2, p3):
            return (p1[0]-p3[0])*(p2[1]-p3[1]) - (p2[0]-p3[0])*(p1[1]-p3[1])
        d1 = s((px, py), a, b); d2 = s((px, py), b, c); d3 = s((px, py), c, a)
        neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        return not (neg and pos)

    raw = bytearray()
    for y in range(S):
        raw.append(0)
        yy = y / S
        gr = top[0] + (bot[0]-top[0]) * yy
        gg = top[1] + (bot[1]-top[1]) * yy
        gb = top[2] + (bot[2]-top[2]) * yy
        for x in range(S):
            inside = True
            if not (m <= x <= S - m and m <= y <= S - m):
                cx = m if x < m else (S - m)
                cy = m if y < m else (S - m)
                if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                    inside = False
            if not inside:
                raw += bytes((0, 0, 0, 0))
                continue
            R, G, B = int(gr), int(gg), int(gb)
            nx = x / S - 0.5
            ny = y / S - 0.5
            if in_tri(nx, ny, tip, lb, ctr) or in_tri(nx, ny, tip, ctr, rb):
                R, G, B = 255, 255, 255
            raw += bytes((R, G, B, 255))

    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', comp)
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, len(png), 'bytes')

for s in (192, 512):
    write_png(f'{OUT}\\icon-{s}.png', s)
