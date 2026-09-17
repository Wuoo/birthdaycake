import type { Cake, Table } from './scene-engine';

const PUBLIC_BASE=(import.meta.env.BASE_URL||'/').replace(/\/?$/,'/');

export const THEMES:Record<Cake,{name:string;table:Table;cloth:string;paper:string;ribbon:string;plate:string;metal:string;light:string;music:{src:string;title:string}}>={
 chocolate:{name:'深夜庆典',table:'walnut',cloth:'#45202a',paper:'#252326',ribbon:'#b39263',plate:'#241c17',metal:'#b99769',light:'#ffdfba',music:{src:`${PUBLIC_BASE}audio/raining-man.mp3`,title:"IT'S RAINING MAN"}},
 blueberry:{name:'月光花园',table:'oak',cloth:'#647784',paper:'#e1dccd',ribbon:'#718596',plate:'#cbc9bc',metal:'#c4c8ce',light:'#f5eddf',music:{src:`${PUBLIC_BASE}audio/sunway.mp3?v=8bb394fc-20260916`,title:'SUNWAY'}},
 redvelvet:{name:'温柔晚宴',table:'travertine',cloth:'#581e2b',paper:'#591e2b',ribbon:'#d8c19a',plate:'#e0d4bf',metal:'#cdb58b',light:'#ffe5c9',music:{src:`${PUBLIC_BASE}audio/stay-with-me.mp3`,title:'STAY WITH ME'}}
};
