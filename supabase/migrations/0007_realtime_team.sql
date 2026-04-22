-- =======================================================================
-- OFFI · Realtime for team chats
-- Публикуем messages/channels/channel_members в supabase_realtime,
-- чтобы клиент через Supabase Realtime получал live-обновления.
-- =======================================================================

-- ADD TABLE не идемпотентно — оборачиваем в do-блок, игнорируем дубликаты
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.channels;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.channel_members;
  exception when duplicate_object then null;
  end;
end $$;

-- REPLICA IDENTITY FULL — чтобы в payload попадали старые значения (для UPDATE/DELETE)
alter table public.messages         replica identity full;
alter table public.channels         replica identity full;
alter table public.channel_members  replica identity full;

-- Полезные индексы
create index if not exists channel_members_user_idx on public.channel_members (user_id);
