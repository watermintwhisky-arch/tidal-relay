import { room, respond } from '../../../../lib/rooms';
export async function GET(_request:Request,context:{params:Promise<{code:string}>}) { const {code}=await context.params; return respond(()=>room(code)); }
