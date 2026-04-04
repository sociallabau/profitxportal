-- Allow all authenticated users to read all weekly_wins for the Wins Wall
CREATE POLICY "all_authenticated_read_wins"
ON public.weekly_wins
FOR SELECT
TO authenticated
USING (true);
