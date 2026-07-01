import type { Prisma, Player } from "@prisma/client";
import {
  ACTION_ENERGY_RECHARGE_MINUTES,
  getActionEnergySnapshot,
  spendActionEnergy
} from "@mypro/core";
import { prisma } from "@mypro/database";

type EnergyFields = Pick<Player, "id" | "actionEnergy" | "actionEnergyUpdatedAt">;

const careCenterRecoveryBonuses: Record<number, number> = {
  0: 0,
  1: 3,
  2: 6,
  3: 9,
  4: 12,
  5: 15
};

export function energyRechargeMinutesFromCareLevel(level: number) {
  const bonus = careCenterRecoveryBonuses[Math.max(0, Math.min(5, level))] ?? 0;
  return ACTION_ENERGY_RECHARGE_MINUTES * (1 - bonus / 100);
}

export async function clubCareCenterLevelForPlayer(
  playerId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const membership = await tx.clubMembership.findUnique({
    where: { playerId },
    include: { club: { select: { careCenterLevel: true } } }
  });
  return membership?.club.careCenterLevel ?? 0;
}

export function actionEnergyPayload(player: EnergyFields, careCenterLevel = 0) {
  const rechargeMinutes = energyRechargeMinutesFromCareLevel(careCenterLevel);
  const snapshot = getActionEnergySnapshot(
    player.actionEnergy,
    player.actionEnergyUpdatedAt,
    new Date(),
    rechargeMinutes
  );
  return {
    actionEnergy: snapshot.value,
    actionEnergyMax: snapshot.max,
    actionEnergyNextAt: snapshot.nextRechargeAt?.toISOString() ?? null,
    actionEnergyUpdatedAt: snapshot.updatedAt.toISOString(),
    actionEnergyRechargeMinutes: snapshot.rechargeMinutes,
    clubCareCenterLevel: careCenterLevel
  };
}

export async function actionEnergyPayloadWithClub(player: EnergyFields) {
  const careCenterLevel = await clubCareCenterLevelForPlayer(player.id);
  return actionEnergyPayload(player, careCenterLevel);
}

export async function spendCareerAction(
  player: EnergyFields,
  tx: Prisma.TransactionClient = prisma,
  amount = 1
) {
  const careCenterLevel = await clubCareCenterLevelForPlayer(player.id, tx);
  const rechargeMinutes = energyRechargeMinutesFromCareLevel(careCenterLevel);
  const spent = spendActionEnergy(
    player.actionEnergy,
    player.actionEnergyUpdatedAt,
    new Date(),
    amount,
    rechargeMinutes
  );
  if (!spent.spent) {
    const nextAt =
      spent.nextRechargeAt?.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
      }) ?? "bientôt";
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
