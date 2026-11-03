import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import EmptyState from "./EmptyState";
import Money from "./Money";
import { CircleCheck } from "lucide-react";

/** Borçlu müşteri listesi. Bakiye yalnızca Money bileşeni üzerinden gösterilir. */
export default function DashboardDebtorsTable({ debtors }) {
  if (!debtors?.length) {
    return <EmptyState icon={CircleCheck} title="Borçlu müşteri yok" description="Tüm bakiyeler kapalı." className="py-10" />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Müşteri</TableHead>
            <TableHead className="text-right">Servis</TableHead>
            <TableHead className="text-right">Bakiye</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debtors.map((d) => (
            <TableRow key={d.customer_id} data-testid={`debtor-${d.customer_id}`}>
              <TableCell className="font-medium text-slate-900">{d.customer_name}</TableCell>
              <TableCell className="text-right tabular-nums text-slate-600">{d.orders}</TableCell>
              <TableCell className="text-right">
                <Money value={d.balance} className="font-semibold text-red-600" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
