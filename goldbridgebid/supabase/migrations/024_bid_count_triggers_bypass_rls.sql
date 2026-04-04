-- Bid count triggers run in the session of the user who changed bids (usually the bidder).
-- RLS on projects only allows UPDATE when auth.uid() = customer_id, so the maintenance
-- UPDATE matched zero rows and bid_count stayed at 0 while bids rows existed.
-- SECURITY DEFINER runs these updates as the function owner so counts stay accurate.

CREATE OR REPLACE FUNCTION public.increment_bid_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects SET bid_count = bid_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_bid_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects SET bid_count = GREATEST(bid_count - 1, 0) WHERE id = OLD.project_id;
  RETURN OLD;
END;
$$;

-- Repair any projects where bid_count drifted from reality
UPDATE public.projects p
SET bid_count = (
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.bids b
  WHERE b.project_id = p.id
);
