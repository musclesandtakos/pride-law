export type WorkspaceMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  must_change_password: boolean;
  temporary_password_expires_at: string | null;
};

export function upsertMember(members: WorkspaceMember[], incoming: WorkspaceMember) {
  const exists = members.some((member) => member.id === incoming.id);
  if (!exists) return [...members, incoming];
  return members.map((member) => member.id === incoming.id ? incoming : member);
}
