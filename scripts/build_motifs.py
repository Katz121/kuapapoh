import os
import math
import playwright.sync_api

def generate_halftone():
    # Circle made of dot grid fading out toward edge
    # Viewbox 0 0 200 200, center (100, 100)
    R = 92.0
    step = 9.2
    dots = []
    y = 8.0
    while y <= 192.0:
        x = 8.0
        while x <= 192.0:
            d = math.hypot(x - 100.0, y - 100.0)
            if d <= R:
                norm = d / R
                # Fade out radius towards edge
                r = 4.6 * (1.0 - norm**1.6)**0.7
                if r >= 0.5:
                    dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="currentColor"/>')
            x += step
        y += step
    return "\n    ".join(dots)

def generate_starburst():
    # Spiky sunburst blob, 14 sharp points
    cx, cy = 100.0, 100.0
    num_points = 14
    n_vertices = num_points * 2
    r_outer = 96.0
    r_inner = 48.0
    pts = []
    for i in range(n_vertices):
        angle = i * (2.0 * math.pi / n_vertices) - (math.pi / 2.0)
        r = r_outer if i % 2 == 0 else r_inner
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        pts.append(f"{px:.1f},{py:.1f}")
    path_d = "M " + " L ".join(pts) + " Z"
    return f'<path d="{path_d}" fill="currentColor"/>'

def generate_diamond():
    # Thick outlined rhombus, stroke only
    return '<polygon points="100,16 184,100 100,184 16,100" fill="none" stroke="currentColor" stroke-width="28" stroke-linejoin="miter"/>'

def generate_arch():
    # POH GALLERY double arch legs shape
    # Outer arch: center (100, 70), R=68 -> x 32 to 168, y down to 180
    # Inner main arch cutout: center (100, 70), R=32 -> x 68 to 132, y down to 180
    # Left leg: x 32 to 68 (width 36). Small arch cutout: x 41 to 59 (width 18), R=9, top at y=152 down to y=180
    # Base bar: x 14 to 186, y 180 to 195
    d = (
        "M 32,180 L 32,70 A 68,68 0 0,1 168,70 L 168,180 H 132 L 132,70 A 32,32 0 0,0 68,70 L 68,180 Z "
        "M 41,180 L 41,152 A 9,9 0 0,1 59,152 L 59,180 Z "
        "M 14,180 H 186 V 195 H 14 Z"
    )
    return f'<path d="{d}" fill="currentColor" fill-rule="evenodd"/>'

def generate_wave():
    # Three stacked wavy lines
    paths = []
    y_centers = [38, 80, 122]
    for y in y_centers:
        d = (
            f"M 15,{y} "
            f"C 35,{y-24} 55,{y-24} 75,{y} "
            f"C 95,{y+24} 115,{y+24} 135,{y} "
            f"C 155,{y-24} 175,{y-24} 195,{y} "
            f"C 210,{y+20} 220,{y+20} 225,{y}"
        )
        paths.append(f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>')
    return "\n    ".join(paths)

def generate_windows():
    # Three arched windows with a grid of panes
    # viewBox 0 0 240 180
    # 3 windows: 1 central vertical line per window (2 columns), 3 horizontal lines (4 rows of panes)
    windows_svg = []
    x_starts = [16, 90, 164]
    w = 60
    r = 30
    y_top = 20
    y_arch_base = y_top + r  # 50
    y_bottom = 160
    
    for x1 in x_starts:
        x2 = x1 + w
        xc = x1 + r
        # Outer arch
        d_outer = f"M {x1},{y_bottom} L {x1},{y_arch_base} A {r},{r} 0 0,1 {x2},{y_arch_base} L {x2},{y_bottom} Z"
        windows_svg.append(f'<path d="{d_outer}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
        
        # Grid line: 1 central vertical line dividing into 2 columns
        windows_svg.append(f'<line x1="{xc}" y1="{y_top+6}" x2="{xc}" y2="{y_bottom}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>')
        
        # Grid lines: 3 horizontal lines
        for yh in [55, 90, 125]:
            windows_svg.append(f'<line x1="{x1}" y1="{yh}" x2="{x2}" y2="{yh}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>')
            
    return "\n    ".join(windows_svg)

def generate_cube():
    # Isometric block cluster
    # viewBox 0 0 220 220
    # Isometric axes: dx=24, dy=14, dz=30
    dx, dy, dz = 24, 14, 30
    
    cube_centers = [
        (110, 25),   # Top
        (62, 55),    # Middle Left
        (158, 55),   # Middle Right
        (110, 85),   # Center
        (62, 115),   # Bottom Left
        (158, 115),  # Bottom Right
        (110, 145),  # Bottom Center
    ]
    
    elems = []
    for cx, cy in cube_centers:
        # Top face: solid fill in currentColor
        top_pts = f"{cx},{cy} {cx+dx},{cy+dy} {cx},{cy+2*dy} {cx-dx},{cy+dy}"
        elems.append(f'<polygon points="{top_pts}" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>')
        
        # Left face: bold outline in currentColor
        left_pts = f"{cx-dx},{cy+dy} {cx},{cy+2*dy} {cx},{cy+2*dy+dz} {cx-dx},{cy+dy+dz}"
        elems.append(f'<polygon points="{left_pts}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>')
        
        # Right face: outline + diagonal hatching lines in currentColor
        right_pts = f"{cx+dx},{cy+dy} {cx},{cy+2*dy} {cx},{cy+2*dy+dz} {cx+dx},{cy+dy+dz}"
        elems.append(f'<polygon points="{right_pts}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>')
        
        # Inner diagonal hatching lines on right face
        for step in [0.28, 0.52, 0.76]:
            lx1 = cx + (1-step)*0 + step*dx
            ly1 = cy + 2*dy + step*dz
            lx2 = cx + dx
            ly2 = cy + dy + step*dz
            elems.append(f'<line x1="{lx1:.1f}" y1="{ly1:.1f}" x2="{lx2:.1f}" y2="{ly2:.1f}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>')

    return "\n    ".join(elems)

def generate_rays():
    # Fan of short straight radiating lines
    # viewBox 0 0 200 200, center (100, 100)
    cx, cy = 100.0, 100.0
    r_in = 54.0
    r_out = 88.0
    num_rays = 17
    start_angle = -140.0 * math.pi / 180.0
    end_angle = 140.0 * math.pi / 180.0
    
    lines = []
    for i in range(num_rays):
        a = start_angle + i * (end_angle - start_angle) / (num_rays - 1)
        x1 = cx + r_in * math.cos(a)
        y1 = cy + r_in * math.sin(a)
        x2 = cx + r_out * math.cos(a)
        y2 = cy + r_out * math.sin(a)
        lines.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>')
    return "\n    ".join(lines)

def generate_squiggle():
    # Thin beaded snake line
    # viewBox 0 0 100 240
    # High frequency tight serpentine snake line
    y_start = 12.0
    y_end = 228.0
    num_loops = 18
    step_y = (y_end - y_start) / num_loops
    amp = 22.0
    
    path_segments = [f"M 50,{y_start:.1f}"]
    for i in range(num_loops):
        y0 = y_start + i * step_y
        y1 = y0 + step_y
        cp_y1 = y0 + step_y * 0.25
        cp_y2 = y1 - step_y * 0.25
        if i % 2 == 0:
            x_target = 50.0 + amp
            path_segments.append(f"C {50+amp*1.4:.1f},{cp_y1:.1f} {50+amp*1.4:.1f},{cp_y2:.1f} 50,{y1:.1f}")
        else:
            path_segments.append(f"C {50-amp*1.4:.1f},{cp_y1:.1f} {50-amp*1.4:.1f},{cp_y2:.1f} 50,{y1:.1f}")
            
    d = " ".join(path_segments)
    return f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'

def main():
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
  <symbol id="m-halftone" viewBox="0 0 200 200">
    {generate_halftone()}
  </symbol>
  <symbol id="m-starburst" viewBox="0 0 200 200">
    {generate_starburst()}
  </symbol>
  <symbol id="m-diamond" viewBox="0 0 200 200">
    {generate_diamond()}
  </symbol>
  <symbol id="m-arch" viewBox="0 0 200 200">
    {generate_arch()}
  </symbol>
  <symbol id="m-wave" viewBox="0 0 240 160">
    {generate_wave()}
  </symbol>
  <symbol id="m-windows" viewBox="0 0 240 180">
    {generate_windows()}
  </symbol>
  <symbol id="m-cube" viewBox="0 0 220 220">
    {generate_cube()}
  </symbol>
  <symbol id="m-rays" viewBox="0 0 200 200">
    {generate_rays()}
  </symbol>
  <symbol id="m-squiggle" viewBox="0 0 100 240">
    {generate_squiggle()}
  </symbol>
</svg>
"""
    
    out_svg_path = r"D:\Takuapa\images\ws\motifs.svg"
    os.makedirs(os.path.dirname(out_svg_path), exist_ok=True)
    with open(out_svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Wrote {out_svg_path}")

    # Now render preview HTML to PNG using Playwright
    symbols = [
        "m-halftone", "m-starburst", "m-diamond", "m-arch",
        "m-wave", "m-windows", "m-cube", "m-rays", "m-squiggle"
    ]
    
    uses_html = ""
    for s_id in symbols:
        uses_html += f"""
        <div class="card">
          <div class="label">{s_id}</div>
          <svg viewBox="0 0 240 240">
            <use href="#{s_id}" />
          </svg>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{
    background-color: #f7d736; /* Poster yellow */
    margin: 0;
    padding: 24px 16px;
    font-family: system-ui, sans-serif;
    color: #1a1a1a;
  }}
  h1 {{
    text-align: center;
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 22px;
    letter-spacing: 2px;
    font-weight: 800;
  }}
  .row {{
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    max-width: 1750px;
    margin: 0 auto;
  }}
  .card {{
    background: #ffffff;
    border-radius: 12px;
    padding: 12px 8px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1 1 0px;
    min-width: 0;
  }}
  .label {{
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 8px;
    color: #222;
    white-space: nowrap;
  }}
  svg {{
    width: 100%;
    max-width: 140px;
    height: 140px;
    color: #e91e63; /* Memphis / Riso pink color */
  }}
</style>
</head>
<body>
  {svg_content}
  <h1>KUAPAPOH MOTIF VOCABULARY</h1>
  <div class="row">
    {uses_html}
  </div>
</body>
</html>
"""
    
    preview_html_path = r"D:\Takuapa\images\ws\_check\preview.html"
    with open(preview_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    png_path = r"D:\Takuapa\images\ws\_check\motifs.png"
    
    with playwright.sync_api.sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1820, "height": 280})
        page.goto(f"file:///{preview_html_path.replace('\\', '/')}")
        page.screenshot(path=png_path, full_page=True)
        browser.close()
    print(f"Rendered PNG to {png_path}")

if __name__ == "__main__":
    main()
