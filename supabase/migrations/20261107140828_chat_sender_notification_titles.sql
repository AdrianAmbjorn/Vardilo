CREATE OR REPLACE FUNCTION vardilo_private.name_chat_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sender_name text;
BEGIN
  IF NEW.announcement_title IS NOT NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(btrim(member.display_name), ''), 'En familjemedlem')
    INTO sender_name FROM public.family_members member
    WHERE member.id = NEW.member_id AND member.family_id = NEW.family_id;
  UPDATE public.notifications SET
    title = COALESCE(sender_name, 'En familjemedlem') || ' skriver i chatten:',
    body = NEW.body
  WHERE family_id = NEW.family_id AND type = 'chat'
    AND metadata->>'message_id' = NEW.id::text;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION vardilo_private.name_chat_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zy_chat_sender_notification AFTER INSERT ON public.family_chat_messages
FOR EACH ROW EXECUTE FUNCTION vardilo_private.name_chat_notification();

