-- Tracks which agent/rep actually closed the sale (can differ from the submitting agent on a
-- team-closed deal), entered freeform on the order form alongside the other order-detail fields.
ALTER TABLE sales ADD COLUMN closer_name TEXT;
