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
# (file,start,dur)
segs=[("2/WhiteSwan.mov",1.0,4.5),("1/copy_28539122-3FB8-48E9-8444-13AD92651CE1.mov",2.0,2.5),("1/copy_649D532A-8E40-4BDF-8E21-9C799F18472D.mov",12.0,3.0),
("1/copy_26C09330-B480-4F09-8840-7A8961F92CD8.mov",0.5,2.5),("1/c7ef3402c6d345d7af54aa5d556a0f93.mov",1.0,2.5),
("1/copy_84F2A194-88D0-489C-BCC1-CACA7218675A.mov",3.0,2.5),("1/copy_D5FEF9C3-5C0D-4872-A72A-42A7734E9924.mov",3.0,3.0),("1/copy_7EB971F8-D9AF-4667-8D65-81EBC2822281.mov",2.0,1.5),
("1/copy_CD4400CA-BDE6-43DC-B664-E01DC439734C.mov",3.0,2.5)]
# cities
cs=[("2/copy_5CA0B4DE-4D15-483E-B0DA-4EF2962C2382.mov",2),("1/copy_066ABD87-9028-4D83-81E1-7F6C1B3C0C9B.mov",4),("1/copy_6CCD5DC9-B81B-47BE-9AF7-C56B446E9AFC.mov",3),("2/Beyreuth SwanLake.mov",2),
("1/copy_96D12E25-D001-4153-B449-F4240E966919.mov",8),("2/copy_6FA5D44B-905B-4327-A69C-609ED3C6C099.mov",3),("2/621D13C3-4466-433D-9764-9A5B6401A9A5.mov",6),("1/copy_0566E0C8-06E2-4680-A368-C4C06A80C7C0.mov",3)]
segs+=[(f,s,1.25) for f,s in cs]
segs+=[("2/Jester.mov",4.0,0)] if False else []
segs+=[("2/353E0753-B612-403C-B719-498D644FFFD0.mov",6.0,2.5)]  # black swan? placeholder replaced below
segs[-1]=("2/copy_6F0B31AA-57EC-44FC-A928-40631F2B81BC.mov",1.0,2.5)
segs+=[("2/WhiteSwan.mov",8.0,3.5)]
total=sum(d for _,_,d in segs); print("total",total)
texts=[]; t=0; starts=[]
for f,s,d in segs: starts.append(t); t+=d
S=starts
def add(name,a,b,*args,**kw): texts.append((tcard(name,*args,**kw),a,b))
# add("t1",0.3,4.3,["BALLET IS COMING","TO GERMANY"],[92,92],y=1240)
# add("t2",S[1]+0.2,S[3]-0.3,["I grew up","loving the ballet"],[96,96],y=1240)
# add("t3",S[3]+0.2,S[5]-0.3,["This year I'm sharing","it with my daughter"],[84,84],y=1240)
add("t4a",S[5],S[6],["SWAN LAKE"],[110],y=1330)
add("t4b",S[6],S[7],["THE NUTCRACKER"],[100],y=1330)
add("t4c",S[7],S[8],["+ CHRISTMAS","SPECIAL"],[80,80],y=1280)
add("t5",S[8],S[9],["150 SHOWS","50 CITIES"],[110,110],y=1180,sub="NOV 14 – FEB 17")
for i,c in enumerate(["BERLIN","MÜNCHEN","HAMBURG","KÖLN","FRANKFURT","STUTTGART","NÜRNBERG","DÜSSELDORF"]):
    add(f"c{i}",S[9+i],S[10+i],[c],[130],y=1330)
add("t6",S[17],S[18],["AND MANY","MORE"],[110,110],y=1280)
add("t7",S[18]+0.2,total,["GRAND CLASSIC BALLET","TICKETS: LINK IN BIO"],[60,80],y=1180)
cmd=["ffmpeg","-y","-v","error"]
for f,s,d in segs: cmd+=["-ss",str(s),"-t",str(d),"-i",R+f]
n=len(segs); cmd+=["-loop","1","-t",str(total),"-i",f"{B}/scrim.png"]
for p,a,b in texts: cmd+=["-loop","1","-t",str(b-a),"-i",p]
cmd+=["-ss","0","-i",R+"3/NK/1-1 NK 30s a.mp4"]
fc=[]
for i in range(n): fc.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
fc.append("".join(f"[v{i}]" for i in range(n))+f"concat=n={n}:v=1:a=0[base]")
fc.append(f"[{n}:v]format=rgba[sc]"); fc.append("[base][sc]overlay=shortest=1[b0]")
cur="b0"
for j,(p,a,b) in enumerate(texts):
    idx=n+1+j; dd=b-a
    fc.append(f"[{idx}:v]format=rgba,fade=in:st=0:d=0.25:alpha=1,fade=out:st={dd-0.25:.2f}:d=0.25:alpha=1,setpts=PTS+{a}/TB[x{j}]")
    fc.append(f"[{cur}][x{j}]overlay=eof_action=pass[o{j}]"); cur=f"o{j}"
ai=n+1+len(texts)
fc.append(f"[{ai}:a]asplit[m1][m2];[m2]atrim=start=9,asetpts=PTS-STARTPTS[m2b];[m1][m2b]acrossfade=d=2,atrim=0:{total},afade=t=in:d=1,afade=t=out:st={total-2}:d=2,volume=0.9[aud]")
cmd+=["-filter_complex",";".join(fc),"-map",f"[{cur}]","-map","[aud]","-c:v","libx264","-preset","medium","-crf","19","-c:a","aac","-b:a","192k","-t",str(total),"-movflags","+faststart",B+"/../grand_classic_ballet_ad.mp4"]
subprocess.run(cmd,check=True)
