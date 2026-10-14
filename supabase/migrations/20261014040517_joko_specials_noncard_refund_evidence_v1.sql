-- Stripe non-card refund objects use pyr_ as well as re_.
-- Keep service-role-only evidence and final success gating unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_refund IS NULL OR p_refund !~ '^(re|pyr)_[A-Za-z0-9]+$' OR p_status NOT IN ('pending','succeeded','failed','canceled','requires_action') THEN RAISE EXCEPTION 'Invalid refund evidence'; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref='stripe:'||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 IF receipt.disposition IN ('refunded','credited') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason='Stripe payment after stock hold release',disposition=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,refunded_amount=CASE WHEN p_status='succeeded' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref='stripe:'||p_intent AND disposition IN ('refund_pending','refunded');
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state='released';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;
COMMIT;
