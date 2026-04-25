-- Add operational indexes for frequent filters, relation lookups, and timeline ordering.

CREATE INDEX "Shipment_archivedAt_updatedAt_idx" ON "Shipment"("archivedAt", "updatedAt");

CREATE INDEX "Shipment_archivedAt_receivedAt_idx" ON "Shipment"("archivedAt", "receivedAt");

CREATE INDEX "Shipment_archivedAt_status_updatedAt_idx" ON "Shipment"("archivedAt", "status", "updatedAt");

CREATE INDEX "Shipment_customerAccountId_archivedAt_updatedAt_idx" ON "Shipment"("customerAccountId", "archivedAt", "updatedAt");

CREATE INDEX "Shipment_flightId_archivedAt_idx" ON "Shipment"("flightId", "archivedAt");

CREATE INDEX "Shipment_createdById_idx" ON "Shipment"("createdById");

CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

CREATE INDEX "User_customerAccountId_idx" ON "User"("customerAccountId");

CREATE INDEX "Flight_archivedAt_status_idx" ON "Flight"("archivedAt", "status");

CREATE INDEX "Flight_departureTime_idx" ON "Flight"("departureTime");

CREATE INDEX "Flight_cargoCutoffTime_idx" ON "Flight"("cargoCutoffTime");

CREATE INDEX "TrackingLog_shipmentId_createdAt_idx" ON "TrackingLog"("shipmentId", "createdAt");

CREATE INDEX "ShipmentDocument_shipmentId_deletedAt_idx" ON "ShipmentDocument"("shipmentId", "deletedAt");

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");

CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

CREATE INDEX "RecentAwbSearch_userId_createdAt_idx" ON "RecentAwbSearch"("userId", "createdAt");

CREATE INDEX "RecentAwbSearch_awb_idx" ON "RecentAwbSearch"("awb");
