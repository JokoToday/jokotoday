import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
const PROJECT="szijiljpasxddzgzckra";
const TX="0a3c771f-933b-430b-8a30-4c2644f336dc";
const ATTEMPT="8d5698c6-da55-4402-b7cc-64c467b22616";
const CUSTOMER="61681834-2e5a-454a-9767-fda806f67c98";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"https://staging.joko.today","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"}});
Deno.serve(async(req)=>{
if(req.method==="OPTIONS")return reply({});
if(req.method!=="POST")return reply({error:"Method not allowed"},405);
if(new URL(Deno.env.get("SUPABASE_URL")||"").hostname!==PROJECT+".supabase.co")return reply({error:"Staging only"},403);
const authorization=req.headers.get("Authorization")||"";
const match=authorization.match(/^Bearer\s+(\S+)$/i);
if(!match)return reply({error:"Sign in required"},401);
try{
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const {data:auth,error:ae}=await db.auth.getUser(match[1]);
if(ae||auth.user?.id!==CUSTOMER)return reply({error:"Not authorized for this staging diagnostic"},403);
const {data:p,error:pe}=await db.from("payment_transactions").select("id,order_id,customer_id,status,amount_due,payment_mode").eq("id",TX).single();
const {data:o,error:oe}=await db.from("orders").select("id,order_number,status,payment_status").eq("id",p?.order_id||"").single();
const {data:v,error:ve}=await db.from("payment_slip_verifications").select("storage_path,status,error_code,expected_amount").eq("id",ATTEMPT).eq("payment_transaction_id",TX).single();
if(pe||oe||ve||!p||!o||!v||p.customer_id!==CUSTOMER||p.status!=="expired"||o.status!=="cancelled"||o.payment_status!=="unpaid"||v.status!=="rejected"||v.error_code!=="ACCOUNT_MISMATCH"||Number(v.expected_amount)!==10||Number(p.amount_due)!==10||p.payment_mode!=="kshop_master")return reply({error:"Historical test transaction no longer matches safe diagnostic conditions"},409);
const {data:slip,error:se}=await db.storage.from("payment-slips").download(v.storage_path);
if(se||!slip)return reply({error:"Stored slip not available"},409);
const form=new FormData();form.append("image",slip,"bank-slip.jpg");form.append("remark",o.order_number);form.append("matchAccount","true");form.append("matchAmount","10.00");form.append("checkDuplicate","true");
const response=await fetch("https://api.easyslip.com/v2/verify/bank",{method:"POST",headers:{Authorization:"Bearer "+Deno.env.get("EASYSLIP_API_KEY")},body:form,signal:AbortSignal.timeout(25000)});
const data=await response.json().catch(()=>null);
return reply({state:"diagnostic_only",provider_http_status:response.status,provider_success:data?.success===true,error_code:data?.error?.code||null,receiver_matched:!!data?.data?.matchedAccount,receiver_name:data?.data?.matchedAccount?.nameEn||data?.data?.matchedAccount?.nameTh||null,receiver_bank:data?.data?.matchedAccount?.bank?.shortCode||null,amount_matched:data?.data?.isAmountMatched===true,duplicate:data?.data?.isDuplicate===true,slip_amount:data?.data?.amountInSlip||null,order_unchanged:true});
}catch{return reply({error:"Staging diagnostic failed; no order data changed"},502)}
});
