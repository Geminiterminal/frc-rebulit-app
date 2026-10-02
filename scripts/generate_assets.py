import zlib
import struct
import math

def create_png(width, height, get_pixel):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter byte 0: None
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw_data.extend((r, g, b, a))
    
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

# 1. Generate PWA App Icons (192, 512, maskable 512, apple-touch 180)
def generate_icon(size, is_maskable=False):
    def pixel(x, y):
        cx, cy = size / 2.0, size / 2.0
        dx = x - cx
        dy = y - cy
        dist = math.sqrt(dx * dx + dy * dy)
        max_r = size / 2.0
        
        # Background: dark charcoal slate
        bg_r, bg_g, bg_b = 15, 23, 42
        
        # Hexagon / robot ring
        scale = 0.35 if is_maskable else 0.42
        ring_r = size * scale
        ring_inner = ring_r - (size * 0.08)
        
        # Check if inside outer hex ring
        # Draw tech ring
        if ring_inner <= dist <= ring_r:
            # Cyan to electric blue
            angle = math.atan2(dy, dx)
            blend = (math.sin(angle * 3) + 1) / 2
            return int(37 + blend * 20), int(99 + blend * 120), int(235 + blend * 20), 255
            
        # Draw central hexagon hub
        hub_r = size * 0.16
        if dist <= hub_r:
            return 245, 158, 11, 255 # amber/gold core
            
        hub_center_hole = size * 0.06
        if dist <= hub_center_hole:
            return bg_r, bg_g, bg_b, 255
            
        # Subtle grid/cross lines
        if abs(dx) < 2 and dist < ring_r * 1.3:
            return 59, 130, 246, 120
        if abs(dy) < 2 and dist < ring_r * 1.3:
            return 239, 68, 68, 120
            
        return bg_r, bg_g, bg_b, 255

    return create_png(size, size, pixel)

# Generate assets
print("Generating PWA icons...")
with open("public/pwa-192x192.png", "wb") as f:
    f.write(generate_icon(192, False))

with open("public/pwa-512x512.png", "wb") as f:
    f.write(generate_icon(512, False))

with open("public/pwa-maskable-512x512.png", "wb") as f:
    f.write(generate_icon(512, True))

with open("public/apple-touch-icon.png", "wb") as f:
    f.write(generate_icon(180, False))

with open("public/favicon.ico", "wb") as f:
    # 32x32 PNG is valid for modern favicons
    f.write(generate_icon(32, False))

# Generate public/icon.svg
svg_icon = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="#2563eb" stroke-width="24" stroke-dasharray="80 20"/>
  <polygon points="256,120 374,188 374,324 256,392 138,324 138,188" fill="#1e293b" stroke="#38bdf8" stroke-width="16"/>
  <circle cx="256" cy="256" r="50" fill="#f59e0b" stroke="#fbbf24" stroke-width="8"/>
  <circle cx="256" cy="256" r="20" fill="#0f172a"/>
  <line x1="256" y1="60" x2="256" y2="452" stroke="#60a5fa" stroke-width="6" stroke-opacity="0.4"/>
  <line x1="60" y1="256" x2="452" y2="256" stroke="#ef4444" stroke-width="6" stroke-opacity="0.4"/>
</svg>'''
with open("public/icon.svg", "w") as f:
    f.write(svg_icon)

# Generate Field SVG matching exact screenshot (straight vertical orientation)
svg_field = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 1000" width="100%" height="100%">
  <!-- Field Floor -->
  <rect width="500" height="1000" fill="#090c15"/>
  
  <!-- Outer Perimeter White Border -->
  <rect x="10" y="40" width="480" height="930" fill="none" stroke="#ffffff" stroke-width="3" rx="2"/>

  <!-- Center Longitudinal Cable Runner Line -->
  <line x1="250" y1="40" x2="250" y2="970" stroke="#000000" stroke-width="5"/>

  <!-- White Center Field Line -->
  <line x1="10" y1="500" x2="490" y2="500" stroke="#ffffff" stroke-width="2"/>

  <!-- BLUE ALLIANCE (UPPER HALF) -->
  <!-- Top alliance goal/station black rect & blue bar -->
  <rect x="195" y="40" width="110" height="55" fill="#000000"/>
  <line x1="190" y1="95" x2="310" y2="95" stroke="#1d4ed8" stroke-width="4"/>
  <line x1="190" y1="91" x2="190" y2="99" stroke="#1d4ed8" stroke-width="3"/>
  <line x1="310" y1="91" x2="310" y2="99" stroke="#1d4ed8" stroke-width="3"/>

  <!-- Blue Loading Bay / Corral with yellow power cells (Top Right) -->
  <rect x="325" y="42" width="60" height="42" fill="#090c15" stroke="#1d4ed8" stroke-width="3"/>
  <!-- 5x5 balls in loading bay -->
  <g fill="#ca8a04" stroke="#a16207" stroke-width="0.8">
    <circle cx="333" cy="49" r="3.2"/><circle cx="343" cy="49" r="3.2"/><circle cx="353" cy="49" r="3.2"/><circle cx="363" cy="49" r="3.2"/><circle cx="373" cy="49" r="3.2"/>
    <circle cx="333" cy="57" r="3.2"/><circle cx="343" cy="57" r="3.2"/><circle cx="353" cy="57" r="3.2"/><circle cx="363" cy="57" r="3.2"/><circle cx="373" cy="57" r="3.2"/>
    <circle cx="333" cy="65" r="3.2"/><circle cx="343" cy="65" r="3.2"/><circle cx="353" cy="65" r="3.2"/><circle cx="363" cy="65" r="3.2"/><circle cx="373" cy="65" r="3.2"/>
    <circle cx="333" cy="73" r="3.2"/><circle cx="343" cy="73" r="3.2"/><circle cx="353" cy="73" r="3.2"/><circle cx="363" cy="73" r="3.2"/><circle cx="373" cy="73" r="3.2"/>
  </g>

  <!-- Top Left alliance wall balls -->
  <g fill="#ca8a04" stroke="#a16207" stroke-width="0.8">
    <circle cx="30" cy="35" r="3.2"/><circle cx="38" cy="35" r="3.2"/><circle cx="46" cy="35" r="3.2"/><circle cx="54" cy="35" r="3.2"/><circle cx="62" cy="35" r="3.2"/>
  </g>

  <!-- Blue Trench Run & Bump Lines -->
  <line x1="10" y1="265" x2="490" y2="265" stroke="#1e40af" stroke-width="3"/>
  <line x1="10" y1="300" x2="490" y2="300" stroke="#1d4ed8" stroke-width="3"/>

  <!-- Blue Structure / Shield Generator Truss & Hub (y: 265 to 335) -->
  <rect x="85" y="265" width="330" height="70" fill="#172554" stroke="#1e3a8a" stroke-width="2"/>
  <!-- Structure Pillars / Bumps -->
  <rect x="85" y="260" width="18" height="80" fill="#1e3a8a"/>
  <rect x="397" y="260" width="18" height="80" fill="#1e3a8a"/>
  <!-- Mid dividing line in blue structure -->
  <line x1="85" y1="300" x2="415" y2="300" stroke="#1e40af" stroke-width="1.5"/>

  <!-- Blue Hexagon Center Hub with target rings -->
  <polygon points="250,268 282,284 282,316 250,332 218,316 218,284" fill="#172554" stroke="#3b82f6" stroke-width="2"/>
  <circle cx="250" cy="300" r="14" fill="none" stroke="#60a5fa" stroke-width="1.5"/>
  <circle cx="250" cy="300" r="6" fill="none" stroke="#93c5fd" stroke-width="1.5"/>
  <circle cx="250" cy="300" r="2" fill="#bfdbfe"/>

  <!-- CENTER POWER CELLS / RENDEZVOUS GRID (y around 500) -->
  <g fill="#ca8a04" stroke="#a16207" stroke-width="0.8">
    <!-- Left block: 10 cols x 5 rows -->
    <!-- Rows: y = 455, 475, 495, 515, 535 -->
    <!-- Cols: x from 115 to 232, step 13 -->
    <g>
      <circle cx="115" cy="455" r="4.5"/><circle cx="128" cy="455" r="4.5"/><circle cx="141" cy="455" r="4.5"/><circle cx="154" cy="455" r="4.5"/><circle cx="167" cy="455" r="4.5"/><circle cx="180" cy="455" r="4.5"/><circle cx="193" cy="455" r="4.5"/><circle cx="206" cy="455" r="4.5"/><circle cx="219" cy="455" r="4.5"/><circle cx="232" cy="455" r="4.5"/>
      <circle cx="115" cy="475" r="4.5"/><circle cx="128" cy="475" r="4.5"/><circle cx="141" cy="475" r="4.5"/><circle cx="154" cy="475" r="4.5"/><circle cx="167" cy="475" r="4.5"/><circle cx="180" cy="475" r="4.5"/><circle cx="193" cy="475" r="4.5"/><circle cx="206" cy="475" r="4.5"/><circle cx="219" cy="475" r="4.5"/><circle cx="232" cy="475" r="4.5"/>
      <circle cx="115" cy="495" r="4.5"/><circle cx="128" cy="495" r="4.5"/><circle cx="141" cy="495" r="4.5"/><circle cx="154" cy="495" r="4.5"/><circle cx="167" cy="495" r="4.5"/><circle cx="180" cy="495" r="4.5"/><circle cx="193" cy="495" r="4.5"/><circle cx="206" cy="495" r="4.5"/><circle cx="219" cy="495" r="4.5"/><circle cx="232" cy="495" r="4.5"/>
      <circle cx="115" cy="515" r="4.5"/><circle cx="128" cy="515" r="4.5"/><circle cx="141" cy="515" r="4.5"/><circle cx="154" cy="515" r="4.5"/><circle cx="167" cy="515" r="4.5"/><circle cx="180" cy="515" r="4.5"/><circle cx="193" cy="515" r="4.5"/><circle cx="206" cy="515" r="4.5"/><circle cx="219" cy="515" r="4.5"/><circle cx="232" cy="515" r="4.5"/>
      <circle cx="115" cy="535" r="4.5"/><circle cx="128" cy="535" r="4.5"/><circle cx="141" cy="535" r="4.5"/><circle cx="154" cy="535" r="4.5"/><circle cx="167" cy="535" r="4.5"/><circle cx="180" cy="535" r="4.5"/><circle cx="193" cy="535" r="4.5"/><circle cx="206" cy="535" r="4.5"/><circle cx="219" cy="535" r="4.5"/><circle cx="232" cy="535" r="4.5"/>
    </g>
    <!-- Right block: 10 cols x 5 rows -->
    <g>
      <circle cx="268" cy="455" r="4.5"/><circle cx="281" cy="455" r="4.5"/><circle cx="294" cy="455" r="4.5"/><circle cx="307" cy="455" r="4.5"/><circle cx="320" cy="455" r="4.5"/><circle cx="333" cy="455" r="4.5"/><circle cx="346" cy="455" r="4.5"/><circle cx="359" cy="455" r="4.5"/><circle cx="372" cy="455" r="4.5"/><circle cx="385" cy="455" r="4.5"/>
      <circle cx="268" cy="475" r="4.5"/><circle cx="281" cy="475" r="4.5"/><circle cx="294" cy="475" r="4.5"/><circle cx="307" cy="475" r="4.5"/><circle cx="320" cy="475" r="4.5"/><circle cx="333" cy="475" r="4.5"/><circle cx="346" cy="475" r="4.5"/><circle cx="359" cy="475" r="4.5"/><circle cx="372" cy="475" r="4.5"/><circle cx="385" cy="475" r="4.5"/>
      <circle cx="268" cy="495" r="4.5"/><circle cx="281" cy="495" r="4.5"/><circle cx="294" cy="495" r="4.5"/><circle cx="307" cy="495" r="4.5"/><circle cx="320" cy="495" r="4.5"/><circle cx="333" cy="495" r="4.5"/><circle cx="346" cy="495" r="4.5"/><circle cx="359" cy="495" r="4.5"/><circle cx="372" cy="495" r="4.5"/><circle cx="385" cy="495" r="4.5"/>
      <circle cx="268" cy="515" r="4.5"/><circle cx="281" cy="515" r="4.5"/><circle cx="294" cy="515" r="4.5"/><circle cx="307" cy="515" r="4.5"/><circle cx="320" cy="515" r="4.5"/><circle cx="333" cy="515" r="4.5"/><circle cx="346" cy="515" r="4.5"/><circle cx="359" cy="515" r="4.5"/><circle cx="372" cy="515" r="4.5"/><circle cx="385" cy="515" r="4.5"/>
      <circle cx="268" cy="535" r="4.5"/><circle cx="281" cy="535" r="4.5"/><circle cx="294" cy="535" r="4.5"/><circle cx="307" cy="535" r="4.5"/><circle cx="320" cy="535" r="4.5"/><circle cx="333" cy="535" r="4.5"/><circle cx="346" cy="535" r="4.5"/><circle cx="359" cy="535" r="4.5"/><circle cx="372" cy="535" r="4.5"/><circle cx="385" cy="535" r="4.5"/>
    </g>
  </g>

  <!-- Dashed center guideline over balls -->
  <line x1="110" y1="500" x2="390" y2="500" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 4"/>

  <!-- RED ALLIANCE (LOWER HALF) -->
  <!-- Red Trench Run & Bump Lines -->
  <line x1="10" y1="708" x2="490" y2="708" stroke="#dc2626" stroke-width="3"/>
  <line x1="10" y1="742" x2="490" y2="742" stroke="#b91c1c" stroke-width="3"/>

  <!-- Red Structure / Shield Generator Truss & Hub (y: 675 to 745) -->
  <rect x="85" y="675" width="330" height="70" fill="#450a0a" stroke="#7f1d1d" stroke-width="2"/>
  <!-- Structure Pillars / Bumps -->
  <rect x="85" y="670" width="18" height="80" fill="#7f1d1d"/>
  <rect x="397" y="670" width="18" height="80" fill="#7f1d1d"/>
  <!-- Mid dividing line in red structure -->
  <line x1="85" y1="710" x2="415" y2="710" stroke="#991b1b" stroke-width="1.5"/>

  <!-- Red Hexagon Center Hub with target rings -->
  <polygon points="250,678 282,694 282,726 250,742 218,726 218,694" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
  <circle cx="250" cy="710" r="14" fill="none" stroke="#f87171" stroke-width="1.5"/>
  <circle cx="250" cy="710" r="6" fill="none" stroke="#fca5a5" stroke-width="1.5"/>
  <circle cx="250" cy="710" r="2" fill="#fee2e2"/>

  <!-- Red Loading Bay / Corral with yellow power cells (Bottom Left) -->
  <rect x="115" y="930" width="60" height="42" fill="#090c15" stroke="#dc2626" stroke-width="3"/>
  <g fill="#ca8a04" stroke="#a16207" stroke-width="0.8">
    <circle cx="123" cy="937" r="3.2"/><circle cx="133" cy="937" r="3.2"/><circle cx="143" cy="937" r="3.2"/><circle cx="153" cy="937" r="3.2"/><circle cx="163" cy="937" r="3.2"/>
    <circle cx="123" cy="945" r="3.2"/><circle cx="133" cy="945" r="3.2"/><circle cx="143" cy="945" r="3.2"/><circle cx="153" cy="945" r="3.2"/><circle cx="163" cy="945" r="3.2"/>
    <circle cx="123" cy="953" r="3.2"/><circle cx="133" cy="953" r="3.2"/><circle cx="143" cy="953" r="3.2"/><circle cx="153" cy="953" r="3.2"/><circle cx="163" cy="953" r="3.2"/>
    <circle cx="123" cy="961" r="3.2"/><circle cx="133" cy="961" r="3.2"/><circle cx="143" cy="961" r="3.2"/><circle cx="153" cy="961" r="3.2"/><circle cx="163" cy="961" r="3.2"/>
  </g>

  <!-- Bottom alliance goal/station black rect & red bar -->
  <rect x="195" y="915" width="110" height="55" fill="#000000"/>
  <line x1="190" y1="910" x2="310" y2="910" stroke="#dc2626" stroke-width="4"/>
  <line x1="190" y1="906" x2="190" y2="914" stroke="#dc2626" stroke-width="3"/>
  <line x1="310" y1="906" x2="310" y2="914" stroke="#dc2626" stroke-width="3"/>

  <!-- Bottom Right alliance wall balls -->
  <g fill="#ca8a04" stroke="#a16207" stroke-width="0.8">
    <circle cx="438" cy="975" r="3.2"/><circle cx="446" cy="975" r="3.2"/><circle cx="454" cy="975" r="3.2"/><circle cx="462" cy="975" r="3.2"/><circle cx="470" cy="975" r="3.2"/>
  </g>
</svg>'''

with open("public/rebuilt-field.svg", "w") as f:
    f.write(svg_field)

print("Assets generated successfully!")
