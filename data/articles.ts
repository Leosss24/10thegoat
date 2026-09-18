export const articleTags = {
  historia: { label: "Historia", description: "Orígenes, cambios y momentos que explican el fútbol actual." },
  mundiales: { label: "Mundiales", description: "Torneos, selecciones y protagonistas de la Copa Mundial." },
  tactica: { label: "Táctica", description: "Sistemas, movimientos e ideas para entender mejor el juego." },
  reglas: { label: "Reglas", description: "Cómo nacieron y cómo funcionan las Reglas de Juego." },
  competiciones: { label: "Competiciones", description: "Historia y evolución de los grandes torneos." },
  futbol_femenino: { label: "Fútbol femenino", description: "Equipos, torneos y figuras que hicieron historia." },
  estadios: { label: "Estadios", description: "Escenarios que forman parte de la memoria del fútbol." },
  curiosidades: { label: "Curiosidades", description: "Detalles sorprendentes y relatos poco conocidos." },
} as const;
export type ArticleTag = keyof typeof articleTags;
export type ArticleImage = { src: string; alt: string; credit: string; creditUrl: string };
export type ArticleSummary = { slug: string; title: string; excerpt: string; readingTime: number; publishedAt: string; tags: ArticleTag[]; image: ArticleImage };
const unsplash = (id:string, alt:string):ArticleImage => ({ src:`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=78`, alt, credit:"Unsplash", creditUrl:`https://unsplash.com/photos/${id}` });
const images = {
  uruguay1930: { src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Uruguay%20national%20football%20team%201930.jpg", alt: "Selección de Uruguay campeona del mundo en 1930", credit: "Autor desconocido · dominio público", creditUrl: "https://commons.wikimedia.org/wiki/File:Uruguay_national_football_team_1930.jpg" },
  maracanazo: { src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Uruguay%20gol%20schiaffino%201950.jpg", alt: "Jugada del partido entre Uruguay y Brasil en 1950", credit: "Archivo Nacional de Brasil · dominio público", creditUrl: "https://commons.wikimedia.org/wiki/File:Uruguay_gol_schiaffino_1950.jpg" },
  brazil1970: { src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Brazil%20national%20team%201970.jpg", alt: "Selección de Brasil en el Mundial de 1970", credit: "Archivo Nacional de Brasil · dominio público", creditUrl: "https://commons.wikimedia.org/wiki/File:Brazil_national_team_1970.jpg" },
  spain2010: { src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/FIFA%20World%20Cup%202010%20Spain%20with%20cup.jpg", alt: "La selección española celebra el Mundial de 2010", credit: "Anthony Stanley · CC BY-SA 2.0", creditUrl: "https://commons.wikimedia.org/wiki/File:FIFA_World_Cup_2010_Spain_with_cup.jpg" },
  berna: unsplash("1579952363873-27f3bade9f55","Partido de fútbol bajo la lluvia"),
  offside: unsplash("1526232761682-d26e03ac148e","Jugadores disputando un partido de fútbol"),
  cards: unsplash("1570498839593-e565b39455fc","Árbitro durante un partido de fútbol"),
  penalties: unsplash("1553778263-73a83bab9b0c","Portería y balón de fútbol"),
  ball: unsplash("1517466787929-bc90951d0974","Balón de fútbol sobre el césped"),
  wm: unsplash("1431324155629-1a6deb1dec8d","Vista táctica de un terreno de juego"),
  catenaccio: unsplash("1574629810360-7efbbe195018","Estadio de fútbol iluminado"),
  total: unsplash("1575361204480-aadea25e6e68","Futbolistas en movimiento durante un partido"),
  pressing: unsplash("1551958219-acbc608c6377","Disputa intensa por el balón"),
  women1991: unsplash("1518091043644-c1d4457512c6","Equipo de fútbol reunido en el campo"),
  uswnt: unsplash("1560272564-c83b66b1ad12","Futbolista conduciendo el balón"),
  champions: unsplash("1540747913346-19e32dc3e97e","Gran estadio preparado para un partido"),
  libertadores: unsplash("1552318965-6e6be7484ada","Aficionados en un estadio de fútbol"),
  wembley: unsplash("1522778119026-d647f0596c20","Estadio de fútbol visto desde la grada"),
  sansiro: unsplash("1606925797300-0b35e9d1794e","Gradas de un estadio de fútbol"),
  shirts: unsplash("1589487391730-58f20eb2c308","Camisetas y jugadores de fútbol"),
} satisfies Record<string, ArticleImage>;
const article = (slug:string,title:string,excerpt:string,readingTime:number,tags:ArticleTag[],image:ArticleImage):ArticleSummary => ({ slug,title,excerpt,readingTime,publishedAt:"2026-09-18",tags,image });
export const articles: ArticleSummary[] = [
  article("primer-mundial-1930","Uruguay 1930: así nació la Copa Mundial","Trece selecciones, viajes en barco y un estadio todavía en obras. Así comenzó el mayor torneo de fútbol del mundo.",8,["historia","mundiales","estadios","curiosidades"],images.uruguay1930),
  article("maracanazo-1950","Maracanazo 1950: el silencio que hizo historia","Brasil necesitaba un empate; Uruguay, ganar. El desenlace convirtió un partido en una leyenda mundial.",7,["historia","mundiales","estadios"],images.maracanazo),
  article("milagro-de-berna-1954","El Milagro de Berna: cuando cayó el equipo invencible","Hungría llevaba años sin perder y empezó la final con dos goles. Alemania Occidental cambió el guion.",7,["historia","mundiales","curiosidades"],images.berna),
  article("brasil-1970","Brasil 1970: el equipo que convirtió el fútbol en arte","Pelé, Jairzinho, Tostão, Gérson y Rivelino firmaron en México una de las actuaciones más recordadas.",8,["historia","mundiales","tactica"],images.brazil1970),
  article("espana-campeona-2010","España 2010: de la derrota inicial a la estrella","La campeona perdió su primer partido, sobrevivió a cuatro eliminatorias y decidió la final en el minuto 116.",8,["historia","mundiales","tactica"],images.spain2010),
  article("nacimiento-fuera-de-juego","Fuera de juego: la regla que cambió el espacio","De impedir pases hacia delante a medir centímetros con tecnología: así evolucionó la regla más discutida.",6,["historia","reglas","tactica"],images.offside),
  article("tarjetas-rojas-amarillas","Por qué las tarjetas son amarillas y rojas","Un semáforo inspiró un lenguaje universal que permite entender al árbitro en cualquier estadio del mundo.",5,["historia","reglas","curiosidades"],images.cards),
  article("tanda-de-penaltis","La tanda de penaltis: anatomía de un desempate","Orden, presión, probabilidades y una regla decisiva: el portero debe mantener un pie sobre la línea.",7,["reglas","tactica","curiosidades"],images.penalties),
  article("evolucion-del-balon","Del cuero pesado al balón conectado","Costuras, lluvia, materiales sintéticos y sensores: la pelota también cuenta la historia tecnológica del fútbol.",6,["historia","curiosidades"],images.ball),
  article("wm-revolucion-tactica","La WM: la formación que redibujó el campo","Herbert Chapman respondió a un cambio de regla retrasando a un centrocampista y creando una estructura icónica.",7,["historia","tactica"],images.wm),
  article("catenaccio","Catenaccio: mucho más que defender atrás","El sistema italiano fue cerrojo, contraataque y ocupación racional del espacio, no simplemente acumular defensas.",7,["historia","tactica"],images.catenaccio),
  article("futbol-total","Fútbol total: el equipo que intercambiaba posiciones","El Ajax y los Países Bajos mostraron que el espacio podía dominarse con movilidad, presión y jugadores versátiles.",8,["historia","tactica"],images.total),
  article("gegenpressing","Gegenpressing: atacar justo después de perderla","Recuperar inmediatamente puede ser el pase ofensivo más eficaz. Estas son las claves de la presión tras pérdida.",6,["tactica"],images.pressing),
  article("mundial-femenino-1991","1991: el primer Mundial femenino oficial","Doce selecciones viajaron a China para abrir una competición que transformaría el fútbol internacional.",7,["historia","futbol_femenino","mundiales"],images.women1991),
  article("estados-unidos-futbol-femenino","Estados Unidos y la construcción de una potencia","Inversión educativa, referentes y competitividad explican parte del dominio histórico estadounidense.",7,["historia","futbol_femenino","competiciones"],images.uswnt),
  article("champions-league-origen","De Copa de Europa a Champions League","Una idea periodística de 1955 acabó convirtiéndose en la competición de clubes más prestigiosa de Europa.",7,["historia","competiciones"],images.champions),
  article("copa-libertadores-historia","Copa Libertadores: identidad de un continente","Viajes enormes, estadios intensos y campeones de diez países construyeron una competición inconfundible.",7,["historia","competiciones","estadios"],images.libertadores),
  article("wembley-historia","Wembley: dos torres, un arco y mil recuerdos","Del estadio imperial de 1923 al gran arco actual, Wembley ha sido escenario de finales inolvidables.",6,["historia","estadios"],images.wembley),
  article("san-siro-historia","San Siro: la casa compartida de Milán","Dos rivales, una misma grada y una arquitectura reconocible: la historia del Giuseppe Meazza.",6,["historia","estadios","curiosidades"],images.sansiro),
  article("dorsales-futbol","De identificar posiciones a construir leyendas","Los dorsales comenzaron como una ayuda práctica y terminaron ligados a identidades, mitos y marcas personales.",6,["historia","reglas","curiosidades"],images.shirts),
];
export function getArticle(slug: string) { return articles.find((item) => item.slug === slug); }
