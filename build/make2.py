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

V="/Users/justinespadapro/Downloads/ElevenLabs_Untitled_project.mp3"
total=38.54
C=lambda k:{"16":"1/copy_96D12E25-D001-4153-B449-F4240E966919.mov"}[k]
segdef=[ # (file,start,end_boundary)
("2/WhiteSwan.mov",1.0,5.36),
("1/copy_84F2A194-88D0-489C-BCC1-CACA7218675A.mov",3.0,9.52) if False else ("1/copy_96D12E25-D001-4153-B449-F4240E966919.mov",3.0,9.52),
("1/copy_26C09330-B480-4F09-8840-7A8961F92CD8.mov",0.5,11.5),
("1/c7ef3402c6d345d7af54aa5d556a0f93.mov",1.0,13.0),
("1/copy_649D532A-8E40-4BDF-8E21-9C799F18472D.mov",12.0,17.12),
("1/copy_84F2A194-88D0-489C-BCC1-CACA7218675A.mov",3.0,18.0),
("1/copy_96D12E25-D001-4153-B449-F4240E966919.mov",12.0,19.36),
("1/copy_7EB971F8-D9AF-4667-8D65-81EBC2822281.mov",2.0,21.75),
("1/copy_D5FEF9C3-5C0D-4872-A72A-42A7734E9924.mov",3.0,24.39),
("1/copy_28539122-3FB8-48E9-8444-13AD92651CE1.mov",2.0,26.88),
("2/copy_5CA0B4DE-4D15-483E-B0DA-4EF2962C2382.mov",2.0,27.68),
("1/copy_066ABD87-9028-4D83-81E1-7F6C1B3C0C9B.mov",4.0,28.48),
("1/copy_6CCD5DC9-B81B-47BE-9AF7-C56B446E9AFC.mov",3.0,29.28),
("2/Beyreuth SwanLake.mov",2.0,30.15),
("1/copy_CD4400CA-BDE6-43DC-B664-E01DC439734C.mov",3.0,31.0),
("2/copy_6FA5D44B-905B-4327-A69C-609ED3C6C099.mov",3.0,31.85),
("2/621D13C3-4466-433D-9764-9A5B6401A9A5.mov",6.0,32.85),
("1/copy_0566E0C8-06E2-4680-A368-C4C06A80C7C0.mov",3.0,33.78),
("2/copy_6F0B31AA-57EC-44FC-A928-40631F2B81BC.mov",1.0,34.8),
("2/WhiteSwan.mov",8.0,total)]
segs=[];prev=0;S=[]
for f,s0,e in segdef: segs.append((f,s0,e-prev)); S.append(prev); prev=e
S.append(total)
def add(name,a,b,*args,**kw): texts.append((tcard(name,*args,**kw),a,b))
texts=[]
add("t4a",17.12,18.0,["SWAN LAKE"],[110],y=1330)
add("t4b",18.0,19.36,["THE NUTCRACKER"],[100],y=1330)
add("t4c",19.36,21.75,["+ CHRISTMAS","SPECIAL"],[80,80],y=1280)
add("s1",21.75,23.37,["150 SHOWS"],[120],y=1250)
add("s2",23.37,26.88,["50 CITIES"],[120],y=1250)
add("s3",24.39,26.88,["NOV 14 – FEB 17"],[60],y=1420)
cb=[26.88,27.68,28.48,29.28,30.15,31.0,31.85,32.85,33.78]
for i,c in enumerate(["BERLIN","MÜNCHEN","HAMBURG","KÖLN","FRANKFURT","STUTTGART","NÜRNBERG","DÜSSELDORF"]):
    add(f"c{i}",cb[i],cb[i+1],[c],[130],y=1330)
add("t6",33.78,34.8,["AND MANY","MORE"],[110,110],y=1280)
add("t7",34.9,total,["GRAND CLASSIC BALLET","TICKETS: LINK IN BIO"],[60,80],y=1240)
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
cmd+=["-filter_complex",";".join(fc),"-map",f"[{cur}]","-map","[aud]","-c:v","libx264","-preset","medium","-crf","19","-c:a","aac","-b:a","192k","-t",str(total),"-movflags","+faststart",B+"/../grand_classic_ballet_ad_vo.mp4"]
subprocess.run(cmd,check=True)
