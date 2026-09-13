"""
Where GAG2's artwork came from.

    python3 scripts/crop-gag2.py <screenshot-dir> <work-dir>

gag2.gg publishes no asset ids and GAG2 carries none in the pull, so unlike
Pet Simulator 99 — whose 3,108 rows resolve a picture straight off Roblox's
CDN — there was no URL to point a tile at. What existed instead was 54 phone
screenshots of gag2.gg's own grid: nine item cards per shot, each card a
render on a near-white ground with the item's name printed under it.

This turns those into one transparent PNG per catalogue row. It is kept in the
repository because "where did this picture come from" is a question the rest of
this codebase answers for every number it shows, and artwork should not be the
one thing that appears by magic.

How it works, and the two things that nearly went wrong:

  1. GRID. Cards are found by their gutters rather than by hardcoded pixels:
     columns where every sampled pixel equals the page background, then the
     card's own left edge scanned down for row boundaries. Nothing here assumes
     a scroll position, so a shot taken mid-scroll works like any other.

  2. LABEL. Each card is OCR'd, and the FIRST text line is the item's name. Its
     y-coordinate is also what separates art from label — so the art crop ends
     where the text begins, adaptively, rather than at a guessed fraction of
     the card. Cards whose name wraps to two lines come out word-reordered
     ("Door Oak Owner"), which the matcher handles by comparing word sets.

  3. BACKGROUND. Alpha comes from a flood fill inward from the crop border, so
     only background actually connected to the edge is removed. A global
     colour key would have punched holes through the White Fence and the
     cobblestone set, which are near-background grey by design.

  4. AGREEMENT — the check that earned its place. Screenshots overlap, so most
     items appear two or three times. An early version kept whichever instance
     had the most opaque pixels, and filed a swan under "Big Sign": one card of
     Big Swan had OCR'd as "Big Sign", and the swan won on area. Now every
     instance is kept, clipped ones are rejected in favour of whole ones, the
     rest are ranked by OCR confidence, and instances that disagree on the
     picture are written out as CONFLICT-* for a human to look at rather than
     silently resolved.

The 97 Big/Mega/Rainbow pet crops this produces are deliberately NOT installed.
Those are variants, and items.ts models them as a variant axis on the base pet
rather than as rows, so there is no id for them to be filed under. Installing
them would mean inventing rows the game does not have.
"""
from PIL import Image
import subprocess, sys, os, json, glob, collections

if len(sys.argv) < 3:
    sys.exit(__doc__.strip().split("\n")[2].strip())
SRC, OUT = sys.argv[1], sys.argv[2]
TMP = os.path.join(OUT, "_tmp"); os.makedirs(TMP, exist_ok=True)

def page_bg(im):
    W,H=im.size
    px=[im.getpixel((4,y)) for y in range(300,H-200,7)]
    px.sort(key=lambda p:sum(p)); return px[len(px)//2]

def near(p,q,tol):
    return abs(p[0]-q[0])<=tol and abs(p[1]-q[1])<=tol and abs(p[2]-q[2])<=tol

def runs(frac,thr,minlen):
    out=[];s=None
    for i,v in enumerate(frac):
        if v>=thr and s is None: s=i
        elif v<thr and s is not None:
            if i-s>=minlen: out.append((s,i))
            s=None
    if s is not None and len(frac)-s>=minlen: out.append((s,len(frac)))
    return out

def columns(im,y0,y1,bg):
    W,H=im.size;f=[]
    for x in range(W):
        t=h=0
        for y in range(y0,y1,4):
            t+=1
            if near(im.getpixel((x,y)),bg,6):h+=1
        f.append(h/t)
    gr=runs(f,0.97,4)
    return [(a[1],b[0]) for a,b in zip(gr,gr[1:]) if 150 < b[0]-a[1] < 400]

def rows_for(im,x,bg,y0,y1):
    """Scan the card's left inner edge: card body is brighter than page bg."""
    thr=sum(bg)/3+3; out=[];start=None
    for y in range(y0,y1):
        p=im.getpixel((x,y)); is_card = sum(p)/3 > thr
        if is_card and start is None: start=y
        elif not is_card and start is not None:
            if y-start>=240: out.append((start,y))
            start=None
    if start is not None and y1-start>=240: out.append((start,y1))
    return out

def ocr_lines(img):
    p=os.path.join(TMP,"ocr.png")
    img.resize((img.width*3,img.height*3),Image.LANCZOS).save(p)
    r=subprocess.run(["tesseract",p,"stdout","--psm","6","tsv"],
                     capture_output=True,text=True)
    words=[]
    for ln in r.stdout.split("\n")[1:]:
        f=ln.split("\t")
        if len(f)<12: continue
        try: conf=float(f[10])
        except: continue
        txt=f[11].strip()
        if not txt or conf<40: continue
        words.append((int(f[6]),int(f[7]),int(f[8]),int(f[9]),txt,conf))
    words.sort(key=lambda w:(w[1],w[0]))
    lines=[]
    for w in words:
        if lines and abs(w[1]-lines[-1][0][1])<18: lines[-1].append(w)
        else: lines.append([w])
    return [(min(x[1] for x in L)//3, " ".join(x[4] for x in L),
             sum(x[5] for x in L)/len(L)) for L in lines]

def cut_alpha(art, tol=10):
    """Flood-fill the card background away from the borders."""
    w,h=art.size
    px=art.load()
    ring=[px[x,4] for x in range(4,w-4,3)]+[px[x,h-4] for x in range(4,w-4,3)]+\
         [px[4,y] for y in range(4,h-4,3)]+[px[w-5,y] for y in range(4,h-4,3)]
    ring.sort(key=lambda p:sum(p)); bg=ring[len(ring)//2]
    seen=bytearray(w*h)
    stack=[]
    for x in range(w):
        stack.append((x,0)); stack.append((x,h-1))
    for y in range(h):
        stack.append((0,y)); stack.append((w-1,y))
    while stack:
        x,y=stack.pop()
        if x<0 or y<0 or x>=w or y>=h: continue
        i=y*w+x
        if seen[i]: continue
        if not near(px[x,y],bg,tol): continue
        seen[i]=1
        stack.append((x+1,y)); stack.append((x-1,y))
        stack.append((x,y+1)); stack.append((x,y-1))
    out=Image.new("RGBA",(w,h))
    op=out.load()
    for y in range(h):
        for x in range(w):
            if seen[y*w+x]: op[x,y]=(0,0,0,0)
            else:
                r,g,b=px[x,y]; op[x,y]=(r,g,b,255)
    return out

def clipped(img):
    """True when opaque pixels touch the crop border: the art is cut off."""
    w,h=img.size; a=img.getchannel("A").load()
    top=sum(1 for x in range(w) if a[x,0]>40)
    bot=sum(1 for x in range(w) if a[x,h-1]>40)
    return max(top,bot) > w*0.06

def square(img, size=256, pad=0.06):
    bb=img.getbbox()
    if not bb: return None
    img=img.crop(bb)
    w,h=img.size
    if w<12 or h<12: return None
    s=int(max(w,h)*(1+pad*2))
    canv=Image.new("RGBA",(s,s),(0,0,0,0))
    canv.paste(img,((s-w)//2,(s-h)//2))
    return canv.resize((size,size),Image.LANCZOS)

# ---------------------------------------------------------------- main
shots=[]
for f in sorted(glob.glob(os.path.join(SRC,"*.png")))+sorted(glob.glob(os.path.join(SRC,"*.jpg"))):
    im=Image.open(f)
    if im.size!=(800,1280): continue
    g=im.convert("L").resize((80,128))
    if sum(g.getdata())/ (80*128) > 170: shots.append(f)
print(f"{len(shots)} light screenshots", flush=True)

found={}
labelcase={}
stats=collections.Counter()
for n,f in enumerate(shots,1):
    im=Image.open(f).convert("RGB")
    W,H=im.size; bg=page_bg(im)
    y0,y1=205,H-150
    cols=columns(im,y0,y1,bg)
    if len(cols)<2: stats["no-grid"]+=1; continue
    for (cx0,cx1) in cols:
        for (ry0,ry1) in rows_for(im,cx0+6,bg,y0,y1):
            card=im.crop((cx0,ry0,cx1,ry1))
            lines=ocr_lines(card)
            if not lines: stats["no-ocr"]+=1; continue
            top,name,conf=lines[0]
            if top<60: stats["text-too-high"]+=1; continue
            art=card.crop((4,4,card.width-4,max(10,top-6)))
            rgba=cut_alpha(art)
            sq=square(rgba)
            if sq is None: stats["empty-art"]+=1; continue
            key=" ".join(name.split()).lower()
            if not any(c.isalnum() for c in key): stats["junk-label"]+=1; continue
            if key not in labelcase: labelcase[key]=name
            found.setdefault(key,[]).append(
                {"img":sq,"conf":conf,"src":os.path.basename(f),
                 "clip":clipped(rgba)})
            stats["cards"]+=1
    print(f"  [{n}/{len(shots)}] {os.path.basename(f)} -> {stats['cards']} cards, {len(found)} names", flush=True)

def fingerprint(img):
    t=img.resize((16,16),Image.LANCZOS)
    return list(t.getdata())

def dist(a,b):
    return sum(abs(p[0]-q[0])+abs(p[1]-q[1])+abs(p[2]-q[2])+abs(p[3]-q[3])
               for p,q in zip(a,b))/(16*16*4)

os.makedirs(os.path.join(OUT,"raw"),exist_ok=True)
index={}; conflicts={}
for key,insts in found.items():
    name=labelcase[key]
    safe="-".join("".join(c for c in w if c.isalnum()) for w in key.split())
    safe="-".join(x for x in safe.split("-") if x)
    if not safe: continue
    insts.sort(key=lambda d:(d["clip"], -d["conf"]))
    insts=[d for d in insts if not d["clip"]] or insts
    if len(insts)>1:
        fp=[fingerprint(d["img"]) for d in insts]
        base=fp[0]
        outliers=[i for i in range(1,len(insts)) if dist(base,fp[i])>18]
        if outliers:
            conflicts[name]=[{"src":insts[i]["src"],"conf":round(insts[i]["conf"],1)}
                             for i in [0]+outliers]
            stats["conflict"]+=1
            for i,d in enumerate(insts):
                d["img"].save(os.path.join(OUT,"raw",f"CONFLICT-{safe}-{i}.png"))
    insts[0]["img"].save(os.path.join(OUT,"raw",f"{safe}.png"))
    index[name]=f"{safe}.png"
json.dump(conflicts,open(os.path.join(OUT,"conflicts.json"),"w"),indent=1)
json.dump(index,open(os.path.join(OUT,"ocr-index.json"),"w"),indent=1)
print(json.dumps(dict(stats),indent=1))
print(f"{len(index)} distinct labels written to {OUT}/raw")
