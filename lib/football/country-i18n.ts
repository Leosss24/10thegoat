export type CountryLocale="es"|"en"|"fr";

const ISO:Record<string,string>={
  albania:"AL",algeria:"DZ",argentina:"AR",armenia:"AM",australia:"AU",austria:"AT",belarus:"BY",belgium:"BE",bolivia:"BO",bosnia:"BA","bosnia and herzegovina":"BA",brazil:"BR",bulgaria:"BG",cameroon:"CM",canada:"CA",chile:"CL",china:"CN",colombia:"CO","congo dr":"CD","congo-dr":"CD","côte d'ivoire":"CI",croatia:"HR",cyprus:"CY","czech republic":"CZ","czech-republic":"CZ",czechia:"CZ",denmark:"DK","dominican republic":"DO","dominican-republic":"DO",ecuador:"EC",egypt:"EG",france:"FR",gabon:"GA",georgia:"GE",germany:"DE",ghana:"GH",gibraltar:"GI",greece:"GR",guinea:"GN","hong-kong":"HK",hungary:"HU",iceland:"IS",india:"IN",ireland:"IE",italy:"IT","ivory-coast":"CI",japan:"JP",jordan:"JO",kazakhstan:"KZ","korea republic":"KR",lithuania:"LT",malta:"MT",mexico:"MX",moldova:"MD",monaco:"MC",montenegro:"ME",morocco:"MA",netherlands:"NL",nigeria:"NG",norway:"NO",peru:"PE",poland:"PL",portugal:"PT",qatar:"QA","republic of ireland":"IE",romania:"RO",russia:"RU","saudi-arabia":"SA",senegal:"SN",serbia:"RS",slovakia:"SK",slovenia:"SI","south-korea":"KR",spain:"ES",sweden:"SE",switzerland:"CH",turkey:"TR","türkiye":"TR",ukraine:"UA","united-arab-emirates":"AE",uruguay:"UY",usa:"US",uzbekistan:"UZ",venezuela:"VE",
};
const FOOTBALL:Record<string,Record<CountryLocale,string>>={
  england:{es:"Inglaterra",en:"England",fr:"Angleterre"},scotland:{es:"Escocia",en:"Scotland",fr:"Écosse"},wales:{es:"Gales",en:"Wales",fr:"Pays de Galles"},"northern-ireland":{es:"Irlanda del Norte",en:"Northern Ireland",fr:"Irlande du Nord"},kosovo:{es:"Kosovo",en:"Kosovo",fr:"Kosovo"},
};

export function translatedCountry(name:string,locale:CountryLocale){
  const key=name.trim().toLocaleLowerCase("en");
  if(FOOTBALL[key])return FOOTBALL[key][locale];
  const code=ISO[key];
  if(!code)return name.replaceAll("-"," ");
  return new Intl.DisplayNames([locale],{type:"region"}).of(code)??name;
}
