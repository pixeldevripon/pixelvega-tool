import { AuditLogsView } from "@/components/dashboard/audit-logs-view";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuditLogsView
      initialActorId={firstParam(params.userId)}
      initialTargetId={firstParam(params.targetId)}
      initialTargetType={firstParam(params.targetType)}
    />
  );
}
