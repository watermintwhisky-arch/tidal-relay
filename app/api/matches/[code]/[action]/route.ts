import { body, room, respond } from '../../../../../lib/rooms';
export async function POST(request:Request,context:{params:Promise<{code:string;action:string}>}) { const {code,action}=await context.params; return respond(async()=>room(code,action,await body(request))); }
