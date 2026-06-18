"use client";

import { useEffect, useMemo, useState } from "react";
import { useTwilio } from "@/context/TwilioContext";
import type { Operator, OperatorDepartment } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { events } from "@/lib/events";
import { getRoleName, ROLES } from "@/lib/roles";
import {
  getWorkerStatusBadgeVariant,
  parseWorkerStatusPayload,
} from "@/lib/worker-status";

type MaybeNumber = number | null | undefined;

interface OperatorsTableProps {
  operators: Operator[];
  scope: "department" | "company";
  departmentId?: number;
  currentUserId?: number;
  emptyMessage?: string;
}

const toFlag = (value: unknown): 0 | 1 => (Number(value) ? 1 : 0);

function resolveDepartmentDnd(
  operator: Operator,
  departmentId?: number
): 0 | 1 {
  if (!Array.isArray(operator.departments) || operator.departments.length === 0) {
    return 0;
  }

  if (departmentId) {
    const dept = operator.departments.find(
      (item) => Number(item.id) === Number(departmentId)
    );
    return toFlag(dept?.is_dnd);
  }

  return toFlag(operator.departments[0]?.is_dnd);
}

function resolveDepartmentRole(
  operator: Operator,
  departmentId?: number
): MaybeNumber {
  if (!Array.isArray(operator.departments) || operator.departments.length === 0) {
    return operator.role_id;
  }

  if (departmentId) {
    const dept = operator.departments.find(
      (item) => Number(item.id) === Number(departmentId)
    );
    return dept?.role_id ?? operator.role_id;
  }

  return operator.departments[0]?.role_id ?? operator.role_id;
}

function withCurrentUserStatus(
  list: Operator[],
  currentUserId?: number,
  activityName?: string | null
): Operator[] {
  if (!activityName || !currentUserId) return list;
  return list.map((operator) =>
    Number(operator.id) === Number(currentUserId)
      ? { ...operator, worker_status: activityName }
      : operator
  );
}

export default function OperatorsTable({
  operators,
  scope,
  departmentId,
  currentUserId,
  emptyMessage = "No operators found",
}: OperatorsTableProps) {
  const { activityName } = useTwilio();
  const [rows, setRows] = useState<Operator[]>([]);

  useEffect(() => {
    setRows(withCurrentUserStatus(operators, currentUserId, activityName));
  }, [operators, currentUserId, activityName]);

  useEffect(() => {
    const handleDndStatusChange = (data: Record<string, unknown>) => {
      if (!data || data.user_id == null || data.is_dnd == null) return;
      const eventDepartmentId =
        data.department_id != null ? Number(data.department_id) : undefined;
      const userId = Number(data.user_id);
      const isDnd = toFlag(data.is_dnd);

      setRows((prevRows) =>
        prevRows.map((operator) => {
          if (Number(operator.id) !== userId) return operator;

          const nextDepartments = (operator.departments ?? []).map((department: OperatorDepartment) => {
            const shouldUpdateDepartment =
              eventDepartmentId != null
                ? Number(department.id) === eventDepartmentId
                : scope === "department"
                ? departmentId == null || Number(department.id) === Number(departmentId)
                : true;

            return shouldUpdateDepartment
              ? { ...department, is_dnd: isDnd }
              : department;
          });

          return {
            ...operator,
            departments: nextDepartments,
          };
        })
      );
    };

    const handleInCallStatusChange = (data: Record<string, unknown>) => {
      if (!data || data.user_id == null || data.in_call == null) return;
      const userId = Number(data.user_id);
      const inCall = toFlag(data.in_call);

      setRows((prevRows) =>
        prevRows.map((operator) =>
          Number(operator.id) === userId ? { ...operator, in_call: inCall } : operator
        )
      );
    };

    const handleWorkerStatusChange = (data: Record<string, unknown>) => {
      const parsed = parseWorkerStatusPayload(data);
      if (!parsed) return;

      setRows((prevRows) =>
        prevRows.map((operator) =>
          Number(operator.id) === parsed.user_id
            ? { ...operator, worker_status: parsed.worker_status }
            : operator
        )
      );
    };

    events.on("refreshOperators", handleDndStatusChange);
    events.on("refreshInCallStatus", handleInCallStatusChange);
    events.on("refreshWorkerStatus", handleWorkerStatusChange);

    return () => {
      events.off("refreshOperators", handleDndStatusChange);
      events.off("refreshInCallStatus", handleInCallStatusChange);
      events.off("refreshWorkerStatus", handleWorkerStatusChange);
    };
  }, [scope, departmentId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>In-Call</TableHead>
              <TableHead>Overall DND</TableHead>
              <TableHead>Dept DND</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length > 0 ? (
              sortedRows.map((operator) => {
                const workerStatus = operator.worker_status ?? "—";
                const isInCall = toFlag(operator.in_call);
                const overallDnd = toFlag(operator.do_not_disturb);
                const departmentDnd = resolveDepartmentDnd(operator, departmentId);
                const roleId =
                  scope === "department"
                    ? resolveDepartmentRole(operator, departmentId)
                    : operator.role_id;

                return (
                  <TableRow key={operator.id}>
                    <TableCell>{operator.name ?? "—"}</TableCell>
                    <TableCell>{operator.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          roleId === ROLES.COMPANY_ADMIN || roleId === ROLES.MANAGER
                            ? "default"
                            : "secondary"
                        }
                      >
                        {getRoleName(roleId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getWorkerStatusBadgeVariant(workerStatus)}>
                        {workerStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isInCall === 0 ? "secondary" : "default"}>
                        {isInCall === 0 ? "No" : "Yes"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={overallDnd === 0 ? "secondary" : "destructive"}>
                        {overallDnd === 0 ? "No" : "Yes"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {scope === "department" ? (
                        <Badge variant={departmentDnd === 0 ? "secondary" : "destructive"}>
                          {departmentDnd === 0 ? "No" : "Yes"}
                        </Badge>
                      ) : Array.isArray(operator.departments) &&
                        operator.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {operator.departments.map((department) => {
                            const deptDnd = toFlag(department.is_dnd);
                            return (
                              <Badge
                                key={`${operator.id}-${department.id}`}
                                variant={deptDnd === 0 ? "secondary" : "destructive"}
                              >
                                {department.name}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No departments</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
