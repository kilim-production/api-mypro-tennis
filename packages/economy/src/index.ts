export type Transaction = {
  label: string;
  amount: number;
  kind: "revenu" | "depense";
};

export function applyTransaction(balance: number, transaction: Transaction) {
  return transaction.kind === "revenu" ? balance + transaction.amount : balance - transaction.amount;
}
