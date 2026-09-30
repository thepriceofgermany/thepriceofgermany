V="/Users/justinespadapro/Downloads/ElevenLabs_Untitled_project.mp3"
import subprocess, os
from PIL import Image, ImageDraw, ImageFont
B=os.path.dirname(os.path.abspath(__file__)); R="/Users/justinespadapro/Downloads/Grand Classic Ballet/"
FONT="/System/Library/Fonts/Supplemental/Didot.ttc"
def font(s,bold=False): return ImageFont.truetype(FONT,s,index=2 if bold else 0)
def tcard(name,lines,sizes,y=1280,sub=None):
    im=Image.new("RGBA",(1080,1920),(0,0,0,0)); sh=Image.new("RGBA",(1080,1920),(0,0,0,0))
    for layer,fill,off in ((sh,(0,0,0,255),5),(im,(255,255,255,255),0)):
        d=ImageDraw.Draw(layer); yy=y
        for t,s in zip(lines,sizes):
            f=font(s,True); w=d.textlength(t,font=f); d.text(((1080-w)/2+off,yy+off),t,font=f,fill=fill); yy+=int(s*1.15)
        if sub:
            f=font(58); w=d.textlength(sub,font=f); d.text(((1080-w)/2+off,yy+20+off),sub,font=f,fill=(240,215,160,255) if off==0 else fill)
    from PIL import ImageFilter
    sh=sh.filter(ImageFilter.GaussianBlur(10)); out=Image.alpha_composite(sh,im); p=f"{B}/{name}.png"; out.save(p); return p
# scrim
sc=Image.new("RGBA",(1080,1920),(0,0,0,0)); d=ImageDraw.Draw(sc)
for y in range(800,1920): d.line([(0,y),(1080,y)],fill=(0,0,0,int(215*((y-800)/1120)**1.1)))
sc.save(f"{B}/scrim.png")

total=36.45
segdef=[
("2/WhiteSwan.mov",1.0,3.04),
("1/copy_96D12E25-D001-4153-B449-F4240E966919.mov",3.0,7.64),
("1/copy_26C09330-B480-4F09-8840-7A8961F92CD8.mov",0.5,9.4),
("1/c7ef3402c6d345d7af54aa5d556a0f93.mov",1.0,11.03),
("1/copy_649D532A-8E40-4BDF-8E21-9C799F18472D.mov",12.0,14.26),
("1/copy_84F2A194-88D0-489C-BCC1-CACA7218675A.mov",3.0,15.11),
("1/copy_96D12E25-D001-4153-B449-F4240E966919.mov",12.0,16.26),
("1/copy_7EB971F8-D9AF-4667-8D65-81EBC2822281.mov",2.0,18.34),
("1/copy_D5FEF9C3-5C0D-4872-A72A-42A7734E9924.mov",3.0,21.88),
("1/copy_28539122-3FB8-48E9-8444-13AD92651CE1.mov",2.0,24.15),
("2/copy_5CA0B4DE-4D15-483E-B0DA-4EF2962C2382.mov",2.0,24.88),
("1/copy_066ABD87-9028-4D83-81E1-7F6C1B3C0C9B.mov",4.0,25.70),
("1/copy_6CCD5DC9-B81B-47BE-9AF7-C56B446E9AFC.mov",3.0,26.50),
("2/Beyreuth SwanLake.mov",2.0,27.27),
("1/copy_CD4400CA-BDE6-43DC-B664-E01DC439734C.mov",3.0,27.95),
("2/copy_6FA5D44B-905B-4327-A69C-609ED3C6C099.mov",3.0,29.10),
("2/621D13C3-4466-433D-9764-9A5B6401A9A5.mov",6.0,30.07),
("1/copy_0566E0C8-06E2-4680-A368-C4C06A80C7C0.mov",3.0,31.05),
("2/copy_6F0B31AA-57EC-44FC-A928-40631F2B81BC.mov",1.0,32.43),
("2/WhiteSwan.mov",8.0,total)]
segs=[];prev=0
for f,s0,e in segdef: segs.append((f,s0,e-prev)); prev=e

LOGOS={"SS":"/private/tmp/claude-502/-Users-justinespadapro-Library-Application-Support-Claude-scratch-workspaces-29f457f3-c2b0-4b08-ae48-b57cd645eba5-5b3572a8-309d-46ae-b3eb-085ad8810a8d-scratch-2026-09-30-634484/363542f1-a55d-413a-b039-e624dbc3df05/images/1.webp","NUSS":"/private/tmp/claude-502/-Users-justinespadapro-Library-Application-Support-Claude-scratch-workspaces-29f457f3-c2b0-4b08-ae48-b57cd645eba5-5b3572a8-309d-46ae-b3eb-085ad8810a8d-scratch-2026-09-30-634484/363542f1-a55d-413a-b039-e624dbc3df05/images/2.png"}
def add_logo(name,key,a,b):
    from PIL import ImageFilter
    lg=Image.open(LOGOS[key]).convert("RGBA"); lg=lg.crop(lg.getchannel("A").getbbox())
    w=820 if key=="SS" else 720; lg=lg.resize((w,int(lg.height*w/lg.width)),Image.LANCZOS)
    im=Image.new("RGBA",(1080,1920),(0,0,0,0)); x=(1080-w)//2; y=1130-lg.height//2
    sh=Image.new("RGBA",(1080,1920),(0,0,0,0)); m=Image.new("RGBA",lg.size,(0,0,0,235)); m.putalpha(lg.getchannel("A").point(lambda v:int(v*0.9)))
    sh.paste(m,(x+3,y+4),m); sh=sh.filter(ImageFilter.GaussianBlur(9))
    im=Image.alpha_composite(sh,im); im.alpha_composite(lg,(x,y)); p=f"{B}/{name}.png"; im.save(p); texts.append((p,a,b))
import json
def add_caps():
    W=[(t["offsets"]["from"]/1000,t["offsets"]["to"]/1000,t["text"].strip()) for t in json.load(open(B+"/vo.json"))["transcription"] if t["text"].strip()]
    ph=[];cur=[]
    for w in W:
        cur.append(w)
        if len(cur)>=4 or w[2][-1] in ".,":
            ph.append(cur);cur=[]
    if cur: ph.append(cur)
    for i,p in enumerate(ph):
        a=max(0,p[0][0]-0.05); b=ph[i+1][0][0]-0.02 if i+1<len(ph) else total
        b=min(b,p[-1][1]+0.5)
        if 24.1<=a<32.4: continue
        txt=" ".join(w[2] for w in p)
        txt=txt.replace("Berlin","Berlin")
        add(f"cap{i}",a,max(b,a+0.3),[txt],[66],y=1500)
texts=[]
def add(name,a,b,*args,**kw): texts.append((tcard(name,*args,**kw),a,b))
add_logo("t4a","SS",14.26,15.11)
add_logo("t4b","NUSS",15.11,16.26)
add_logo("t4n","NUSS",3.95,5.7)
add("t4c",16.26,18.34,["+ CHRISTMAS","SPECIAL"],[80,80],y=1130)
add("s1",18.34,20.70,["150 SHOWS"],[120],y=1100)
add("s2",20.70,24.15,["50 CITIES"],[120],y=1100)
add("s3",21.88,24.15,["NOV 14 – FEB 17"],[60],y=1270)
cb=[24.15,24.88,25.70,26.50,27.27,27.95,29.10,30.07,31.05]
for i,c in enumerate(["BERLIN","MÜNCHEN","HAMBURG","KÖLN","FRANKFURT","STUTTGART","NÜRNBERG","DÜSSELDORF"]):
    add(f"c{i}",cb[i],cb[i+1],[c],[130],y=1180)
add("t6",31.05,32.43,["AND MANY","MORE"],[110,110],y=1130)
add("t7",32.5,total,["GRAND CLASSIC BALLET","TICKETS: LINK IN BIO"],[60,80],y=1090)
add_caps()
cmd=["ffmpeg","-y","-v","error"]
for f,s,d in segs: cmd+=["-ss",str(s),"-t",str(d),"-i",R+f]
n=len(segs); cmd+=["-loop","1","-t",str(total),"-i",f"{B}/scrim.png"]
for p,a,b in texts: cmd+=["-loop","1","-t",str(b-a),"-i",p]
cmd+=["-ss","0","-i",R+"3/NK/1-1 NK 30s a.mp4","-i",V]
fc=[]
for i in range(n): fc.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
fc.append("".join(f"[v{i}]" for i in range(n))+f"concat=n={n}:v=1:a=0[base]")
fc.append(f"[{n}:v]format=rgba[sc]"); fc.append("[base][sc]overlay=shortest=1[b0]")
cur="b0"
for j,(p,a,b) in enumerate(texts):
    idx=n+1+j; dd=b-a
    fc.append(f"[{idx}:v]format=rgba,fade=in:st=0:d=0.15:alpha=1,fade=out:st={dd-0.15:.2f}:d=0.15:alpha=1,setpts=PTS+{a}/TB[x{j}]")
    fc.append(f"[{cur}][x{j}]overlay=eof_action=pass[o{j}]"); cur=f"o{j}"
ai=n+1+len(texts)
fc.append(f"[{ai}:a]asplit[m1][m2];[m2]atrim=start=9,asetpts=PTS-STARTPTS[m2b];[m1][m2b]acrossfade=d=2,atrim=0:{total},afade=t=in:d=1,afade=t=out:st={total-2}:d=2,volume=0.16[mus]")
fc.append(f"[{ai+1}:a]aresample=48000,apad,atrim=0:{total}[vo]")
fc.append("[vo][mus]amix=inputs=2:normalize=0:duration=first[aud]")
cmd+=["-filter_complex",";".join(fc),"-map",f"[{cur}]","-map","[aud]","-c:v","libx264","-preset","medium","-crf","19","-c:a","aac","-b:a","192k","-t",str(total),"-movflags","+faststart",B+"/../grand_classic_ballet_ad_v4.mp4"]
subprocess.run(cmd,check=True)
