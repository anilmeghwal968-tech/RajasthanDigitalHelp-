const express=require("express");
const path=require("path");
const fs=require("fs");
const Parser=require("rss-parser");
const app=express(), PORT=process.env.PORT||3000;
const parser=new Parser();
const DB=path.join(__dirname,"data","jobs.json");
const ADMIN_USER=process.env.ADMIN_USER||"admin";
const ADMIN_PASS=process.env.ADMIN_PASS||"change-this-password";
app.use(express.json()); app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

function readJobs(){try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch(e){return []}}
function saveJobs(x){fs.writeFileSync(DB,JSON.stringify(x,null,2))}
function auth(req,res,next){let h=req.headers.authorization||""; if(h.startsWith("Basic ")){let s=Buffer.from(h.slice(6),"base64").toString();let [u,p]=s.split(":");if(u===ADMIN_USER&&p===ADMIN_PASS)return next()}res.set("WWW-Authenticate",'Basic realm="Rajasthan Digital Help Admin"');res.status(401).send("Admin login required");}

app.get("/api/jobs",(req,res)=>res.json(readJobs()));
app.post("/api/jobs",auth,(req,res)=>{let jobs=readJobs();let j={id:Date.now().toString(),...req.body,sourceType:"manual",updatedAt:new Date().toISOString()};jobs.unshift(j);saveJobs(jobs);res.json(j)});
app.delete("/api/jobs/:id",auth,(req,res)=>{saveJobs(readJobs().filter(x=>x.id!==req.params.id));res.json({ok:true})});

/* Add verified RSS feeds here. Only use feeds you are permitted to access. */
const FEEDS=(process.env.RSS_FEEDS||"").split(",").map(x=>x.trim()).filter(Boolean);
app.post("/api/fetch",auth,async(req,res)=>{
  let jobs=readJobs(), added=0, errors=[];
  for(const url of FEEDS){try{
    const feed=await parser.parseURL(url);
    for(const item of (feed.items||[]).slice(0,20)){
      const link=item.link||item.guid; if(!link)continue;
      if(jobs.some(j=>j.link===link))continue;
      jobs.unshift({id:"rss-"+Buffer.from(link).toString("base64").slice(0,20),title:item.title||"New Recruitment",category:"Auto Update",lastDate:"Check Official Notice",qualification:"See official notification",notificationLink:link,applyLink:link,link,sourceType:"rss",updatedAt:new Date().toISOString()}); added++;
    }
  }catch(e){errors.push({url,error:e.message})}}
  saveJobs(jobs); res.json({added,errors,total:jobs.length});
});

app.get("/robots.txt",(req,res)=>res.type("text").send(`User-agent: *\nAllow: /\nSitemap: https://${req.get("host")}/sitemap.xml\n`));
app.get("/sitemap.xml",(req,res)=>{let urls=["/","/jobs.html","/about.html","/contact.html","/privacy.html","/disclaimer.html",...readJobs().map(j=>"/job.html?id="+encodeURIComponent(j.id))];let body=urls.map(u=>`<url><loc>https://${req.get("host")}${u}</loc></url>`).join("");res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`)});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.listen(PORT,()=>console.log("Rajasthan Digital Help running on "+PORT));