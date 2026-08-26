# -*- coding: utf-8 -*-
"""DevKit 桌面图标生成脚本：3 个候选概念，输出多尺寸 PNG + Windows ICO + 预览页"""
import base64
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 2048                     # 超采样画布（最终缩小，保证边缘平滑）
FONT_BOLD = "C:/Windows/Fonts/consolab.ttf"   # Consolas Bold
OUT = os.path.dirname(os.path.abspath(__file__))


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def squircle_bg(c1, c2, radius_ratio=0.225):
    """圆角方形（squircle）+ 135 度对角渐变背景"""
    yy, xx = np.mgrid[0:S, 0:S]
    t = ((xx + yy) / (2 * S))[..., None]
    a, b = np.array(hex2rgb(c1)), np.array(hex2rgb(c2))
    rgb = (a + (b - a) * t).astype("uint8")
    img = Image.fromarray(rgb, "RGB").convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=int(S * radius_ratio), fill=255)
    img.putalpha(mask)
    return img


def glyph(text, font, color=(255, 255, 255)):
    """渲染单个字形并裁剪到实际边界"""
    tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((S // 2, S // 2), text, font=font,
                             fill=color + (255,), anchor="mm")
    return tmp.crop(tmp.getbbox())


def concept_a():
    """方案 A · 命令行提示符 >_ ：呼应命令面板 / Alt+Space 全局唤起"""
    bg = squircle_bg("#6366F1", "#22D3EE")          # 靛蓝 → 青色
    f = ImageFont.truetype(FONT_BOLD, 1250)
    g = glyph(">", f)
    bw, bh, gap = 190, int(g.height * 0.42), 120
    x0 = (S - (g.width + gap + bw)) // 2
    y0 = (S - g.height) // 2
    bg.alpha_composite(g, (x0, y0))
    bx, by = x0 + g.width + gap, y0 + g.height - bh  # 光标块与 > 基线对齐
    ImageDraw.Draw(bg).rounded_rectangle(
        [bx, by, bx + bw, by + bh], radius=44, fill=(255, 255, 255, 255))
    return bg


def concept_b():
    """方案 B · 花括号 { } ：代码 / 开发者身份标识"""
    bg = squircle_bg("#8B5CF6", "#EC4899")          # 紫罗兰 → 品红
    f = ImageFont.truetype(FONT_BOLD, 1300)
    l, r = glyph("{", f), glyph("}", f)
    gap = 300
    x0 = (S - (l.width + gap + r.width)) // 2
    bg.alpha_composite(l, (x0, (S - l.height) // 2))
    bg.alpha_composite(r, (x0 + l.width + gap, (S - r.height) // 2))
    return bg


def concept_c():
    """方案 C · 工具格 2x2 ：直观表达“工具集”定位"""
    bg = squircle_bg("#1E293B", "#0F172A")          # 深板岩色微渐变
    m, gap, tile, rad = 296, 160, 648, 160
    colors = ["#22D3EE", "#A78BFA", "#FBBF24", "#34D399"]  # 青/紫/琥珀/翠绿
    d = ImageDraw.Draw(bg)
    for i, c in enumerate(colors):
        x = m + (tile + gap) * (i % 2)
        y = m + (tile + gap) * (i // 2)
        d.rounded_rectangle([x, y, x + tile, y + tile], radius=rad, fill=hex2rgb(c))
    return bg


def export(img, name):
    """导出多尺寸 PNG + ICO"""
    folder = os.path.join(OUT, name)
    os.makedirs(folder, exist_ok=True)
    sizes = [1024, 512, 256, 128, 64, 48, 32, 16]
    for sz in sizes:
        img.resize((sz, sz), Image.LANCZOS).save(
            os.path.join(folder, f"icon-{sz}.png"))
    img.resize((256, 256), Image.LANCZOS).save(
        os.path.join(folder, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"[ok] {name}")


def b64(path):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode()


def build_preview(items):
    cards = ""
    for it in items:
        big = b64(os.path.join(OUT, it["dir"], "icon-256.png"))
        s32 = b64(os.path.join(OUT, it["dir"], "icon-32.png"))
        s16 = b64(os.path.join(OUT, it["dir"], "icon-16.png"))
        badge = ('<span class="badge">推荐</span>' if it.get("rec")
                 else '<span class="badge alt">备选</span>')
        cards += f'''
    <div class="card">
      <div class="head"><h2>{it["title"]}</h2>{badge}</div>
      <div class="stage"><img class="big" src="data:image/png;base64,{big}" alt="{it["title"]}"></div>
      <p class="desc">{it["desc"]}</p>
      <div class="sizes">
        <div class="row"><span class="lab">实际尺寸</span>
          <img src="data:image/png;base64,{s32}" width="32" height="32" alt="32px">
          <img src="data:image/png;base64,{s16}" width="16" height="16" alt="16px">
          <span class="lab" style="margin-left:6px">32 / 16 px</span>
        </div>
        <div class="row light"><span class="lab">浅色任务栏</span>
          <img src="data:image/png;base64,{s32}" width="24" height="24" alt="24px light">
        </div>
      </div>
      <div class="path">{it["dir"]}/ · icon.ico / icon-1024.png</div>
    </div>'''
    html = f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DevKit 图标设计方案</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background:#0b0f1a; color:#e5e9f2; font-family:"Segoe UI","Microsoft YaHei",sans-serif;
         padding:48px 24px; }}
  .wrap {{ max-width:1080px; margin:0 auto; }}
  h1 {{ font-size:26px; font-weight:600; letter-spacing:.5px; }}
  .sub {{ color:#8b93a7; font-size:14px; margin:10px 0 36px; line-height:1.7; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:24px; }}
  .card {{ background:#121828; border:1px solid #232c44; border-radius:16px; padding:24px; }}
  .head {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }}
  h2 {{ font-size:17px; font-weight:600; }}
  .badge {{ background:linear-gradient(90deg,#6366f1,#22d3ee); color:#fff; font-size:12px;
           padding:3px 12px; border-radius:99px; }}
  .badge.alt {{ background:#232c44; color:#8b93a7; }}
  .stage {{ display:flex; justify-content:center; padding:28px 0 24px;
           background:radial-gradient(circle at 50% 40%,#182136,#121828); border-radius:12px; }}
  .big {{ width:200px; height:200px; }}
  .desc {{ color:#aab2c5; font-size:13px; line-height:1.8; margin:18px 0; min-height:66px; }}
  .sizes {{ display:flex; flex-direction:column; gap:8px; }}
  .row {{ display:flex; align-items:center; gap:12px; background:#0d1322; border-radius:8px;
         padding:8px 12px; }}
  .row.light {{ background:#f1f3f7; }}
  .lab {{ font-size:12px; color:#8b93a7; }}
  .path {{ margin-top:14px; font-size:12px; color:#5d6activation580; color:#5d6580;
          font-family:Consolas,monospace; }}
  .foot {{ margin-top:40px; background:#121828; border:1px solid #232c44; border-radius:16px;
          padding:24px 28px; }}
  .foot h3 {{ font-size:15px; margin-bottom:12px; }}
  .foot p {{ color:#aab2c5; font-size:13px; line-height:2; }}
  .foot code {{ background:#0d1322; padding:2px 8px; border-radius:5px; color:#22d3ee;
               font-family:Consolas,monospace; font-size:12.5px; }}
</style></head><body><div class="wrap">
  <h1>DevKit 桌面图标设计方案</h1>
  <p class="sub">三个候选概念 · 均已导出 16–1024px 全尺寸 PNG 与 Windows ICO（含 24px）·
  基于「本地优先的开发者工具集」定位设计，圆角方形适配 Windows 11 / macOS 风格</p>
  <div class="grid">{cards}
  </div>
  <div class="foot">
    <h3>选定后如何应用到 Tauri 项目</h3>
    <p>方案 A：<code>npx tauri icon icons/concept-a-prompt/icon-1024.png</code><br>
    方案 B：<code>npx tauri icon icons/concept-b-braces/icon-1024.png</code><br>
    方案 C：<code>npx tauri icon icons/concept-c-grid/icon-1024.png</code><br>
    该命令会自动生成 <code>src-tauri/icons/</code> 下全平台图标（含 Store 图片与 icns）。</p>
  </div>
</div></body></html>'''
    with open(os.path.join(OUT, "preview.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    print("[ok] preview.html")


if __name__ == "__main__":
    items = [
        {"dir": "concept-a-prompt", "title": "方案 A · 命令行提示符",
         "desc": "靛蓝→青色渐变上的白色「&gt;_」终端提示符与光标块，直接呼应全局快捷键唤起的命令面板（Alt+Space），一眼即知是开发者工具。16px 下依然清晰。",
         "rec": True},
        {"dir": "concept-b-braces", "title": "方案 B · 花括号",
         "desc": "紫罗兰→品红渐变上的白色「{ }」花括号，经典代码符号，强调「为开发者而生」的身份认同，色彩在现代应用图标中辨识度高。"},
        {"dir": "concept-c-grid", "title": "方案 C · 工具格",
         "desc": "深板岩底色上的 2×2 彩色圆角块，隐喻「工具集」的模块化架构（每个工具即插即用），风格克制，与深色主题 UI 呼应。"},
    ]
    export(concept_a(), "concept-a-prompt")
    export(concept_b(), "concept-b-braces")
    export(concept_c(), "concept-c-grid")
    build_preview(items)
    print("done")
