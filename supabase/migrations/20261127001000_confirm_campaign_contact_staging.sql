begin;
create function sc_private.confirm_contact_campaign_consent(
  p_cliente_id uuid, p_autorizado boolean, p_origem text,
  p_telefone text, p_unidade text
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1
  from public.sc_clientes c
  join public.sc_acessos a on a.user_id = auth.uid() and a.papel = 'gestor' and a.ativo
  join public.sc_acesso_unidades u on u.user_id = a.user_id and u.unidade = c.unidade
  where c.id = p_cliente_id and c.telefone = p_telefone and c.unidade = p_unidade
  for update of c;
  if not found then
    raise exception 'Contato alterado ou indisponível. Atualize a lista.' using errcode = '42501';
  end if;
  return sc_private.record_contact_campaign_consent(p_cliente_id, p_autorizado, p_origem);
end;
$$;

create function public.sc_confirmar_autorizacao_campanha(
  p_cliente_id uuid, p_autorizado boolean, p_origem text,
  p_telefone text, p_unidade text
)
returns bigint
language sql security invoker set search_path = ''
as $$
  select sc_private.confirm_contact_campaign_consent(
    p_cliente_id, p_autorizado, p_origem, p_telefone, p_unidade
  );
$$;

revoke all on function sc_private.confirm_contact_campaign_consent(uuid, boolean, text, text, text)
  from public, anon, authenticated;
revoke all on function public.sc_confirmar_autorizacao_campanha(uuid, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function sc_private.confirm_contact_campaign_consent(uuid, boolean, text, text, text)
  to authenticated;
grant execute on function public.sc_confirmar_autorizacao_campanha(uuid, boolean, text, text, text)
  to authenticated;
revoke execute on function public.sc_registrar_autorizacao_campanha(uuid, boolean, text)
  from authenticated;
revoke execute on function sc_private.record_contact_campaign_consent(uuid, boolean, text)
  from authenticated;
commit;
