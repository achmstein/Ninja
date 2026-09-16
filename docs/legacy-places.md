# Legacy left by the Places remodel — what to delete, and when

The Places remodel (branch `feature/places`, 2026‑09‑16) replaced Rooms, Tables and Reservations with **Place / Tariff / Stay**. So that printed QR stickers, installed tills and phones keep working through one release, a number of compatibility shims were kept on purpose. Every one of them is marked in the code with the same tag:

```
LEGACY(places): <what it is> — remove when <condition>.
```

`grep -rn "LEGACY(places)" src` lists all of them. **The staff apps carry none**: admin_web, admin_app, pos_web, pos_app, kds_web and kds_app speak only place and stay. Legacy lives in the services (for tills and phones not yet updated, and for old stickers) and in the two customer apps (for printed stickers). This file is the same list, grouped, with the condition that lets each one go. Nothing here is needed by the new model; it exists only for something old that is still out there.

## The conditions

| Id | Condition | What has to be true first |
| --- | --- | --- |
| **C1** | every till and customer app is on `/api/places` and `/api/stays` | Every app in the repo is switched (done on the branch). The condition is about what is *installed*: once the tills and phones in the field run this release, nothing calls the aliases or reads the old fields. The E2E suite's `CashierActor` still exercises `/api/rooms`; move it to `/api/places` before deleting the aliases. |
| **C2** | the printed room/table stickers are reprinted with `/p/{id}` | New sheets print `https://chillax.site/p/{placeId}`. Once no sticker with `/room/{id}` or `/table/{id}` is on a table, the old links and every legacy‑id lookup can go. |
| **C3** | Sales, Ordering and Notification stop sending the old room/table fields | Once every installed client is on the new fields (C1), the services stop filling `RoomId/RoomName/TableId/TableName`; the release after, the customer apps' fallbacks that read them go too. |
| **C4** | one release after `/places` and `/stays` ship | Customer web bookmarks and old push payloads that still open `/rooms` or `/sessions`. |
| **C5** | the Live Activity / native channel is updated to place keys | client_app's iOS/Android Live Activity reads `roomId` / `roomName…` keys and `active_session_room_*` prefs. The native side changes first, then the Dart side. |

## Removal order

1. Release this branch; every app in it is on places and stays. Reprint stickers as `/p/{id}` during that release (C2). Update the native Live Activity keys (C5).
2. Next release, once the installed tills and phones are on it (C1): move the E2E `CashierActor` to `/api/places`, then delete everything under C1 and C2 — alias routes, `RoomViewModel`, legacy ids and columns, old request fields — and stop filling the old event fields (C3, services side). Drop the customer web redirects (C4).
3. Release after that: delete the customer apps' fallbacks that read the old fields (C3, client side).

Migrations under `*/Migrations/` are history and are never edited; dropping a column is a new migration. Consumer copies of an event must drop a field in the same release as the producer, or keep the default.

## Inventory

The tables are the `LEGACY(places)` markers as of the branch head. Line numbers drift; the tag is the source of truth.

### Spaces

| File | Line | What | When |
| --- | --- | --- | --- |
| src/Spaces.API/Apis/RoomsApi.cs | 15, 27 | `RoomsApi`: the `/api/rooms` alias routes and its `MapGroup` | C1 |
| src/Spaces.API/Apis/RoomsApi.cs | 280–311 | `RoomPhysicalStatus`, `ReserveRoomRequest`, `WalkInSessionRequest`, `StartWalkInSessionResult`, `StartSessionRequest`, `ChangePlayerModeRequest`, `JoinSessionResult`, `CreateRoomRequest`, `UpdateRoomRequest` (old shapes: PlayerMode, SingleRate/MultiRate, RoomId/RoomName) | C1 |
| src/Spaces.API/Apis/TablesApi.cs | 15, 26 | `TablesApi`: the `/api/tables` alias routes and its `MapGroup` | C1 |
| src/Spaces.API/Apis/TablesApi.cs | 39, 52 | `Resolve` and `GetTableById`: the id is tried as `LegacyTableId` before place id | C2 |
| src/Spaces.API/Apis/TablesApi.cs | 112–118 | `CreateTableRequest`, `UpdateTableRequest`, `SetTableActiveRequest` | C1 |
| src/Spaces.API/Application/Queries/RoomViewModel.cs | whole file | `RoomDisplayStatus`, `ReservationStatus`, `RoomViewModel`, `ReservationViewModel`, `SessionStats*`, `SessionMemberViewModel`, `SessionSegmentViewModel`, `SessionPreviewViewModel`, `RoomScanViewModel`, `LegacyMapping` (ToRoom/ToTable/ToReservation/ToRoomScan/ToLegacy) | C1 |
| src/Spaces.API/Application/Queries/RoomViewModel.cs | 172 | `ToTable`: `Id = place.LegacyTableId ?? place.Id` | C2 |
| src/Spaces.API/Application/Queries/TableViewModel.cs | 6, 12 | `TableViewModel` (old `/api/tables` shape); its `Id` is the printed sticker id | C1 / C2 |
| src/Spaces.API/Application/Queries/PlaceViewModels.cs | 45, 50, 233 | `PlaceViewModel.LegacyRoomId` / `LegacyTableId` and the mapping that fills them | C2 |
| src/Spaces.API/Application/Queries/IPlaceQueries.cs, PlaceQueries.cs | 16, 52 | `GetPlaceByLegacyTableIdAsync` | C2 |
| src/Spaces.API/Application/IntegrationEvents/Events/SpacesIntegrationEvents.cs | 7 | header: every event still carries `RoomId/RoomName`, `PlayerMode`, Single/Multi figures | C1 |
| … SpacesIntegrationEvents.cs | 24 | `PlaceUpdated.LegacyRoomId/LegacyTableId` | C2 |
| … SpacesIntegrationEvents.cs | 32, 47, 63, 73, 99, 121, 136, 148, 166 | `RoomId/RoomName` on RoomReserved, SessionStarted, SessionEnded, RoomBecameAvailable, SessionCompleted, SessionMemberJoined, SessionCustomerAssigned, ReservationCancelled, SessionPaid | C1 |
| … SpacesIntegrationEvents.cs | 52, 126 | `PlayerMode` on SessionStarted, SessionMemberJoined | C1 |
| … SpacesIntegrationEvents.cs | 102, 106 | `SessionCompleted.SingleCost/MultiCost`, `SingleDuration/MultiDuration` (superseded by `Costs`) | C1 |
| src/Spaces.API/Application/DomainEventHandlers/StayDomainEventHandlers.cs | 23, 46–204 | `StayEventFields.OptionWord` and every handler filling `RoomId/RoomName`, `PlayerMode`, Single/Multi cost and duration | C1 |
| … StayDomainEventHandlers.cs | 237 | `PlaceEventMapping.ToUpdatedEvent` projects the legacy ids | C2 |
| src/Spaces.API/Application/IntegrationEvents/EventHandling/TicketSettledIntegrationEventHandler.cs | 50 | `SessionPaid` publish fills `RoomId` | C1 |
| src/Spaces.Domain/AggregatesModel/PlaceAggregate/Place.cs | 26, 32, 115 | `Place.LegacyRoomId`, `LegacyTableId`, `RememberLegacyIds` | C2 |
| src/Spaces.Domain/AggregatesModel/PlaceAggregate/IPlaceRepository.cs | 15, 21 | `GetByLegacyRoomIdAsync` (no callers), `GetByLegacyTableIdAsync` | C2 |
| src/Spaces.Infrastructure/EntityConfigurations/PlaceEntityTypeConfiguration.cs | 48, 55 | legacy id columns and their unique indexes | C2 (new migration) |
| src/Spaces.Infrastructure/Repositories/PlaceRepository.cs | 33, 37 | the two legacy finders | C2 |

### Sales

| File | Line | What | When |
| --- | --- | --- | --- |
| src/Sales.Domain/AggregatesModel/TicketAggregate/Ticket.cs | 51, 55 | `Ticket.RoomId`, `Ticket.TableId` columns beside `PlaceId` | C1 (new migration) |
| … Ticket.cs | 256, 274, 733 | `OpenForSession` fills `RoomId`; `OpenForTable` stores the old table id; `MoveLines` target carries `TableId` | C1 |
| … Ticket.cs | 378 | `AppendSessionTime(single/multi)` overload for events without `Costs` | C1 |
| src/Sales.Domain/AggregatesModel/TicketAggregate/ITicketRepository.cs, src/Sales.Infrastructure/Repositories/TicketRepository.cs | 17, 28 | `FindOpenByTableAsync` | C1 |
| src/Sales.Infrastructure/Repositories/TicketRepository.cs | 64 | `FindOpenRoomAsync` also matches `RoomId` | C1 |
| src/Sales.Infrastructure/EntityConfigurations/TicketEntityTypeConfiguration.cs | 80 | index on `(TableId, Status)` | C1 (new migration) |
| src/Sales.API/Apis/TicketsApi.cs | 620, 638 | `OpenTicketRequest.TableId/TableName`, `NewTicketRequest.TableId/TableName` | C1 |
| src/Sales.API/Application/Commands/OpenTicketCommand.cs | 13, 39 | command fields; fallback to `FindOpenByTableAsync` | C1 |
| src/Sales.API/Application/Commands/MoveTicketLinesCommand.cs | 6, 93 | `NewTicketTarget.TableId/TableName`; fallback to `FindOpenByTableAsync` | C1 |
| src/Sales.API/Application/Queries/TicketViewModel.cs, TicketQueries.cs | 18, 63 / 87, 244 | `RoomId/TableId` on summary and detail view models and their projections | C1 |
| src/Sales.API/Application/IntegrationEvents/EventHandling/OrderStatusChangedToConfirmedIntegrationEventHandler.cs | 113, 125, 131, 144 | routes by `RoomId/RoomName`, `TableId` when the event has no place | C1 |
| … SessionCompletedIntegrationEventHandler.cs | 32, 53 | late‑open by `RoomId/RoomName`; Single/Multi path when `Costs` is null | C1 |
| … SessionStartedIntegrationEventHandler.cs | 35 | `OpenForSession` falls back to `RoomId/RoomName` | C1 |
| src/Sales.API/Application/IntegrationEvents/Events/*.cs | — | consumer copies: `RoomId/RoomName/TableId/TableName`, `PlayerMode`, Single/Multi figures on OrderStatusChangedToConfirmed, ReservationCancelled, SessionCompleted, SessionCustomerAssigned, SessionMemberJoined, SessionStarted | C1 |

### Ordering

| File | Line | What | When |
| --- | --- | --- | --- |
| src/Ordering.Domain/AggregatesModel/OrderAggregate/Order.cs | 41, 54, 67, 74 | `RoomName`, `RoomId`, `TableId`, `TableName` columns beside the Destination | C1 (new migration) |
| … Order.cs | 115, 236, 256 | `HasDestination` fallbacks; constructor fills old and new from each other; branches for an order named only the old way | C1 |
| src/Ordering.Infrastructure/EntityConfigurations/OrderEntityTypeConfiguration.cs | 50, 53 | `RoomName`/`TableName` owned JSON columns | C1 (new migration) |
| src/Ordering.Infrastructure/EntityConfigurations/PlaceEntityTypeConfiguration.cs, Projections/Place.cs | 18 / 30, 36 | places projection: `LegacyRoomId/LegacyTableId` and their indexes | C2 (new migration) |
| src/Ordering.API/Apis/OrdersApi.cs | 189, 317 | `Places.ResolveAsync(PlaceId, RoomId, TableId)` on create / POS create | C2 |
| … OrdersApi.cs | 715–718, 745–747 | `CreateOrderRequest.RoomName/TableId/TableName/RoomId`, `PosOrderRequest.TableId/TableName/RoomName` | C1 |
| src/Ordering.API/Application/Commands/CreateOrderCommand.cs | 38–65, 151 | the four old fields; `HasDestination` fallbacks | C1 |
| src/Ordering.API/Application/Queries/IPlaceQueries.cs | 12–48 | `FindByRoomIdAsync`, `FindByTableIdAsync`, `ResolveAsync` old‑id branches | C2 |
| src/Ordering.API/Application/Queries/OrderViewModel.cs | 38–48, 91, 93, 156–164 | `RoomName/RoomId/TableId/TableName` on Order, KitchenOrder, OrderSummary | C1 |
| src/Ordering.API/Application/IntegrationEvents/Events/OrderStatusChangedToConfirmedIntegrationEvent.cs | 18, 34, 38, 43 | the old four fields beside the place | C1 |
| src/Ordering.API/Application/DomainEventHandlers/OrderStatusChangedToConfirmedDomainEventHandler.cs | 74 | fills them | C1 |
| src/Ordering.API/Application/IntegrationEvents/Events/PlaceUpdatedIntegrationEvent.cs, EventHandling/PlaceUpdatedIntegrationEventHandler.cs | 20 / 54 | consumer copy and projection of the legacy ids | C2 |

### Notification

| File | Line | What | When |
| --- | --- | --- | --- |
| src/Notification.API/Model/ServiceRequest.cs | 16–29 | `RoomId`, `RoomName`, `TableId`, `TableName` columns beside `PlaceId/PlaceKind` | C1 (new migration) |
| … ServiceRequest.cs | 43 | `ServiceRequestType.SwitchToMulti/SwitchToSingle` (mapped onto `ChangeOption`) | C1 |
| src/Notification.API/Model/Place.cs | 29, 35 | places projection: `LegacyRoomId/LegacyTableId` | C2 (new migration) |
| src/Notification.API/Infrastructure/NotificationContext.cs | 43, 61, 81 | old name columns, `(RoomId, Status)` index, legacy id indexes | C1 / C2 (new migration) |
| src/Notification.API/Apis/NotificationApi.cs | 674, 700, 712, 738 | `CreateServiceRequest`: `atTable`, RoomId/TableId lookup, name fallbacks, SwitchTo* → option code, `roomId` derived for older tills, fills the old columns | C1 |
| … NotificationApi.cs | 787, 795 | `ResolvePlaceAsync` legacy id branches | C2 |
| … NotificationApi.cs | 961, 975 | `CreateServiceRequestDto` and `ServiceRequestResponse` old fields | C1 |
| src/Notification.API/IntegrationEvents/Events/*.cs | — | consumer copies: `RoomId/RoomName`, `PlayerMode` on every Spaces event, `RoomName` on OrderStatusChangedToConfirmed, old four on ServiceRequestCreated, legacy ids on PlaceUpdated | C1 / C2 |
| src/Notification.API/IntegrationEvents/EventHandling/*Handler.cs | — | hub payloads send `roomId`/`tableId` beside `placeId` (with `RoomId` fallback); FCM data `playerMode`, `roomId/roomName`; SwitchTo* switch arms; projection of legacy ids | C1 / C2 |

### Customer web (client_web)

| File | Line | What | When |
| --- | --- | --- | --- |
| src/routes/rooms.tsx, src/routes/sessions.tsx | 4 | `/rooms` → `/places`, `/sessions` → `/stays` redirects | C4 |
| src/routes/room/$roomId.tsx | 4 | `/room/{id}` sticker redirect to `/p/{id}` | C2 |
| src/routes/table/$tableId.tsx | 10, 17 | `/table/{id}` sticker route, resolved through `/api/tables` | C2 |
| src/routes/cart.tsx | 233 | `roomName/roomId/tableId/tableName` sent beside the place fields | C3 |
| src/routes/orders/index.tsx | 365 | order tile reads `roomName` | C3 |

### Customer app (client_app)

| File | Line | What | When |
| --- | --- | --- | --- |
| lib/core/router/app_router.dart | 96, 111, 147, 164 | `/table/:tableId` and `/room/:roomId` routes and the pre‑sign‑in allowance for them | C2 |
| lib/features/tables/** (`table_link_screen.dart`, `cafe_table.dart`, `table_service.dart`), lib/core/config/app_config.dart 21, lib/core/network/api_client.dart 106 | — | resolving a table sticker id through `/api/tables` | C2 |
| lib/features/places/screens/qr_scan_screen.dart | 19, 55, 77 | scanning a `/room/` or `/table/` sticker | C2 |
| lib/features/cart/screens/cart_screen.dart 621, lib/features/menu/screens/menu_screen.dart 780–810, lib/features/orders/services/order_service.dart 29–526 | — | `roomName/roomId/tableId/tableName` sent beside the place fields (checkout, fast order, retry signature) | C3 |
| lib/core/providers/current_place_provider.dart | 155 | `OrderDestination.isRoom` (gates the old room fields) | C3 |
| lib/features/orders/models/order.dart 86–213, screens/orders_screen.dart 345 | — | `roomName/tableName` on orders; unused `CreateOrderRequest` | C3 |
| lib/features/service_request/models/service_request.dart | 83, 106 | `roomId/roomName` on the response | C3 |
| lib/core/services/session_notification_service.dart | 286, 312 | notification actions post `roomId/roomName` only | C3 |
| lib/core/services/session_notification_service.dart 119–352, lib/core/services/firebase_service.dart 29, 44 | — | native channel keys and `active_session_room_*` prefs | C5 |

### Not legacy, in case it looks like it

- The staff apps: nothing under `src/admin_*`, `src/pos_*`, `src/kds_*` is legacy; they send `placeId`/`placeName` and read `placeKind`/`placeName` only.

- The SignalR group named `rooms` and the `useRoomsGroup` hook: the group name is a channel id, not the model.
- i18n keys `rooms`, `sessions`, `noSessionsYet` and the like: text ids shared with the ARB; the strings behind them are what the owner sees.
- `TicketType.Room/Table/Counter` in Sales: kept on purpose for the X/Z reports; the rules key on `HasSession`.
- Spaces' `/api/places` and `/api/stays`, `PlaceKind`, `Tariff`, `Stay`: the model itself.
