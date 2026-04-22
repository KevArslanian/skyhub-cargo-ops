import { db } from "./prisma";

type CountBucket = {
  value: number;
};

function toNumber(value: bigint | number) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return value;
}

export async function getQueryDiagnostics() {
  const [
    customerAccountCount,
    userCount,
    userSettingCount,
    flightCount,
    shipmentCount,
    trackingLogCount,
    shipmentDocumentCount,
    activityLogCount,
    notificationCount,
    recentAwbSearchCount,
    systemKpiCount,
    roleDistribution,
    shipmentStatusDistribution,
    flightStatusDistribution,
    accountSummary,
    sampleShipments,
    topFlightsByShipment,
    usersWithSettings,
    customerUsersWithAccount,
    shipmentsWithFlight,
    shipmentsWithCustomerAccount,
    orphanedTrackingRows,
    systemKpi,
  ] = await Promise.all([
    db.customerAccount.count(),
    db.user.count(),
    db.userSetting.count(),
    db.flight.count({ where: { archivedAt: null } }),
    db.shipment.count({ where: { archivedAt: null } }),
    db.trackingLog.count(),
    db.shipmentDocument.count({ where: { deletedAt: null } }),
    db.activityLog.count(),
    db.notification.count(),
    db.recentAwbSearch.count(),
    db.systemKpi.count(),
    db.user.groupBy({
      by: ["role", "status"],
      _count: { _all: true },
      orderBy: [{ role: "asc" }, { status: "asc" }],
    }),
    db.shipment.groupBy({
      by: ["status"],
      where: { archivedAt: null },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    db.flight.groupBy({
      by: ["status"],
      where: { archivedAt: null },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    db.customerAccount.findMany({
      select: {
        code: true,
        name: true,
        status: true,
        _count: { select: { users: true, shipments: true } },
      },
      orderBy: { code: "asc" },
    }),
    db.shipment.findMany({
      where: { archivedAt: null },
      take: 5,
      orderBy: { receivedAt: "desc" },
      select: {
        awb: true,
        status: true,
        origin: true,
        destination: true,
        customerAccount: { select: { code: true, name: true } },
        flight: { select: { flightNumber: true, status: true } },
        _count: { select: { trackingLogs: true, documents: true } },
      },
    }),
    db.flight.findMany({
      where: { archivedAt: null },
      take: 5,
      orderBy: { shipments: { _count: "desc" } },
      select: {
        flightNumber: true,
        status: true,
        origin: true,
        destination: true,
        _count: { select: { shipments: true } },
      },
    }),
    db.user.count({ where: { settings: { isNot: null } } }),
    db.user.count({ where: { role: "customer", customerAccountId: { not: null } } }),
    db.shipment.count({ where: { archivedAt: null, flightId: { not: null } } }),
    db.shipment.count({ where: { archivedAt: null, customerAccountId: { not: null } } }),
    db.$queryRaw<Array<CountBucket>>`
      SELECT COUNT(*)::integer AS value
      FROM "TrackingLog" log
      LEFT JOIN "Shipment" shipment ON shipment.id = log."shipmentId"
      WHERE shipment.id IS NULL
    `,
    db.systemKpi.findUnique({ where: { id: "global" } }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      customerAccount: customerAccountCount,
      user: userCount,
      userSetting: userSettingCount,
      flight: flightCount,
      shipment: shipmentCount,
      trackingLog: trackingLogCount,
      shipmentDocument: shipmentDocumentCount,
      activityLog: activityLogCount,
      notification: notificationCount,
      recentAwbSearch: recentAwbSearchCount,
      systemKpi: systemKpiCount,
    },
    roleDistribution: roleDistribution.map((item) => ({
      role: item.role,
      status: item.status,
      total: item._count._all,
    })),
    shipmentStatusDistribution: shipmentStatusDistribution.map((item) => ({
      status: item.status,
      total: item._count._all,
    })),
    flightStatusDistribution: flightStatusDistribution.map((item) => ({
      status: item.status,
      total: item._count._all,
    })),
    accountSummary,
    sampleShipments,
    topFlightsByShipment,
    relationalChecks: {
      usersWithSettings,
      customerUsersWithAccount,
      shipmentsWithFlight,
      shipmentsWithCustomerAccount,
      orphanedTrackingLogs: toNumber(orphanedTrackingRows[0]?.value ?? 0),
    },
    systemKpi,
  };
}
