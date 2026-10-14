import {handlePush} from './dispatch.mjs';
Deno.serve(req=>handlePush(req,name=>Deno.env.get(name)));
