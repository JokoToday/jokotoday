import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import Stripe from "npm:stripe@22.6.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const required = (name: string) => { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({error: "POST required"},405);
  try {
    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply({error: "Sign in required"},401);
    const service = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {auth:{persistSession:false}});
    const {data:auth,error:authError}=await service.auth.getUser(token);
    if (authError || !auth.user) return reply({error:"Sign in required"},401);
    const {data:profile,error:profileError}=await service.from("user_profiles").select("role").eq("id",auth.user.id).single();
    if (profileError || profile?.role!=="admin") return reply({error:"Admin required"},403);
    const body=await req.json().catch(()=>null);
    const orderId=body?.order_id;
    if (typeof orderId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return reply({error:"Order required"},400);
    const {data:checkout,error:checkoutError}=await service.from("specials_checkouts").select("inventory_state,financial_state").eq("order_id",orderId).single();
    if (checkoutError || !checkout) return reply({error:"Specials order not found"},404);
    if (checkout.inventory_state!=="released" || checkout.financial_state!=="refund_pending") return reply({error:"Only a released Specials hold awaiting refund can be retried"},409);
    const {data:payment,error:paymentError}=await service.from("payment_transactions").select("id,order_id,provider,payment_mode,amount_due,currency,provider_transaction_ref").eq("order_id",orderId).eq("provider","stripe").single();
    if (paymentError || !payment || payment.payment_mode!=="stripe_promptpay" || payment.currency!=="THB" && payment.currency!=="thb") return reply({error:"Stripe payment not found"},409);
    const stripe=new Stripe(required("STRIPE_SECRET_KEY"));
    const intent=await stripe.paymentIntents.retrieve(payment.provider_transaction_ref);
    if (intent.status!=="succeeded" || intent.currency!=="thb" || intent.amount_received!==Math.round(Number(payment.amount_due)*100) || intent.metadata?.joko_payment_transaction_id!==payment.id) return reply({error:"Stripe payment evidence does not match the order"},409);
    const refund=await stripe.refunds.create({payment_intent:intent.id,metadata:{reason:"joko_payment_not_attachable",joko_payment_transaction_id:payment.id,joko_order_id:payment.order_id}},{idempotencyKey:`joko-late-refund-${intent.id}`});
    const {error:saveError}=await service.rpc("specials_stripe_refund_v1",{p_order:orderId,p_intent:intent.id,p_refund:refund.id,p_status:refund.status || "pending"});
    if (saveError) throw saveError;
    return reply({refund_id:refund.id,status:refund.status,livemode:intent.livemode});
  } catch(error) {
    console.error("Specials Stripe refund retry failed",{message:error instanceof Error?error.message:"Provider or database error"});
    return reply({error:"Refund retry could not be confirmed. Check reconciliation before retrying."},503);
  }
});
