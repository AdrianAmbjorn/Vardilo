-- Add a restrictive guard; keep the existing family-membership policy.
-- Recovery: DROP POLICY family_lists_admin_delete ON public.family_lists;
CREATE POLICY family_lists_admin_delete ON public.family_lists
AS RESTRICTIVE FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.family_members member
  WHERE member.family_id = family_lists.family_id
    AND member.user_id = (SELECT auth.uid())
    AND member.role = 'admin'
));
