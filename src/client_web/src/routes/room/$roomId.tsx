import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * LEGACY(places): the /room/{id} sticker redirect — remove when the printed
 * room/table stickers are reprinted with /p/{id}.
 *
 * The older printed room QR encodes https://chillax.site/room/{id}. Rooms
 * kept their ids in the Places remodel, so the room id is the place id.
 */
export const Route = createFileRoute('/room/$roomId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/p/$placeId',
      params: { placeId: params.roomId },
      replace: true,
    })
  },
})
