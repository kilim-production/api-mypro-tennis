import type { Prisma, Player } from "@prisma/client";
import { getActionEnergySnapshot, spendActionEnergy } from "@mypro/core";
import { prisma } from "@mypro/database";

type EnergyFields = Pick<Player, "id" | "actionEnergy" | "actionEnergyUpdatedAt">;

export function actionEnergyPayload(player: EnergyFields) {
  const snapshot = getActionEnergySnapshot(player.actionEnergy, player.actionEnergyUpdatedAt);
  return {
    actionEnergy: snapshot.value,
    actionEnergyMax: snapshot.max,
    actionEnergyNextAt: snapshot.nextRechargeAt?.toISOString() ?? null,
    actionEnergyUpdatedAt: snapshot.updatedAt.toISOString()
  };
}

export async function spendCareerAction(player: EnergyFields, tx: Prisma.TransactionClient = prisma, amount = 1) {
  const spent = spendActionEnergy(player.actionEnergy, player.actionEnergyUpdatedAt, new Date(), amount);
  if (!spent.spent) {
    const nextAt = spent.nextRechargeAt?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) ?? "bientôt";
    throw new Error(`Énergie insuffisante. Prochain point vers ${nextAt}.`);
  }
  await tx.player.update({
    where: { id: player.id },
    data: {
      actionEnergy: spent.remaining,
      actionEnergyUpdatedAt: spent.updatedAt
    }
  });
  return spent;
}
