import { body, createRoom, respond } from '../../../lib/rooms';
export async function POST(request: Request) { return respond(async()=>createRoom(await body(request))); }
