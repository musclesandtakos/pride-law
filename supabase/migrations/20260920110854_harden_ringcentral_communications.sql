create policy ringcentral_connections_service_role
on public.ringcentral_connections for all to service_role
using (true) with check (true);

create index ringcentral_connections_connected_by_idx
  on public.ringcentral_connections (connected_by)
  where connected_by is not null;

create index client_communications_created_by_idx
  on public.client_communications (created_by)
  where created_by is not null;
