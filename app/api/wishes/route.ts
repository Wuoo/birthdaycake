import { env } from "cloudflare:workers";

function db(){if(!env.DB)throw new Error("Wish database unavailable");return env.DB;}
export async function GET(){
 try{
  const result=await db().prepare("SELECT id,name,message,kind,created_at FROM wishes ORDER BY created_at DESC LIMIT 100").all();
  return Response.json({wishes:result.results},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("Read wishes",e);return Response.json({error:"暂时无法打开留言。"},{status:503});}
}
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"请求来源无效"},{status:403});
 const length=Number(request.headers.get("content-length")||0);
 if(length>8000)return Response.json({error:"留言过长"},{status:413});
 let body;
 try{const text=await request.text();if(text.length>8000)return Response.json({error:"留言过长"},{status:413});body=JSON.parse(text);}
 catch{return Response.json({error:"留言格式无效"},{status:400});}
 const {id,name,message,kind}=body??{};
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)||typeof name!=="string"||name.trim().length<1||name.length>40||typeof message!=="string"||!message.trim()||message.length>500||!["wish","greeting"].includes(kind))
  return Response.json({error:"请输入 1–500 字的留言和有效署名。"},{status:400});
 try{
  const wish={id,name:name.trim(),message:message.trim(),kind,created_at:Date.now()};
  await db().prepare("INSERT INTO wishes (id,name,message,kind,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(wish.id,wish.name,wish.message,wish.kind,wish.created_at).run();
  const saved=await db().prepare("SELECT id,name,message,kind,created_at FROM wishes WHERE id=?").bind(id).first();
  return Response.json({wish:saved},{status:201});
 }catch(e){console.error("Save wish",e);return Response.json({error:"没有保存成功，文字已保留，请稍后再试。"},{status:503});}
}
