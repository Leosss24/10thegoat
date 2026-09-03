function fold(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim()}

export function isWomensTeam(name:string){
  const normalized=fold(name).replace(/[()]/g," ").replace(/\s+/g," ");
  if(/(?:^|\s)(?:women|womens|woman|ladies|femenino|femenina|feminino|feminina|femminile|frauen|damen|dames|vrouwen|kvinner|kvinnor|feminines|femmes)(?:\s|$)/.test(normalized))return true;
  return /(?:\s|[-/])(?:w|f|fem|wfc)$/.test(normalized);
}

export function isReserveOrYouthClub(name:string){
  const raw=name.trim(),normalized=fold(raw);
  if(normalized==="willem ii")return false;
  if(/^jong\s+/i.test(raw))return true;
  if(/\b(?:u|sub|under)[ -]?(?:15|16|17|18|19|20|21|23)\b/i.test(raw))return true;
  if(/\b(?:reserves?|reserve|youth|academy|primavera|juvenil|juniores|amateurs?)\b/i.test(raw))return true;
  if(/\b(?:b team|second team|2nd team|development squad)\b/i.test(raw))return true;
  if(/(?:\s|[-/])(?:b|c|ii|iii|2)$/i.test(raw))return true;
  return ["real madrid castilla","barcelona atletic","barca atletic","bilbao athletic","betis deportivo","sevilla atletico","atletico madrileno","valencia mestalla","deportivo fabril","celta fortuna","juventus next gen","milan futuro"].includes(normalized);
}

function badgeKey(url:string){
  try{const parsed=new URL(url);return `${parsed.hostname}${parsed.pathname}`.toLocaleLowerCase()}
  catch{return url.split(/[?#]/)[0].toLocaleLowerCase()}
}

export function uniqueSeniorBadges<T extends {name:string;badge_url:string|null}>(clubs:T[]){
  const seen=new Set<string>();
  return clubs.filter(club=>{
    if(!club.badge_url||isReserveOrYouthClub(club.name)||isWomensTeam(club.name))return false;
    const key=badgeKey(club.badge_url);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
